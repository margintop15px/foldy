import { appendFileSync } from "node:fs";
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
try {
  const report = await scan(root, { model: process.env.FOLDY_MODEL, signal: controller.signal,
    onToolEvent: event => appendFileSync(traceFile, JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n"),
  });
  console.log(JSON.stringify({ report, networkRequests }));
  process.exitCode = report.status === "complete" ? 0 : report.status === "incomplete" ? 2 : 1;
} catch (error) {
  console.log(JSON.stringify({ error: String(error), networkRequests }));
  process.exitCode = 1;
} finally {
  process.removeListener("SIGTERM", stop);
  process.removeListener("SIGINT", stop);
}
