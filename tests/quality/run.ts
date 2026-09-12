import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { arch, cpus, platform, release, tmpdir, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { DEFAULT_MODEL, localFetch, MAX_RESPONSE_TOKENS, SYSTEM_PROMPT, REVIEW_PROMPT } from "../../src/model.ts";
import { tree } from "../helpers.ts";
import { documentCases } from "./documents.ts";
import { cases } from "./cases.ts";
import { checkScan, hash, runProcess, type Results, type ScanResult } from "./harness.ts";
import { writeScorecard } from "./score.ts";

assert.equal(process.env.FOLDY_LIVE, "1", "Use npm run bench to enable local model access.");
const args = process.argv.slice(2);
let trials = 3, suite = "text", selectedId = "", out = "";
for (let i = 0; i < args.length; i += 2) {
  const value = args[i + 1];
  assert.ok(value, `Missing value for ${args[i]}`);
  if (args[i] === "--out") out = resolve(value);
  else if (args[i] === "--trials") trials = Number(value);
  else if (args[i] === "--case") selectedId = value;
  else if (args[i] === "--suite") suite = value;
  else throw new Error(`Unknown argument: ${args[i]}`);
}
assert.ok(["text", "documents", "all"].includes(suite), "Suite must be text, documents or all.");
const available = suite === "text" ? cases : suite === "documents" ? documentCases : [...cases, ...documentCases];
const selected = selectedId ? available.filter(item => item.id === selectedId) : available;
assert.ok(out && Number.isInteger(trials) && trials > 0 && trials <= 10 && selected.length, "Usage: npm run bench -- --out <new-directory> [--trials 3] [--case Q01] [--suite text|documents|all]");
await mkdir(dirname(out), { recursive: true });
await mkdir(out); // Refuse to overwrite an earlier benchmark, including a failed attempt.
const project = fileURLToPath(new URL("../../", import.meta.url));
const exec = promisify(execFile);
async function git(...args: string[]) { return (await exec("git", args, { cwd: project, maxBuffer: 4_000_000 })).stdout.trimEnd(); }
const codeFiles = [...(await readdir(join(project, "src"))).filter(name => name.endsWith(".ts")).map(name => `src/${name}`),
  "package.json", "package-lock.json", "tsconfig.json", "tests/helpers.ts", "tests/quality.test.ts", "tests/chunk-03.test.ts",
  "tests/fixtures/documents/manifest.json", "tests/fixtures/documents/README.md", "tests/fixtures/documents/build.py",
  ...(await readdir(dirname(fileURLToPath(import.meta.url)))).filter(name => name.endsWith(".ts")).map(name => `tests/quality/${name}`)];
const snapshot = Object.fromEntries(await Promise.all(codeFiles.sort().map(async path => [path, await readFile(join(project, path), "utf8")])));
const fingerprints = Object.fromEntries(Object.entries(snapshot).map(([path, content]) => [path, hash(content)]));
await writeFile(join(out, "source-snapshot.json"), JSON.stringify(snapshot, null, 2) + "\n");
const patch = await git("diff", "HEAD", "--", "src", "package.json", "package-lock.json", "tests");
await writeFile(join(out, "working-tree.patch"), patch);
let modelBefore: unknown;
try { modelBefore = await (await localFetch("http://127.0.0.1:11434/api/ps", { signal: AbortSignal.timeout(5_000) })).json(); }
catch (error) { modelBefore = { error: String(error) }; }
const assets = new Map(selected.flatMap(item => item.stages.flatMap(stage => Object.values(stage.files)))
  .filter(content => content !== null && typeof content !== "string").map(content => [content.asset, content]));
for (const [name, content] of assets) {
  const bytes = await readFile(new URL(`../fixtures/documents/${name}`, import.meta.url));
  assert.equal(hash(bytes), content.sha256, `Frozen binary asset changed: ${name}`);
  await mkdir(join(out, "assets"), { recursive: true });
  await writeFile(join(out, "assets", name), bytes);
}
const results: Results = {
  version: 1, trials, cases: selected, scans: [], finished: false,
  manifest: { startedAt: new Date().toISOString(), command: process.argv.slice(1), commit: await git("rev-parse", "HEAD"),
    gitStatus: await git("status", "--short"), patchHash: hash(patch), codeFiles: fingerprints, casesHash: hash(selected),
    promptHash: hash(SYSTEM_PROMPT), reviewPromptHash: hash(REVIEW_PROMPT), suite, oracleRevision: 3, modelTag: process.env.FOLDY_MODEL ?? DEFAULT_MODEL, modelBefore,
    node: process.version, sqlite: process.versions.sqlite, hardware: { platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model, memoryBytes: totalmem() },
    settings: { temperature: 0, maxOutputTokens: MAX_RESPONSE_TOKENS, responseTokenLimit: "min(maxOutputTokens, floor(contextWindow / 2), Pi remaining-context allowance)", maxTokensField: "max_tokens", reasoningEffort: "low when supported; per-scan model records the selected mode", retries: 0, textLimits: { maxToolCalls: 20, maxRunMs: 300_000 }, documentLimits: { maxToolCalls: 80, maxRunMs: 900_000 },
      compaction: { reserveTokens: "min(maxOutputTokens, floor(contextWindow / 2))", keepRecentTokens: 2_048 } },
    protocol: "Fresh process per scan; fresh root/state per trial; two stages then unchanged cache probe with network denied. Serial, no retries. Tool traces exclude model reasoning. Per-scan model metadata records actual runtime/digest/context.",
  },
};
async function checkpoint() {
  await writeFile(join(out, "results.json.tmp"), JSON.stringify(results, null, 2) + "\n");
  await rename(join(out, "results.json.tmp"), join(out, "results.json"));
  await writeScorecard(out, results);
}
await checkpoint();
let stopped = false;
const stop = () => { stopped = true; };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  outer: for (let trial = 1; trial <= trials; trial++) {
    for (const item of selected) {
      if (stopped) break outer;
      const temporary = await realpath(await mkdtemp(join(tmpdir(), "foldy-benchmark-")));
      const root = join(temporary, "root"), stateDir = join(temporary, "state");
      await mkdir(root);
      let previous: ScanResult | undefined;
      try {
        for (let stage = 1; stage <= 3; stage++) {
          if (stopped) break;
          if (stage <= 2) for (const [path, content] of Object.entries(item.stages[stage - 1]!.files)) {
            const target = join(root, path);
            if (content === null) await rm(target);
            else { await mkdir(dirname(target), { recursive: true }); if (typeof content === "string") await writeFile(target, content);
              else await writeFile(target, await readFile(join(out, "assets", content.asset))); }
          }
          const before = await tree(root);
          const key = `${item.id}/${trial}/${stage}`;
          const traceFile = `${item.id}-${trial}-${stage}.jsonl`;
          await writeFile(join(out, traceFile), "");
          console.log(`${key}: scanning ${item.title}${stage === 3 ? " (cache probe)" : ""}...`);
          const payload = await runProcess([fileURLToPath(new URL("./scan-process.ts", import.meta.url)), root, join(out, traceFile), ...(stage === 3 ? ["cache"] : [])],
            { ...process.env, FOLDY_STATE_DIR: stateDir }, item.id.startsWith("D") || item.id === "Q06" ? 915_000 : 315_000);
          const current: ScanResult = { key, caseId: item.id, trial, stage, ...payload, traceFile,
            sourceBytesUnchanged: JSON.stringify(before) === JSON.stringify(await tree(root)), issues: [] };
          current.inspections = [...(previous?.inspections ?? []), ...(payload.inspections ?? [])];
          current.issues = checkScan(item, current, previous);
          results.scans.push(current);
          await checkpoint();
          console.log(`${key}: ${current.report?.status ?? "no report"}, ${current.report?.findings.length ?? 0} findings, ${current.wallMs} ms, ${current.issues.length} check failures; semantics unreviewed.`);
          previous = current;
        }
      } finally { await rm(temporary, { recursive: true, force: true }); }
    }
  }
  results.finished = results.scans.length === selected.length * trials * 3;
  results.manifest.finishedAt = new Date().toISOString();
  results.manifest.codeChangesDuringRun = [];
  for (const [path, before] of Object.entries(fingerprints)) {
    if (hash(await readFile(join(project, path), "utf8")) !== before) (results.manifest.codeChangesDuringRun as string[]).push(path);
  }
  await checkpoint();
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
}
console.log(`Saved ${results.scans.length} scan attempts to ${out}. Semantic review is still required; this is not a passing quality grade.`);
process.exitCode = results.finished && !(results.manifest.codeChangesDuringRun as string[]).length && results.scans.every(scan => scan.issues.length === 0) ? 0 : 1;
