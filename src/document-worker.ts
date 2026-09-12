import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createCanvas } from "@napi-rs/canvas";
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_PIXELS, MAX_PREVIEW_EDGE, MAX_PREVIEW_BASE64, MAX_PAGE_TEXT_BYTES,
  type DocumentPage, type ExtractionReply } from "./documents.ts";

sharp.concurrency(1);
sharp.cache(false);
// PDF data and fonts come from buffers/package files, never document URLs.
globalThis.fetch = async () => { throw new Error("Document helper does not permit network requests."); };

async function preview(bytes: Uint8Array) {
  const options = { limitInputPixels: MAX_PIXELS, limitInputChannels: 4, failOn: "warning" as const, unlimited: false };
  const metadata = await sharp(bytes, options).metadata();
  if (!["png", "jpeg"].includes(metadata.format)) throw new Error("Only PNG/JPEG raster content is supported.");
  const rotated = (metadata.orientation ?? 1) >= 5;
  const originalWidth = rotated ? metadata.height : metadata.width;
  const originalHeight = rotated ? metadata.width : metadata.height;
  let edge = MAX_PREVIEW_EDGE, lossy = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    const pipeline = sharp(bytes, options).autoOrient().resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true });
    const { data, info } = await (lossy ? pipeline.flatten({ background: "white" }).jpeg({ quality: 85 }) : pipeline.png()).toBuffer({ resolveWithObject: true });
    if (4 * Math.ceil(data.length / 3) <= MAX_PREVIEW_BASE64) return {
      preview: { data, hash: createHash("sha256").update(data).digest("hex"), width: info.width, height: info.height,
        mimeType: lossy ? "image/jpeg" as const : "image/png" as const },
      originalWidth, originalHeight, reduced: lossy || info.width < originalWidth || info.height < originalHeight,
    };
    if (lossy) edge = Math.floor(edge * 0.8);
    lossy = true;
  }
  throw new Error("Could not produce a preview within the payload limit.");
}

process.on("message", async (job: { bytes: Uint8Array; format: "image" | "pdf"; page: number; visual: boolean }) => {
  let reply: ExtractionReply;
  try {
    if (job.bytes.length > (job.format === "image" ? MAX_IMAGE_BYTES : MAX_PDF_BYTES)) throw new Error("Input exceeds its byte limit.");
    if (job.format === "image") {
      if (job.page !== 1) reply = { error: "Images have only page 1.", invalidPage: true };
      else reply = { page: { page: 1, pageCount: 1, text: "", textTruncated: false,
        ...await preview(job.bytes), warnings: [], visualPartial: false } };
    } else {
      const warnings: string[] = [];
      const warn = (...args: unknown[]) => { if (warnings.length < 20) warnings.push(args.map(String).join(" ").slice(0, 500)); };
      console.warn = warn;
      console.log = warn;
      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const packageRoot = new URL("../../", import.meta.resolve("pdfjs-dist/legacy/build/pdf.mjs"));
      const loading = getDocument({ data: new Uint8Array(job.bytes), stopAtErrors: true,
        cMapUrl: fileURLToPath(new URL("cmaps/", packageRoot)), standardFontDataUrl: fileURLToPath(new URL("standard_fonts/", packageRoot)),
        wasmUrl: fileURLToPath(new URL("wasm/", packageRoot)), useWorkerFetch: false, useSystemFonts: false,
        enableXfa: false, maxImageSize: MAX_PIXELS, canvasMaxAreaInBytes: MAX_PIXELS * 4,
      });
      const document = await loading.promise;
      try {
        if (!Number.isInteger(job.page) || job.page < 1 || job.page > document.numPages) {
          reply = { error: `Page must be between 1 and ${document.numPages}.`, invalidPage: true };
        } else {
          const page = await document.getPage(job.page);
          const content = await page.getTextContent();
          const extracted = Buffer.from(content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join(""));
          const textTruncated = extracted.length > MAX_PAGE_TEXT_BYTES;
          const text = new TextDecoder().decode(extracted.subarray(0, MAX_PAGE_TEXT_BYTES), { stream: textTruncated });
          const original = page.getViewport({ scale: 1 });
          const output: DocumentPage = { page: job.page, pageCount: document.numPages, text, textTruncated,
            originalWidth: original.width, originalHeight: original.height, reduced: false, warnings, visualPartial: false };
          if (job.visual) {
            const viewport = page.getViewport({ scale: Math.min(2, MAX_PREVIEW_EDGE / Math.max(original.width, original.height)) });
            const target = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
            try {
              await page.render({ canvas: target as unknown as HTMLCanvasElement, viewport }).promise;
              const rendered = await preview(target.toBuffer("image/png"));
              output.preview = rendered.preview;
              output.reduced = rendered.reduced || viewport.scale < 2;
            } finally { target.width = target.height = 1; }
          }
          output.visualPartial = warnings.length > 0;
          reply = { page: output };
        }
      } finally { await loading.destroy(); }
    }
  } catch (error) {
    reply = { error: error instanceof Error ? error.message : String(error) };
  }
  process.send!(reply, () => process.exit(0));
});
