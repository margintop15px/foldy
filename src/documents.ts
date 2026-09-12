import childProcess from "node:child_process";
import { fileURLToPath } from "node:url";

export const EXTRACTOR_REVISION = "1";
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_PIXELS = 64_000_000;
export const MAX_PREVIEW_EDGE = 2_000;
export const MAX_PREVIEW_BASE64 = 4.5 * 1024 * 1024;
export const MAX_PAGE_TEXT_BYTES = 64 * 1024;
export const MAX_EXTRACTION_MS = 30_000;
export type Ranges = { start: number; end: number }[];
export interface PreviewInfo { hash: string; width: number; height: number; mimeType: "image/png" | "image/jpeg" }
export interface DocumentPage {
  page: number;
  pageCount: number;
  text: string;
  textTruncated: boolean;
  preview?: PreviewInfo & { data: Uint8Array };
  originalWidth: number;
  originalHeight: number;
  reduced: boolean;
  warnings: string[];
  visualPartial: boolean;
}
export interface DocumentCoverage {
  revision: string;
  pageCount?: number;
  error?: string;
  terminal?: boolean;
  visualUnavailable?: boolean;
  pages: Record<number, { textLength: number; textTruncated: boolean; inspected: Ranges; visual?: PreviewInfo;
    visualPartial: boolean; reduced: boolean; warnings: string[]; originalWidth: number; originalHeight: number }>;
}
export type ExtractionReply = { page: DocumentPage } | { error: string; invalidPage?: boolean };

/** Fixed application code in a disposable process. At most one call is active per serial scan. */
export async function extractDocument(bytes: Uint8Array, format: "image" | "pdf", page: number,
  visual: boolean, signal: AbortSignal, maxMs = MAX_EXTRACTION_MS): Promise<ExtractionReply> {
  signal.throwIfAborted();
  const child = childProcess.fork(fileURLToPath(new URL("./document-worker.ts", import.meta.url)), [], {
    serialization: "advanced", stdio: ["ignore", "ignore", "pipe", "ipc"],
    execArgv: ["--max-old-space-size=512"],
  });
  let diagnostic = "", reply: ExtractionReply | undefined, failure: Error | undefined;
  child.stderr?.on("data", chunk => { diagnostic = (diagnostic + String(chunk)).slice(0, 2_000); });
  const abort = () => { failure = new Error(String(signal.reason ?? "Document extraction cancelled.")); child.kill("SIGKILL"); };
  const timer = setTimeout(() => {
    failure = new Error("Document extraction exceeded its job deadline; scan again to retry.");
    child.kill("SIGKILL");
  }, Math.min(maxMs, MAX_EXTRACTION_MS));
  signal.addEventListener("abort", abort, { once: true });
  try {
    return await new Promise((resolve, reject) => {
      child.on("message", message => { reply = message as ExtractionReply; });
      child.on("error", error => { failure = error; });
      child.on("close", (code, killedBy) => {
        if (failure) reject(failure);
        else if (code !== 0 || !reply) reject(new Error(`Document helper failed (${killedBy ?? code}): ${diagnostic}`));
        else resolve(reply);
      });
      if (signal.aborted) abort();
      else child.send({ bytes, format, page, visual }, error => { if (error) { failure = error; child.kill("SIGKILL"); } });
    });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
