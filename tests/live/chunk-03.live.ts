import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { type scan } from "../../src/scan.ts";
import { fixture, tree } from "../helpers.ts";

test("A03/A04/A05 live: image receipt connects to later PDF evidence across processes and then caches", { timeout: 1_840_000 }, async t => {
  assert.equal(process.env.FOLDY_LIVE, "1", "Live model access requires npm run test:live.");
  const { root, stateDir } = await fixture(t);
  const driver = fileURLToPath(new URL("../../src/cli.ts", import.meta.url));
  const asset = (name: string) => new URL(`../fixtures/documents/${name}`, import.meta.url);
  async function runScan(batch: number) {
    let stdout: string;
    try {
      ({ stdout } = await promisify(execFile)(process.execPath, [driver, "scan", root], {
        env: { ...process.env, FOLDY_STATE_DIR: stateDir }, timeout: 915_000, maxBuffer: 4_000_000,
      }));
    } catch (error) {
      t.diagnostic(String((error as { stdout?: string }).stdout ?? error));
      throw error;
    }
    const report = JSON.parse(stdout) as Awaited<ReturnType<typeof scan>>;
    t.diagnostic(JSON.stringify({ batch, ...report }));
    assert.equal(report.status, "complete", JSON.stringify(report.errors));
    assert.equal(report.reasoningPending, false);
    return report;
  }
  await copyFile(asset("receipt.png"), join(root, "a.png"));
  const first = await runScan(1);
  assert.ok(first.model?.capabilities?.includes("vision"));
  assert.equal(first.files[0]!.inspection, "full");
  assert.ok(first.findings.some(f => f.evidence.some(ref => ref.type === "visual" && ref.path === "a.png")));
  await copyFile(asset("statement.pdf"), join(root, "b.pdf"));
  const before = await tree(root);
  const second = await runScan(2);
  const link = second.findings.find(f => f.evidence.some(ref => ref.path === "a.png" && ref.type === "visual") &&
    f.evidence.some(ref => ref.path === "b.pdf" && ref.page === 1));
  assert.ok(link, "A connection must cite the earlier receipt pixels and later statement page together.");
  assert.match(link.claim, /PV-2218|Marlow/i);
  assert.ok(second.findings.some(f => /Harbor Cafe|PV-7720/i.test(f.claim)), "The similar separate debit must be represented.");
  assert.ok(second.files.every(file => file.inspection === "full"));
  assert.equal(second.files.find(file => file.path === "a.png")!.sourceId, first.files[0]!.sourceId);
  const third = await runScan(3);
  assert.equal(third.cached, true);
  assert.equal(third.modelCalls, 0);
  assert.equal(third.toolCalls, 0);
  assert.ok(Object.values(third.processing).every(count => count === 0));
  assert.deepEqual(third.findings, second.findings);
  assert.deepEqual(await tree(root), before);
});
