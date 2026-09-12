import assert from "node:assert/strict";
import { scan } from "../../src/scan.ts";
import { type ModelStream } from "../../src/model.ts";
import { call, finding, read, scripted, toolResult } from "../helpers.ts";

globalThis.fetch = () => { throw new Error("Offline child processes must never access the network."); };
const [mode, root] = process.argv.slice(2);
const controller = new AbortController();
process.on("SIGTERM", () => controller.abort(new Error("Cancelled by test.")));
const first = scripted((_context, index) => [
  [read("archive/plan.md")], [finding("archive/plan.md", "Project ID: LTN-204.")], [],
][index]!);
const second = scripted((context, index) => {
  if (index === 0) return [call("search_context", { query: "LTN-204" }), read("meetings/notes.txt"), read("other/lantern-festival.txt")];
  if (index === 1) {
    assert.ok(toolResult(context, "search_context").results.some((hit: { path: string }) => hit.path === "archive/plan.md"));
    return [read("archive/plan.md")];
  }
  if (index === 2) return [call("record_finding", {
    claim: "The plan and meeting notes describe Project Lantern LTN-204.", kind: "inferred",
    uncertainty: "Their explicit project identifier matches; the festival has a different event identifier.",
    evidence: ["archive/plan.md", "meetings/notes.txt"].map(path => ({ path, quote: "Project ID: LTN-204." })),
  }), finding("other/lantern-festival.txt", "Event ID: FEST-811.")];
  return [];
});
const holding = scripted((_context, index) => index === 0 ? [read("draft.txt")] : [finding("draft.txt", "Uncommitted change.")]);
let holdRequests = 0;
const hold: ModelStream = async (model, context, options) => {
  if (holdRequests++ < 2) return holding(model, context, options);
  process.send?.("holding");
  await new Promise<void>(resolve => {
    if (options?.signal?.aborted) resolve();
    else options?.signal?.addEventListener("abort", () => resolve(), { once: true });
  });
  return scripted(() => "error")(model, context, options);
};
const stream = mode === "first" ? first : mode === "second" ? second : mode === "hold" ? hold
  : scripted(() => { throw new Error("Cached scans must not call the model."); });
const report = await scan(root!, { stream, signal: controller.signal });
process.stdout.write(`${JSON.stringify(report)}\n`);
process.exitCode = report.status === "complete" ? 0 : report.status === "incomplete" ? 2 : 1;
