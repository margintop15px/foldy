import { randomUUID } from "node:crypto";
import { lstat, open, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

export const REPORT_NAME = ".foldy.json";
export function isReportFile(name: string): boolean {
  return name === REPORT_NAME || /^\.foldy\.json\.[0-9a-f-]{36}\.tmp$/.test(name);
}

/** Publish a complete report without exposing a partially written JSON file. */
export async function saveReport(root: string, json: string): Promise<void> {
  const destination = join(root, REPORT_NAME);
  async function checkDestination() {
    const info = await lstat(destination).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    if (info && !info.isFile()) throw new Error(".foldy.json must be a regular file, not a directory or symlink.");
  }
  await checkDestination();
  const temporary = join(root, `${REPORT_NAME}.${randomUUID()}.tmp`);
  const file = await open(temporary, "wx", 0o600);
  try {
    try {
      await file.writeFile(json, "utf8");
      await file.sync();
    } finally { await file.close(); }
    await checkDestination();
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
