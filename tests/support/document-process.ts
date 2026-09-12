import { scan } from "../../src/scan.ts";
import { call, read, scripted, toolResult } from "../helpers.ts";

globalThis.fetch = async () => { throw new Error("Offline document test attempted network access."); };
const [mode, root] = process.argv.slice(2);
const report = await scan(root!, { offlineModel: { name: "offline-document", contextWindow: 65_536, capabilities: ["tools", "vision"] }, stream: scripted((context, turn) => {
  if (mode === "cached") throw new Error("Cache contacted model.");
  if (mode === "first") {
    if (turn < 12) return [call("read_file", { path: "a.pdf", page: turn + 1 })];
    if (turn === 12) {
      const last = toolResult(context, "read_file");
      if (last.page !== 12 || last.nextPage !== null) throw new Error("Incorrect last page.");
      return [call("record_finding", { claim: "The handbook requests room Elm; its reservation is not yet confirmed.", kind: "observed",
        evidence: [{ path: "a.pdf", page: 12, visualRef: last.visualRef }] })];
    }
  }
  if (mode === "second") {
    if (turn === 0) return [call("search_context", { query: "Calibration owner: Talia" })];
    if (turn === 1) {
      const hits = toolResult(context, "search_context").results;
      if (!hits.some((hit: { page?: number; inspection?: string }) => hit.page === 12 && hit.inspection === "full")) throw new Error("Earlier PDF evidence unavailable.");
      return [call("read_file", { path: "a.pdf", page: 12 }), read("b.txt")];
    }
    if (turn === 2) return [call("record_finding", { claim: "The handbook's requested room Elm is now confirmed by the later note.", kind: "observed",
      evidence: [{ path: "a.pdf", page: 12, quote: "Request: reserve room Elm for the calibration." }, { path: "b.txt", quote: "Room Elm is now confirmed." }] })];
  }
  return [];
}) });
console.log(JSON.stringify(report));
