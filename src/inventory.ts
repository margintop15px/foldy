import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, type DocumentCoverage } from "./documents.ts";

export const MAX_FILE_BYTES = 64 * 1024;
export const MAX_ENTRIES = 200;
export const READ_CHARACTERS = 4_000;

export interface Source {
  sourceId?: string;
  path: string;
  kind: "file" | "directory" | "symlink" | "other";
  status: "ready" | "skipped" | "unsupported" | "error";
  size?: number;
  modifiedAt?: string;
  version?: string;
  reason?: string;
  text?: string;
  format?: "text" | "image" | "pdf";
  document?: DocumentCoverage;
  inspected: { start: number; end: number }[];
}

export interface Inventory {
  root: string;
  observedAt: string;
  sources: Source[];
  errors: string[];
  enumerationComplete: boolean;
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function inventoryFolder(inputRoot: string, signal: AbortSignal, expectedRoot?: string, snapshotBinary?: (version: string, bytes: Uint8Array) => void): Promise<Inventory> {
  const root = await realpath(inputRoot);
  if (expectedRoot !== undefined && root !== expectedRoot) throw new Error("The scan root changed before inventory; scan again.");
  if (!(await stat(root)).isDirectory()) throw new Error("The scan root must be an existing directory.");
  const inventory: Inventory = { root, observedAt: new Date().toISOString(), sources: [], errors: [], enumerationComplete: true };

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
          const extension = extname(path).toLowerCase();
          source.format = [".txt", ".md", ".markdown", ".csv"].includes(extension) ? "text"
            : [".png", ".jpg", ".jpeg"].includes(extension) ? "image" : extension === ".pdf" ? "pdf" : undefined;
          if (!source.format) {
            source.status = "unsupported";
            source.reason = "Supported inputs are UTF-8 text, Markdown, CSV, PNG/JPEG, and PDF.";
            continue;
          }
          const limit = inputLimit(source);
          if (before.size > limit) {
            source.reason = `File exceeds the ${limit}-byte reading limit; content was not inspected.`;
            continue;
          }
          const snapshot = await readSnapshot(root, path, limit, signal);
          source.version = snapshot.version;
          if (source.format === "text") {
            const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(snapshot.bytes);
            if (text.includes("\0")) throw new Error("Binary content is not supported as text.");
            source.text = text;
          } else snapshotBinary?.(snapshot.version, snapshot.bytes);
          source.status = "ready";
        } else {
          source.reason = "Only regular files and directories are inspected.";
        }
      } catch (error) {
        // A failed directory listing (or an entry we could not stat) can hide children.
        if (source.kind === "directory" || source.kind === "other") inventory.enumerationComplete = false;
        source.status = "error";
        source.reason = errorText(error);
        if (inventory.sources.length >= MAX_ENTRIES) throw error;
      }
    }
  }

  try {
    await walk("", 0);
  } catch (error) {
    inventory.enumerationComplete = false;
    inventory.errors.push(errorText(error));
  }
  return inventory;
}

export function inputLimit(source: Source) {
  return source.format === "image" ? MAX_IMAGE_BYTES : source.format === "pdf" ? MAX_PDF_BYTES : MAX_FILE_BYTES;
}

export async function readSnapshot(root: string, path: string, limit: number, signal: AbortSignal) {
  const absolute = resolve(root, path);
  if (!absolute.startsWith(root + "/") || await realpath(absolute) !== absolute) throw new Error("Path escapes the root or traverses a symlink.");
  const before = await lstat(absolute);
  // Darwin's O_NOFOLLOW_ANY rejects ancestor symlinks as well as a symlink leaf.
  const noFollow = process.platform === "darwin" ? 0x20000000 : constants.O_NOFOLLOW;
  const file = await open(absolute, constants.O_RDONLY | constants.O_NONBLOCK | noFollow);
  try {
    const opened = await file.stat();
    if (!opened.isFile() || opened.ino !== before.ino || opened.dev !== before.dev || opened.size > limit) {
      throw new Error("File was replaced or exceeds its size limit; scan again.");
    }
    const buffer = Buffer.alloc(Math.min(limit, before.size) + 1);
    let length = 0;
    while (length < buffer.length) {
      signal.throwIfAborted();
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    const after = await file.stat();
    const current = await lstat(absolute);
    if (length > limit || before.size !== length || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs ||
      current.ino !== after.ino || current.dev !== after.dev || current.size !== after.size || current.ctimeMs !== after.ctimeMs ||
      current.isSymbolicLink() || await realpath(absolute) !== absolute) throw new Error("File changed during reading; scan again.");
    const bytes = buffer.subarray(0, length);
    return { bytes, version: createHash("sha256").update(bytes).digest("hex") };
  } finally { await file.close(); }
}

export function rangesCover(ranges: Source["inspected"], length: number) {
  return ranges.some(range => range.start === 0 && range.end >= length);
}

export function inspectionCoverage(source: Source): "none" | "partial" | "full" {
  if (source.format === "image" || source.format === "pdf") {
    const pages = Object.values(source.document?.pages ?? {});
    if (!pages.some(page => page.visual || (page.textLength > 0 && page.inspected.some(range => range.end > range.start)))) return "none";
    return !source.document?.error && pages.length === source.document?.pageCount &&
      pages.every(page => page.visual && !page.visualPartial && !page.textTruncated && rangesCover(page.inspected, page.textLength)) ? "full" : "partial";
  }
  if (source.text === undefined || !source.inspected.length) return "none";
  return rangesCover(source.inspected, source.text.length) ? "full" : "partial";
}
