import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { scan } from "../../src/scan.ts";
import { DEFAULT_MODEL, localFetch, OLLAMA_URL } from "../../src/model.ts";

test("A02 live: two synthetic files yield valid source-backed findings through local Pi/Ollama", { timeout: 310_000 }, async t => {
  assert.equal(process.env.FOLDY_LIVE, "1", "Live model access requires npm run test:live.");
  const root = await mkdtemp(join(tmpdir(), "foldy-live-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const stateDir = await mkdtemp(join(tmpdir(), "foldy-live-state-"));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  await cp(fileURLToPath(new URL("../fixtures/text/", import.meta.url)), root, { recursive: true });
  const names = (await readdir(root)).sort();
  const before = new Map(await Promise.all(names.map(async name => [name, await readFile(join(root, name))] as const)));
  const selectedModel = process.env.FOLDY_MODEL ?? DEFAULT_MODEL;
  let peakLoadedBytes = 0;
  let memorySamples = 0;
  const sampleMemory = async () => {
    const state = await localFetch(`${OLLAMA_URL}/api/ps`, { signal: AbortSignal.timeout(2_000) }).then(response => response.json());
    const model = state.models?.find((model: { name: string }) => model.name === selectedModel);
    if (model) { peakLoadedBytes = Math.max(peakLoadedBytes, model.size); memorySamples++; }
  };
  // This measures Ollama's reported allocation, not whole-process RSS or total system memory.
  const sampler = setInterval(() => { void sampleMemory().catch(() => {}); }, 1_000);
  const report = await scan(root, { stateDir, model: selectedModel }).finally(() => clearInterval(sampler));
  await sampleMemory().catch(() => {});
  t.diagnostic(JSON.stringify({ peakLoadedBytes, memorySamples, memoryMetric: "Ollama /api/ps size, polled each second" }));
  t.diagnostic(JSON.stringify(report));
  assert.equal(report.status, "complete", JSON.stringify(report.errors));
  assert.equal(report.files.filter(source => source.inspection === "full").length, 2);
  assert.ok(report.findings.length > 0, "The model must record usable findings, not just prose.");
  const cited = new Set(report.findings.flatMap(finding => finding.evidence.map(evidence => evidence.path)));
  assert.deepEqual([...cited].sort(), names, "Findings should use both synthetic inputs.");
  assert.ok(report.findings.some(finding => /2026-10-15/.test(finding.claim)), "The review date must be reported correctly.");
  for (const finding of report.findings) {
    for (const evidence of finding.evidence) {
      const text = before.get(evidence.path)!.toString("utf8");
      assert.equal(text.slice(evidence.start, evidence.end), evidence.quote);
      assert.ok(evidence.version.match(/^[0-9a-f]{64}$/));
    }
  }
  assert.deepEqual((await readdir(root)).sort(), names);
  for (const [name, bytes] of before) assert.deepEqual(await readFile(join(root, name)), bytes);
  assert.ok(report.model?.contextWindow && report.model.contextWindow >= 8_192);
  assert.ok(report.toolCalls > 0 && report.toolCalls <= 20);
});
