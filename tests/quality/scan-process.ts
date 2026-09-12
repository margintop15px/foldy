import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { type Inspection } from "./harness.ts";
import { scan } from "../../src/scan.ts";

if (process.env.FOLDY_LIVE !== "1") throw new Error("Use npm run bench for explicit local-model access.");
const [root, traceFile, cache] = process.argv.slice(2);
if (!root || !traceFile) throw new Error("Benchmark driver needs a root and trace file.");
const controller = new AbortController();
const stop = () => controller.abort(new Error("Benchmark scan cancelled."));
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
let networkRequests = 0;
const fetch = globalThis.fetch;
globalThis.fetch = (...args) => {
  networkRequests++;
  if (cache === "cache") throw new Error("Cache probe attempted network access.");
  return fetch(...args);
};
const inspections: Inspection[] = [];
try {
  const report = await scan(root, { model: process.env.FOLDY_MODEL, signal: controller.signal,
    onToolEvent: event => {
      let logged: unknown = event;
      if (event.type === "tool_execution_end" && event.toolName === "read_file" && !event.isError) {
        const result = event.result as { content: { type: string; text?: string; data?: string; mimeType?: string }[] };
        const metadata = JSON.parse(result.content.find(block => block.type === "text")!.text!);
        const image = result.content.find(block => block.type === "image");
        let previewFile: string | undefined;
        if (image) {
          const bytes = Buffer.from(image.data!, "base64");
          const digest = createHash("sha256").update(bytes).digest("hex");
          if (digest !== metadata.preview.hash) throw new Error("Preview metadata does not match pixels delivered by the tool.");
          mkdirSync(join(dirname(traceFile), "previews"), { recursive: true });
          previewFile = `previews/${digest}.${image.mimeType === "image/jpeg" ? "jpg" : "png"}`;
          try { writeFileSync(join(dirname(traceFile), previewFile), bytes, { flag: "wx" }); }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
        }
        inspections.push({ ...metadata, previewFile });
        logged = { ...event, result: { ...result, content: result.content.map(block => block.type === "image"
          ? { type: "image", mimeType: block.mimeType, previewFile, hash: metadata.preview.hash } : block) } };
      }
      appendFileSync(traceFile, JSON.stringify({ at: new Date().toISOString(), ...logged as object }) + "\n");
    },
  });
  console.log(JSON.stringify({ report, networkRequests, inspections }));
  process.exitCode = report.status === "complete" ? 0 : report.status === "incomplete" ? 2 : 1;
} catch (error) {
  console.log(JSON.stringify({ error: String(error), networkRequests, inspections }));
  process.exitCode = 1;
} finally {
  process.removeListener("SIGTERM", stop);
  process.removeListener("SIGINT", stop);
}
