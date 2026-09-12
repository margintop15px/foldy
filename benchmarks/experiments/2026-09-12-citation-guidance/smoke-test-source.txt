import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { type scan } from "../../src/scan.ts";
import { fixture, tree } from "../helpers.ts";

test("A03/A04 live: two batches connect across fresh local-model processes, with a separate near-match and a cached third scan", { timeout: 650_000 }, async t => {
  assert.equal(process.env.FOLDY_LIVE, "1", "Live model access requires npm run test:live.");
  const { root, stateDir } = await fixture(t);
  const driver = fileURLToPath(new URL("../../src/cli.ts", import.meta.url));
  async function runScan(batch: number) {
    let stdout: string;
    try {
      ({ stdout } = await promisify(execFile)(process.execPath, [driver, "scan", root], {
        env: { ...process.env, FOLDY_STATE_DIR: stateDir }, timeout: 310_000, maxBuffer: 2_000_000,
      }));
    } catch (error) {
      t.diagnostic(String((error as { stdout?: string }).stdout ?? error));
      throw error;
    }
    const report = JSON.parse(stdout) as Awaited<ReturnType<typeof scan>>;
    t.diagnostic(JSON.stringify({ batch, ...report }));
    assert.equal(report.status, "complete", JSON.stringify(report.errors));
    assert.deepEqual(report.toolErrors, []);
    return report;
  }
  await cp(fileURLToPath(new URL("../fixtures/cross-file/batch-1/", import.meta.url)), root, { recursive: true });
  const first = await runScan(1);
  assert.equal(first.cached, false);
  assert.ok(first.findings.length > 0);
  await cp(fileURLToPath(new URL("../fixtures/cross-file/batch-2/", import.meta.url)), root, { recursive: true });
  const before = await tree(root);
  const second = await runScan(2);
  assert.equal(second.cached, false);
  const connection = second.findings.find(finding =>
    finding.evidence.some(ref => ref.path === "archive/plan.md") && finding.evidence.some(ref => ref.path === "meetings/notes.txt"));
  assert.ok(connection, "A supported finding must cite both batches.");
  assert.match(connection.claim, /Lantern|LTN-204|prototype|review/i);
  assert.equal(connection.evidence.find(ref => ref.path === "archive/plan.md")!.sourceId,
    first.files.find(source => source.path === "archive/plan.md")!.sourceId);
  assert.ok(second.findings.some(finding => finding.evidence.some(ref => ref.path === "other/lantern-festival.txt")),
    "The near-match must be inspected and represented separately.");
  for (const finding of second.findings) {
    const festival = finding.evidence.some(ref => ref.path === "other/lantern-festival.txt");
    const project = finding.evidence.some(ref => ref.path !== "other/lantern-festival.txt");
    if (festival && project) assert.match(finding.claim, /separate|distinct|different|unrelated|not (?:the same|related|connected)/i,
      "A finding citing the festival alongside the project must distinguish them, not assert equivalence.");
    for (const evidence of finding.evidence) {
      const bytes = await readFile(join(root, evidence.path));
      assert.equal(evidence.version, createHash("sha256").update(bytes).digest("hex"));
      assert.equal(bytes.toString("utf8").slice(evidence.start, evidence.end), evidence.quote);
      assert.equal(second.files.find(source => source.path === evidence.path)!.sourceId, evidence.sourceId);
    }
  }
  assert.equal(second.files.filter(source => source.inspection === "full").length, 3);
  const third = await runScan(3);
  assert.equal(third.cached, true);
  assert.equal(third.modelCalls, 0);
  assert.equal(third.toolCalls, 0);
  assert.equal(third.executedToolCalls, 0);
  assert.deepEqual(third.findings, second.findings);
  assert.deepEqual(await tree(root), before);
});
