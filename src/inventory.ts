import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath, stat } from "node:fs/promises";
import { extname, join } from "node:path";

export const MAX_FILE_BYTES = 64 * 1024;
export const MAX_ENTRIES = 200;
export const READ_CHARACTERS = 4_000;

export interface Source {
  path: string;
  kind: "file" | "directory" | "symlink" | "other";
  status: "ready" | "skipped" | "unsupported" | "error";
  size?: number;
  modifiedAt?: string;
  version?: string;
  reason?: string;
  text?: string;
  inspected: { start: number; end: number }[];
}

export interface Inventory {
  root: string;
  observedAt: string;
  sources: Source[];
  errors: string[];
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function inventoryFolder(inputRoot: string, signal: AbortSignal): Promise<Inventory> {
  const root = await realpath(inputRoot);
  if (!(await stat(root)).isDirectory()) throw new Error("The scan root must be an existing directory.");
  const inventory: Inventory = { root, observedAt: new Date().toISOString(), sources: [], errors: [] };

  async function walk(relative: string, depth: number): Promise<void> {
    signal.throwIfAborted();
    const directory = join(root, relative);
    // Recheck ancestors before listing. Model tools will read only the resulting snapshots.
    if (await realpath(directory) !== directory) throw new Error(`Directory became a symlink: ${relative}`);
    if (depth > 32) throw new Error(`Directory depth exceeds 32: ${relative}`);
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      signal.throwIfAborted();
      if (inventory.sources.length >= MAX_ENTRIES) {
        throw new Error(`Inventory stopped at ${MAX_ENTRIES} entries; the rest of the folder was not inspected.`);
      }
      const path = relative ? `${relative}/${child.name}` : child.name;
      const absolute = join(root, path);
      const source: Source = { path, kind: "other", status: "skipped", inspected: [] };
      inventory.sources.push(source);
      try {
        const before = await lstat(absolute);
        source.size = before.size;
        source.modifiedAt = before.mtime.toISOString();
        if (before.isSymbolicLink()) {
          source.kind = "symlink";
          source.reason = "Descendant symlinks are not followed.";
        } else if (before.isDirectory()) {
          source.kind = "directory";
          source.status = "ready";
          await walk(path, depth + 1);
        } else if (before.isFile()) {
          source.kind = "file";
          if (![".txt", ".md", ".markdown", ".csv"].includes(extname(path).toLowerCase())) {
            source.status = "unsupported";
            source.reason = "Chunk 01 reads UTF-8 text, Markdown, and CSV as text; other formats are not inspected.";
            continue;
          }
          if (before.size > MAX_FILE_BYTES) {
            source.reason = `File exceeds the ${MAX_FILE_BYTES}-byte reading limit; content was not inspected.`;
            continue;
          }
          if (await realpath(absolute) !== absolute) throw new Error("Path traverses a symlink.");
          // Darwin's O_NOFOLLOW_ANY is not exported by Node; sys/fcntl.h defines it as 0x20000000.
          // It replaces O_NOFOLLOW: Darwin rejects combining the two flags.
          const noFollow = process.platform === "darwin" ? 0x20000000 : constants.O_NOFOLLOW;
          const file = await open(absolute, constants.O_RDONLY | constants.O_NONBLOCK | noFollow);
          try {
            const opened = await file.stat();
            if (!opened.isFile() || opened.ino !== before.ino || opened.dev !== before.dev) {
              throw new Error("File was replaced before reading; scan again.");
            }
            // A fixed buffer also bounds a file that grows after the initial stat.
            const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
            let length = 0;
            while (length < buffer.length) {
              signal.throwIfAborted();
              const { bytesRead } = await file.read(buffer, length, buffer.length - length, length);
              if (!bytesRead) break;
              length += bytesRead;
            }
            const after = await file.stat();
            const current = await lstat(absolute);
            if (length > MAX_FILE_BYTES || before.size !== length || before.mtimeMs !== after.mtimeMs ||
                before.ctimeMs !== after.ctimeMs || current.ino !== after.ino || current.isSymbolicLink() ||
                await realpath(absolute) !== absolute) {
              throw new Error("File changed during reading; scan again.");
            }
            const bytes = buffer.subarray(0, length);
            source.version = createHash("sha256").update(bytes).digest("hex");
            const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
            if (text.includes("\0")) throw new Error("Binary content is not supported as text.");
            source.text = text;
            source.status = "ready";
          } finally {
            await file.close();
          }
        } else {
          source.reason = "Only regular files and directories are inspected.";
        }
      } catch (error) {
        source.status = "error";
        source.reason = errorText(error);
        if (inventory.sources.length >= MAX_ENTRIES) throw error;
      }
    }
  }

  try {
    await walk("", 0);
  } catch (error) {
    inventory.errors.push(errorText(error));
  }
  return inventory;
}

export function inspectionCoverage(source: Source): "none" | "partial" | "full" {
  if (source.text === undefined || !source.inspected.length) return "none";
  let end = 0;
  for (const range of [...source.inspected].sort((a, b) => a.start - b.start)) {
    if (range.start > end) return "partial";
    end = Math.max(end, range.end);
  }
  return end >= source.text.length ? "full" : "partial";
}
