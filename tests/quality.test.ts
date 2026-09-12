import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { scan } from "../src/scan.ts";
import { call, fixture, read, scripted, toolResult } from "./helpers.ts";
import { cases, sourcesAt, type Case } from "./quality/cases.ts";
import { checkScan, hash, runProcess, type Inspection, type Results, type ScanResult } from "./quality/harness.ts";
import { grade, scorecard, verifyRetainedAssets, type Review, type StageReview } from "./quality/score.ts";
import { documentCases } from "./quality/documents.ts";

const content = "Project Elm budget is EUR 240.\nProject Oak is a separate project.\n";
const stage: Case["stages"][0] = {
  files: { "source.txt": content }, expectedStatus: "complete" as const,
  required: [{ id: "budget", kind: "fact" as const, description: "Elm budget EUR 240 (24000 cents).", paths: ["source.txt"] }],
};
const oracle: Case = { id: "TEST", title: "Grader calibration", forbidden: ["Wrong budget or false identity"], stages: [stage, structuredClone(stage)] };

async function sample(t: Parameters<typeof fixture>[0], claim = "Elm has a budget of 240 euros.") {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "source.txt"), content);
  const events: unknown[] = [];
  const report = await scan(root, { stateDir, onToolEvent: event => events.push(event), stream: scripted((_context, turn) =>
    turn === 0 ? [read("source.txt")] : turn === 1 ? [call("record_finding", { claim, kind: "observed", evidence: [{ path: "source.txt", quote: content.trim() }] })] : []),
  });
  const attempt: ScanResult = { key: "TEST/1/1", caseId: "TEST", trial: 1, stage: 1, report, networkRequests: 1,
    exitCode: 0, wallMs: 100, stderr: "", sourceBytesUnchanged: true, issues: [], traceFile: "unused.jsonl" };
  attempt.issues = checkScan(oracle, attempt);
  const results: Results = { version: 1, manifest: { casesHash: hash([oracle]) }, cases: [oracle], trials: 1, scans: [attempt], finished: false };
  return { results, attempt, events, root, stateDir };
}
function reviewOf(results: Results, attempt: ScanResult, change: Partial<StageReview> = {}): Review {
  return { resultsHash: hash(results), reviewer: "Offline calibration labels authored for synthetic counterexamples", stages: {
    [attempt.key]: { reportHash: hash(attempt.report), usefulness: 2, notes: "Directly supported paraphrase of the budget.",
      claims: [{ text: "Elm budget is EUR 240.", findings: [1], label: "supported", kind: "fact", covers: ["budget"], reason: "Correct entity, currency and value, present in the cited source." }], ...change },
  } };
}

test("Quality strict gate rejects noncritical unsupported extras, including uncertainty", async t => {
  const { results, attempt } = await sample(t);
  const review = reviewOf(results, attempt);
  review.stages[attempt.key]!.claims.push({ text: "The budget might have been reduced due to delays.", findings: [1],
    label: "insufficient", kind: "uncertainty", covers: [], reason: "The cited source gives no earlier budget or cause." });
  assert.equal(grade(results, attempt, review).status, "passed", "Preserve the historical grading contract.");
  assert.equal(grade(results, attempt, review, true).status, "failed");
  assert.match(scorecard(results, review, true), /STRICT/);
  review.stages[attempt.key]!.claims.pop();
  results.manifest.codeChangesDuringRun = ["src/model.ts"];
  review.resultsHash = hash(results);
  assert.equal(grade(results, attempt, review, true).status, "failed");
  assert.match(scorecard(results, review, true), /INVALID COLLECTION/);
});

test("Quality: document grades require the right page and visual evidence, and retained pixels cannot change", async t => {
  const { directory, root, stateDir } = await fixture(t);
  const input = await readFile(new URL("./fixtures/documents/mixed.pdf", import.meta.url));
  await writeFile(join(root, "a.pdf"), input);
  await mkdir(join(directory, "assets"));
  await mkdir(join(directory, "previews"));
  await writeFile(join(directory, "assets/mixed.pdf"), input);
  const inspections: Inspection[] = [];
  let previewBytes: Buffer | undefined;
  const report = await scan(root, { stateDir, onToolEvent: event => {
    if (event.type !== "tool_execution_end" || event.toolName !== "read_file" || event.isError) return;
    const result = event.result as { content: { type: string; text?: string; data?: string }[] };
    const metadata = JSON.parse(result.content.find(block => block.type === "text")!.text!);
    previewBytes = Buffer.from(result.content.find(block => block.type === "image")!.data!, "base64");
    inspections.push({ ...metadata, previewFile: `previews/${metadata.preview.hash}.png` });
  }, stream: scripted((context, turn) => turn === 0 ? [read("a.pdf")]
    : turn === 1 ? [call("record_finding", { claim: "The chart shows Tuesday 72 C, above the stated 60 C limit.", kind: "observed",
      evidence: [{ path: "a.pdf", page: 1, visualRef: toolResult(context, "read_file").visualRef },
        { path: "a.pdf", page: 1, quote: "Temperature limit: at most 60 C." }] })] : []) });
  await writeFile(join(directory, inspections[0]!.previewFile!), previewBytes!);
  const documentStage: Case["stages"][0] = { files: { "a.pdf": { asset: "mixed.pdf", sha256: hash(input) } }, expectedStatus: "complete",
    required: [{ id: "chart", kind: "fact", description: "Tuesday exceeds the limit.", paths: ["a.pdf"], locators: [{ path: "a.pdf", page: 1, visual: true }] }] };
  const item: Case = { id: "DOC", title: "Document grader calibration", forbidden: [], stages: [documentStage, documentStage] };
  const attempt: ScanResult = { key: "DOC/1/1", caseId: "DOC", trial: 1, stage: 1, report, inspections, networkRequests: 1,
    exitCode: 0, wallMs: 100, stderr: "", sourceBytesUnchanged: true, issues: [], traceFile: "unused.jsonl" };
  const results: Results = { version: 1, manifest: {}, cases: [item], trials: 1, scans: [attempt], finished: false };
  const review = (): Review => ({ resultsHash: hash(results), reviewer: "Offline calibration, manually authored labels.", stages: {
    [attempt.key]: { reportHash: hash(attempt.report), usefulness: 2, notes: "The chart and stated limit support the comparison.",
      claims: [{ text: report.findings[0]!.claim, findings: [1], label: "supported", kind: "fact", covers: ["chart"], reason: "Visible Tuesday 72 exceeds the stated 60 limit." }] },
  } });
  assert.deepEqual(checkScan(item, attempt), []);
  assert.equal(grade(results, attempt, review(), true).status, "passed");
  const wrongPage = structuredClone(attempt);
  wrongPage.report!.findings[0]!.evidence[0]!.page = 2;
  assert.ok(checkScan(item, wrongPage).some(issue => issue.includes("Invalid/stale")));
  documentStage.required[0]!.locators![0]!.page = 2;
  assert.throws(() => grade(results, attempt, review(), true), /page\/visual evidence missing/);
  documentStage.required[0]!.locators![0]!.page = 1;
  const saved = report.findings[0]!.evidence;
  report.findings[0]!.evidence = saved.filter(ref => ref.type !== "visual");
  assert.throws(() => grade(results, attempt, review(), true), /page\/visual evidence missing/);
  report.findings[0]!.evidence = saved;
  await verifyRetainedAssets(directory, results);
  await writeFile(join(directory, inspections[0]!.previewFile!), "changed pixels");
  await assert.rejects(verifyRetainedAssets(directory, results), /Retained evidence changed/);
});

test("Quality: successful execution and exact quotations remain unreviewed; correct paraphrases can pass explicit review", async t => {
  const { results, attempt, events } = await sample(t);
  assert.deepEqual(attempt.issues, []);
  assert.equal(grade(results, attempt).status, "unreviewed");
  assert.match(scorecard(results), /semantics unreviewed/);
  assert.doesNotMatch(scorecard(results), /100%/);
  assert.equal(grade(results, attempt, reviewOf(results, attempt)).status, "passed");
  assert.equal(events.length, 4);
  assert.ok(events.every(event => ["tool_execution_start", "tool_execution_end"].includes((event as { type: string }).type)));
  assert.ok(events.every(event => !("message" in (event as object))));
});

test("Quality: wrong amount, negation and swapped entities fail despite valid quoted evidence and keyword overlap", async t => {
  for (const claim of ["Project Elm budget is EUR 24000.", "Elm and Oak are not separate projects.", "Project Oak has the EUR 240 budget."]) {
    const { results, attempt } = await sample(t, claim);
    assert.equal(attempt.report?.status, "complete");
    assert.deepEqual(attempt.report?.toolErrors, []);
    assert.deepEqual(attempt.issues, []); // Structural quotation checking cannot determine truth.
    assert.equal(grade(results, attempt).status, "unreviewed");
    const relationship = claim.includes("separate");
    const review = reviewOf(results, attempt, { usefulness: 0, notes: "Deliberately false semantic claim.", claims: [{
      text: claim, findings: [1], label: "contradicted", kind: relationship ? "relationship" : "fact", covers: [], critical: true,
      falseConnection: relationship, reason: "The cited source says EUR 240 for Elm and explicitly distinguishes Oak.",
    }] });
    const result = grade(results, attempt, review);
    assert.equal(result.status, "failed");
    assert.equal(result.supported, 0);
    assert.equal(result.claims, 1);
    assert.equal(result.falseConnections, relationship ? 1 : 0);
    review.stages[attempt.key]!.claims[0]!.covers = ["budget"];
    assert.throws(() => grade(results, attempt, review), /Unsupported claims/);
  }
});

test("Quality: stale grades, omitted findings and missing required source evidence cannot get a passing score", async t => {
  const { results, attempt } = await sample(t);
  const missing = reviewOf(results, attempt, { claims: [] });
  assert.throws(() => grade(results, attempt, missing), /Unreviewed findings/);
  const stale = reviewOf(results, attempt);
  stale.stages[attempt.key]!.reportHash = "old";
  assert.throws(() => grade(results, attempt, stale), /Stale report review/);
  stale.resultsHash = "old";
  assert.throws(() => scorecard(results, stale), /different results/);
  const wrongEvidence = structuredClone(results);
  wrongEvidence.cases[0]!.stages[0].required[0]!.paths = ["missing.txt"];
  assert.throws(() => grade(wrongEvidence, attempt, reviewOf(wrongEvidence, attempt)), /supporting source missing/);
  const changed = structuredClone(attempt);
  changed.report!.findings[0]!.evidence[0]!.version = "stale";
  assert.ok(checkScan(oracle, changed).some(issue => issue.startsWith("Invalid/stale/uninspected")));
  const deleted: Case = structuredClone(oracle);
  deleted.stages[0].files = {};
  assert.ok(checkScan(deleted, attempt).some(issue => issue.includes("Removed/unknown source")));
});

test("Quality: empty, failed and cancelled scans do not become quality passes; precision without claims is N/A", async t => {
  const { results, attempt } = await sample(t);
  for (const status of ["failed", "incomplete"] as const) {
    const changed = structuredClone(attempt);
    changed.report!.status = status;
    changed.report!.reasoningPending = true;
    changed.report!.errors = [status === "failed" ? "Inference failed" : "Scan cancelled"];
    changed.issues = checkScan(oracle, changed);
    assert.equal(grade(results, changed).status, "failed");
    assert.ok(changed.issues.includes("Reasoning is unfinished."));
  }
  attempt.report!.findings = [];
  const empty = reviewOf(results, attempt, { claims: [], usefulness: 0, notes: "No useful findings were produced." });
  const graded = grade(results, attempt, empty);
  assert.equal(graded.status, "failed");
  assert.equal(graded.claims, 0);
  assert.deepEqual(graded.missed, ["budget"]);
  assert.match(scorecard(results, empty), /N\/A/);
});

test("Quality: a relationship needs a finding citing both sources; the reviewer cannot synthesize a missing connection", async t => {
  const { results, attempt } = await sample(t);
  // Synthetic report variations test review validation, not model reasoning.
  const extra = structuredClone(attempt.report!.findings[0]!);
  extra.id = "second-finding";
  extra.evidence[0]!.path = "second.txt";
  attempt.report!.findings.push(extra);
  results.cases[0]!.stages[0].required = [{ id: "link", kind: "relationship", description: "A finding links both sources.", paths: ["source.txt", "second.txt"] }];
  const labels = () => reviewOf(results, attempt, { claims: [{ text: "The two sources are connected.", findings: [1, 2],
    kind: "relationship", label: "supported", covers: ["link"], reason: "Synthetic review for checking citation completeness." }] });
  assert.throws(() => grade(results, attempt, labels()), /cite its required sources together/);
  attempt.report!.findings[0]!.evidence.push(structuredClone(extra.evidence[0]!));
  assert.equal(grade(results, attempt, labels()).status, "passed");
});

test("Quality: unchanged cache uses no model or network, preserves findings, and supports an honest unsupported-input status", async t => {
  const { results, attempt, root, stateDir } = await sample(t);
  const cached = await scan(root, { stateDir, stream: () => { throw new Error("Cached scan must not request a model."); } });
  const third: ScanResult = { ...attempt, key: "TEST/1/3", stage: 3, report: cached, networkRequests: 0 };
  assert.deepEqual(checkScan(oracle, third, attempt), []);
  third.networkRequests = 1;
  assert.ok(checkScan(oracle, third, attempt).some(issue => issue.includes("zero-network")));
  const q06 = cases.find(item => item.id === "Q06")!;
  assert.equal(q06.stages[1].expectedStatus, "incomplete");
  results.scans.push(third);
  assert.match(scorecard(results), /review incomplete/);
});

test("Quality runner retains nonzero process results, abrupt interruption diagnostics, and requires a live opt-in", async () => {
  for (const exitCode of [0, 1, 2]) {
    const result = await runProcess(["-e", `console.log(JSON.stringify({error:'retained result',networkRequests:0}));process.exitCode=${exitCode}`], { ...process.env });
    assert.equal(result.exitCode, exitCode);
    assert.equal(result.error, "retained result");
  }
  const interrupted = await runProcess(["-e", "console.error('started');setInterval(()=>{},1000)"], { ...process.env }, 200);
  assert.equal(interrupted.signal, "SIGKILL");
  assert.match(interrupted.stderr, /started/);
  assert.match(interrupted.error!, /No parseable/);
  const denied = await runProcess(["tests/quality/scan-process.ts"], { ...process.env, FOLDY_LIVE: "0" });
  assert.equal(denied.exitCode, 1);
  assert.match(denied.stderr, /explicit model access/);
  const missingKey = await runProcess(["tests/quality/run.ts"], { ...process.env, FOLDY_LIVE: "1", FOLDY_PROVIDER: "openai",
    FOLDY_MODEL: "gpt-4.1-mini", OPENAI_API_KEY: "" });
  assert.equal(missingKey.exitCode, 1);
  assert.match(missingKey.stderr, /OpenAI benchmarks require OPENAI_API_KEY/);
});

test("Quality fixtures keep oracles outside inputs and include additions, replacement, removal, copies and read continuation", async () => {
  for (const item of [...cases, ...documentCases]) for (let stage = 1; stage <= 2; stage++) {
    const sources = sourcesAt(item, stage);
    const requirements = item.stages[stage - 1]!.required;
    assert.equal(new Set(requirements.map(r => r.id)).size, requirements.length);
    assert.ok(Object.keys(sources).every(path => !path.startsWith("/") && !path.split("/").includes("..")));
    assert.ok(requirements.every(r => r.paths.every(path => path in sources)));
    for (const input of Object.values(sources)) if (typeof input !== "string") {
      assert.equal(hash(await readFile(new URL(`./fixtures/documents/${input.asset}`, import.meta.url))), input.sha256);
    }
  }
  const renewal = cases.find(item => item.id === "Q03")!;
  assert.notEqual(sourcesAt(renewal, 1)["status/current.txt"], sourcesAt(renewal, 2)["status/current.txt"]);
  assert.equal(sourcesAt(renewal, 2)["notes/old-task.txt"], undefined);
  const expense = sourcesAt(cases.find(item => item.id === "Q02")!, 2);
  assert.equal(expense["receipts/receipt.txt"], expense["copies/receipt-copy.txt"]);
  const long = sourcesAt(cases.find(item => item.id === "Q06")!, 2)["notes/long-log.txt"];
  assert.ok(typeof long === "string" && long.length > 4_000);
  assert.equal([...cases, ...documentCases].length * 3, 30);
  const images = documentCases[0]!;
  assert.notDeepEqual(sourcesAt(images, 1)["images/a.png"], sourcesAt(images, 2)["images/a.png"]);
});
