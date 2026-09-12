import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sourcesAt } from "./cases.ts";
import { hash, type Results, type ScanResult } from "./harness.ts";

export interface ClaimReview {
  text: string;
  /** One-based finding numbers in the hash-bound report; combine semantic duplicates. */
  findings: number[];
  label: "supported" | "contradicted" | "insufficient";
  kind: "fact" | "relationship" | "uncertainty";
  covers: string[];
  reason: string;
  critical?: boolean;
  falseConnection?: boolean;
}
export interface StageReview {
  reportHash: string;
  claims: ClaimReview[];
  usefulness: 0 | 1 | 2;
  notes: string;
}
export interface Review {
  reviewer: string;
  resultsHash: string;
  stages: Record<string, StageReview>;
}

export function grade(results: Results, scan: ScanResult, review?: Review, strict = false) {
  const item = results.cases.find(item => item.id === scan.caseId)!;
  const required = item.stages[Math.min(scan.stage, 2) - 1]!.required;
  const entry = review?.stages[scan.key];
  const base = { key: scan.key, supported: 0, claims: 0, facts: 0, factTotal: required.filter(r => r.kind === "fact").length,
    links: 0, linkTotal: required.filter(r => r.kind === "relationship").length,
    uncertainty: 0, uncertaintyTotal: required.filter(r => r.kind === "uncertainty").length,
    falseConnections: 0, repetitions: 0, usefulness: null as number | null, missed: required.map(r => r.id) };
  if (!entry || !scan.report) return { ...base, status: scan.issues.length ? "failed" : "unreviewed" };
  assert.equal(review!.resultsHash, hash(results), "Review belongs to different results; do not reuse stale grades.");
  assert.ok(review!.reviewer.trim(), "Name the reviewer and whether it is a person or an assistant.");
  assert.equal(entry.reportHash, hash(scan.report), `Stale report review: ${scan.key}`);
  assert.ok([0, 1, 2].includes(entry.usefulness) && entry.notes.trim(), `Missing usefulness/review explanation: ${scan.key}`);
  const coveredFindings = new Set<number>(), covered = new Set<string>();
  for (const claim of entry.claims) {
    assert.ok(claim.text.trim() && claim.reason.trim() && claim.findings.length, `Incomplete claim review: ${scan.key}`);
    assert.ok(["supported", "contradicted", "insufficient"].includes(claim.label), "Unknown semantic label.");
    assert.ok(["fact", "relationship", "uncertainty"].includes(claim.kind), "Unknown claim kind.");
    assert.equal(new Set(claim.findings).size, claim.findings.length, "Repeated finding number in a claim.");
    for (const index of claim.findings) {
      assert.ok(Number.isInteger(index) && index >= 1 && index <= scan.report.findings.length, "Review references an unknown finding.");
      coveredFindings.add(index);
    }
    if (claim.falseConnection) assert.ok(claim.label !== "supported", "A forbidden/unsupported connection cannot be supported.");
    for (const id of claim.covers) {
      const requirement = required.find(r => r.id === id);
      assert.ok(requirement, `Unknown requirement ${id}: ${scan.key}`);
      assert.equal(claim.label, "supported", "Unsupported claims cannot receive coverage credit.");
      // These checks only validate the review's references. Entailment is the reviewer's job.
      const paths = new Set(claim.findings.flatMap(index => scan.report!.findings[index - 1]!.evidence.map(ref => ref.path)));
      assert.ok(requirement.paths.every(path => paths.has(path)), `Required supporting source missing for ${id}: ${scan.key}`);
      if (requirement.kind === "relationship") assert.ok(claim.findings.some(index => {
        const cited = new Set(scan.report!.findings[index - 1]!.evidence.map(ref => ref.path));
        return requirement.paths.every(path => cited.has(path));
      }), `A relationship must cite its required sources together: ${id}: ${scan.key}`);
      if (requirement.locators) assert.ok(claim.findings.some(index => {
        const refs = scan.report!.findings[index - 1]!.evidence;
        return requirement.locators!.every(locator => refs.some(ref => ref.path === locator.path &&
          (locator.page === undefined || ref.page === locator.page) && (!locator.visual || ref.type === "visual"))) &&
          (requirement.kind !== "relationship" || requirement.paths.every(path => refs.some(ref => ref.path === path)));
      }), `Required page/visual evidence missing for ${id}: ${scan.key}`);
      covered.add(id);
    }
  }
  assert.equal(coveredFindings.size, scan.report.findings.length, `Unreviewed findings remain in ${scan.key}`);
  const claims = entry.claims.length;
  const supported = entry.claims.filter(c => c.label === "supported").length;
  const falseConnections = entry.claims.filter(c => c.falseConnection || (c.kind === "relationship" && c.label !== "supported")).length;
  const missed = required.filter(r => !covered.has(r.id)).map(r => r.id);
  const pass = !(results.manifest.codeChangesDuringRun as string[] | undefined)?.length && !scan.issues.length && !missed.length && !falseConnections &&
    !entry.claims.some(c => c.critical && c.label !== "supported") && entry.usefulness > 0 && (!strict || supported === claims);
  return { ...base, status: pass ? "passed" : "failed", supported, claims, falseConnections, missed,
    facts: required.filter(r => r.kind === "fact" && covered.has(r.id)).length,
    links: required.filter(r => r.kind === "relationship" && covered.has(r.id)).length,
    uncertainty: required.filter(r => r.kind === "uncertainty" && covered.has(r.id)).length,
    repetitions: entry.claims.reduce((sum, claim) => sum + claim.findings.length - 1, 0), usefulness: entry.usefulness };
}

function timing(values: number[]) {
  if (!values.length) return "N/A";
  const sorted = values.toSorted((a, b) => a - b);
  const median = (sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.ceil((sorted.length - 1) / 2)]!) / 2;
  return `${(median / 1_000).toFixed(2)} [${(sorted[0]! / 1_000).toFixed(2)}–${(sorted.at(-1)! / 1_000).toFixed(2)}]`;
}
const ratio = (n: number, d: number) => d ? `${n}/${d} (${Math.round(100 * n / d)}%)` : "N/A";

export function scorecard(results: Results, review?: Review, strict = false): string {
  if (review) assert.equal(review.resultsHash, hash(results), "Review belongs to different results.");
  const graded = results.scans.filter(scan => scan.stage <= 2).map(scan => grade(results, scan, review, strict));
  const lines = ["# Foldy quality benchmark", "", `Model: ${results.manifest.modelTag}. Base commit: ${results.manifest.commit}; evaluated working-tree code is saved in source-snapshot.json.`, "",
    `Run ${results.finished ? "finished" : "unfinished"}: ${results.scans.length}/${results.cases.length * results.trials * 3} scans. Reviewer: ${review?.reviewer ?? "none — semantics unreviewed"}.`, "",
    ...((results.manifest.codeChangesDuringRun as string[] | undefined)?.length
      ? [`INVALID COLLECTION: evaluated code changed during this run: ${(results.manifest.codeChangesDuringRun as string[]).join(", ")}.`, ""] : []),
    (strict ? "STRICT: every reviewed claim, including uncertainty, must be supported. " : "") + "Pass requires both staged scans to meet their oracle, no critical unsupported claims/false connections, valid sources, finished reasoning, unchanged source bytes, and a zero-network cache probe. Assistant grading is provisional until independently checked by a person.", "",
    "| Case | Trial passes | Supported claims | Required facts | Required links | Uncertainty | Unsupported links | Repetitions | Usefulness (0–2) |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const item of results.cases) {
    const rows = graded.filter(row => row.key.startsWith(item.id + "/"));
    const sum = (key: "supported" | "claims" | "facts" | "factTotal" | "links" | "linkTotal" | "uncertainty" | "uncertaintyTotal" | "falseConnections" | "repetitions") => rows.reduce((n, row) => n + row[key], 0);
    let passes = 0;
    for (let trial = 1; trial <= results.trials; trial++) {
      const stages = rows.filter(row => row.key.startsWith(`${item.id}/${trial}/`));
      const cache = results.scans.find(scan => scan.key === `${item.id}/${trial}/3`);
      if (stages.length === 2 && stages.every(row => row.status === "passed") && cache && !cache.issues.length) passes++;
    }
    const reviewed = rows.filter(row => row.usefulness !== null).length;
    lines.push(`| ${item.id} ${item.title} | ${passes}/${results.trials}${reviewed < results.trials * 2 ? " (review incomplete)" : ""} | ${reviewed ? ratio(sum("supported"), sum("claims")) : "unreviewed"} | ${reviewed ? ratio(sum("facts"), sum("factTotal")) : "unreviewed"} | ${reviewed ? ratio(sum("links"), sum("linkTotal")) : "unreviewed"} | ${reviewed ? ratio(sum("uncertainty"), sum("uncertaintyTotal")) : "unreviewed"} | ${reviewed ? sum("falseConnections") : "?"} | ${reviewed ? sum("repetitions") : "?"} | ${rows.filter(row => row.usefulness !== null).map(row => row.usefulness).join(", ") || "unreviewed"} |`);
  }
  const live = results.scans.filter(scan => scan.stage <= 2), cache = results.scans.filter(scan => scan.stage === 3);
  lines.push("", "Times are seconds: median [min–max]. Stages are paired within trials; cached scans are not additional reasoning trials.", "",
    "| Case | Stage 1 wall | Stage 2 wall | Cache wall | Model calls (live) | Tool calls (live) | Tool errors |", "| --- | --- | --- | --- | --- | --- | --- |",
    ...results.cases.map(item => {
      const scans = results.scans.filter(scan => scan.caseId === item.id);
      const reasoning = scans.filter(scan => scan.stage <= 2);
      return `| ${item.id} | ${timing(scans.filter(s => s.stage === 1).map(s => s.wallMs))} | ${timing(scans.filter(s => s.stage === 2).map(s => s.wallMs))} | ${timing(scans.filter(s => s.stage === 3).map(s => s.wallMs))} | ${reasoning.reduce((n, s) => n + (s.report?.modelCalls ?? 0), 0)} | ${reasoning.reduce((n, s) => n + (s.report?.toolCalls ?? 0), 0)} | ${reasoning.reduce((n, s) => n + (s.report?.toolErrors.length ?? 0), 0)} |`;
    }), "",
    "Agent token counts exclude model preflight and Pi's compaction calls. Recovered tool errors are recorded separately from semantic failures. Coverage counts are per source/page in each reasoning scan, not unique documents across the run.", "",
    "| Case | Input / output tokens | Extraction jobs | Extraction seconds | Fully inspected files | Delivered visual pages / known pages |",
    "| --- | --- | --- | --- | --- | --- |",
    ...results.cases.map(item => {
      const reports = live.filter(scan => scan.caseId === item.id && scan.report).map(scan => scan.report!);
      const files = reports.flatMap(report => report.files.filter(file => file.kind === "file"));
      const documents = files.filter(file => file.document);
      const visualPages = documents.reduce((n, file) => n + Object.values(file.document!.pages).filter(page => page.visual).length, 0);
      return `| ${item.id} | ${reports.reduce((n, r) => n + (r.agentUsage?.inputTokens ?? 0), 0)} / ${reports.reduce((n, r) => n + (r.agentUsage?.outputTokens ?? 0), 0)} | ${reports.reduce((n, r) => n + (r.processing?.jobs ?? 0), 0)} | ${(reports.reduce((n, r) => n + (r.processing?.extractionMs ?? 0), 0) / 1000).toFixed(2)} | ${files.filter(file => file.inspection === "full").length}/${files.length} | ${visualPages}/${documents.reduce((n, file) => n + (file.document!.pageCount ?? 0), 0)} |`;
    }), "",
    `Expected-status, finished-reasoning live scans: ${live.filter(s => !s.issues.length).length}/${live.length}. Cache checks: ${cache.filter(s => !s.issues.length).length}/${cache.length}.`, "",
    "Q06 deliberately contains an invalid image placeholder (unsupported before phase 03, corrupt in phase 03): honest `incomplete` with no pending readable work is expected. It is not a vision test. Reported runtime status and semantic grades measure different things. Unsupported links include incomplete citations and unsupported inferences; they are not necessarily false entity matches. Precision counts reviewed atomic claim groups; poorly cited repeats are kept separate from supported occurrences.", "", "## Failures and missing outcomes", "");
  let failures = 0;
  for (const scan of results.scans) {
    const row = scan.stage <= 2 ? graded.find(row => row.key === scan.key) : undefined;
    if (scan.issues.length || row?.status === "failed") {
      failures++;
      lines.push(`- **${scan.key}**: ${[...scan.issues, ...(row?.missed.length ? [`Missing: ${row.missed.join(", ")}`] : []),
        ...(review?.stages[scan.key] ? [review.stages[scan.key]!.notes] : [])].join(" ")}`);
    }
  }
  if (!failures) lines.push(review ? "No failures recorded in reviewed outcomes; check review completeness above." : "No structural failures so far. Semantic outcomes have not been graded.");
  lines.push("", "Raw reports and embedded fixtures/oracles: `results.json`. Atomic claim labels: `review.json` when present. Full inspection/review sheet: `review.md`. Per-scan `.jsonl` files contain tool inputs/results, not hidden reasoning.", "");
  return lines.join("\n");
}

export async function writeScorecard(directory: string, results: Results, review?: Review, strict = false) {
  await writeFile(join(directory, strict ? "scorecard-strict.md" : "scorecard.md"), scorecard(results, review, strict));
  const lines = ["# Evidence review", "", "Review the claim AND its uncertainty against cited evidence. Split compound claims, merge equivalent claims (list all finding numbers), and cover every finding. Labels: supported / contradicted / insufficient. An exact quote alone earns no semantic credit. Refer to the oracle; supported extra facts are allowed. Mark wrong dates/amounts/entities and invented approvals as critical. A relationship needs supporting linking evidence. Grade usefulness 0–2; explain each missed outcome and every negative label.", "",
    "The JSON review is bound to resultsHash and per-stage reportHash. `findings` uses one-based numbers from the matching report. `covers` names only requirements fully satisfied with their required sources. Use separate atomic claims for independently true/false parts. Do not auto-label based on keywords. Assistant review must identify itself and remains provisional for human calibration.", ""];
  for (const item of results.cases) {
    lines.push(`## ${item.id} — ${item.title}`, "", "Forbidden: " + item.forbidden.join(" "), "");
    for (let stage = 1; stage <= 2; stage++) {
      lines.push(`### Stage ${stage} oracle`, "", ...item.stages[stage - 1]!.required.map(r => `- ${r.id} (${r.kind}): ${r.description} Sources: ${r.paths.join(", ")}.`), "");
      for (const [path, content] of Object.entries(sourcesAt(item, stage))) {
        lines.push(`#### ${path}`, "");
        if (typeof content === "string") lines.push("```text", content.replaceAll("\u0000", "[NUL]"), "```", "");
        else lines.push(`[Original asset](assets/${content.asset}); SHA-256: ${content.sha256}.`, "");
      }
      for (const scan of results.scans.filter(scan => scan.caseId === item.id && scan.stage === stage)) {
        lines.push(`### ${scan.key}`, "", `Status: ${scan.report?.status ?? "no report"}; reportHash: ${hash(scan.report ?? null)}.`, "", ...scan.issues.map(issue => `- Check failure: ${issue}`));
        scan.report?.findings.forEach((finding, index) => {
          lines.push("", `**F${index + 1} (${finding.id})** ${finding.claim}`, "", `Kind: ${finding.kind}. Uncertainty: ${finding.uncertainty ?? "none"}.`, "");
          for (const ref of finding.evidence) {
            if (ref.type === "visual") {
              const read = scan.inspections?.find(read => read.preview?.hash === ref.preview.hash);
              lines.push(`${ref.path}${ref.page ? ` page ${ref.page}` : ""}: visual evidence, preview ${ref.preview.width}x${ref.preview.height}, hash ${ref.preview.hash}.`, "");
              if (read?.previewFile) lines.push(`![Inspected preview](${read.previewFile})`, "");
            } else lines.push(`${ref.path}${ref.page ? ` page ${ref.page}` : ""}:${ref.startLine} (${ref.version.slice(0, 12)}):`, "```text", ref.quote, "```", "");
          }
        });
        const entry = review?.stages[scan.key];
        if (entry) lines.push("", `Review: ${entry.notes}`, "", ...entry.claims.map(c => `- **${c.label}** F${c.findings.join(",F")}: ${c.text} — ${c.reason} Coverage: ${c.covers.join(", ") || "extra claim"}.`), "");
      }
    }
  }
  await writeFile(join(directory, "review.md"), lines.join("\n"));
}

export async function verifyRetainedAssets(directory: string, results: Results) {
  const assets = new Map<string, string>();
  for (const item of results.cases) for (const stage of item.stages) for (const input of Object.values(stage.files)) {
    if (!input || typeof input === "string") continue;
    assert.match(input.asset, /^[A-Za-z0-9._-]+$/, "Unsafe retained asset path.");
    assets.set(`assets/${input.asset}`, input.sha256);
  }
  for (const scan of results.scans) for (const read of scan.inspections ?? []) if (read.previewFile) {
    assert.match(read.previewFile, /^previews\/[a-f0-9]{64}\.(png|jpg)$/, "Unsafe retained preview path.");
    assert.ok(read.preview, "Retained pixels need preview metadata.");
    assets.set(read.previewFile, read.preview.hash);
  }
  for (const [path, expected] of assets) assert.equal(hash(await readFile(join(directory, path))), expected, `Retained evidence changed: ${path}`);
}

async function load(directory: string) {
  const results: Results = JSON.parse(await readFile(join(directory, "results.json"), "utf8"));
  await verifyRetainedAssets(directory, results);
  let review: Review | undefined;
  try { review = JSON.parse(await readFile(join(directory, "review.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  return { results, review };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const strict = process.argv.includes("--strict");
  const [directory, baseline, ...extra] = process.argv.slice(2).filter(arg => arg !== "--strict");
  assert.ok(directory && !extra.length, "Usage: npm run bench:score -- <run-directory> [baseline-directory] [--strict]");
  const { results, review } = await load(directory);
  await writeScorecard(directory, results, review, strict);
  console.log(scorecard(results, review, strict));
  if (baseline) {
    const prior = await load(baseline);
    assert.equal(results.manifest.casesHash, prior.results.manifest.casesHash, "Fixture/oracle changes are not a like-for-like comparison.");
    assert.equal(results.trials, prior.results.trials, "Compare the same number of trials.");
    const rows = (value: Results, labels?: Review) => value.scans.filter(scan => scan.stage <= 2).map(scan => grade(value, scan, labels, strict));
    const currentRows = rows(results, review), priorRows = rows(prior.results, prior.review);
    const summary = (value: Results, grades: ReturnType<typeof grade>[]) => ({
      reviewedStages: grades.filter(row => row.usefulness !== null).length, passedStages: grades.filter(row => row.status === "passed").length,
      supportedClaims: grades.reduce((sum, row) => sum + row.supported, 0), claims: grades.reduce((sum, row) => sum + row.claims, 0),
      missingRequired: grades.reduce((sum, row) => sum + row.missed.length, 0), falseConnections: grades.reduce((sum, row) => sum + row.falseConnections, 0),
      liveWallMs: value.scans.filter(s => s.stage <= 2).reduce((sum, s) => sum + s.wallMs, 0),
    });
    console.log(JSON.stringify({ comparison: { baseline: summary(prior.results, priorRows), current: summary(results, currentRows),
      baselineModel: prior.results.manifest.modelTag, currentModel: results.manifest.modelTag,
      caution: "Inspect per-case grades and configuration changes. Unreviewed stages are not passes; claims can differ, so totals alone are not comparable accuracy." } }, null, 2));
    console.log("\nPer-case comparison (baseline → current):");
    for (const item of results.cases) {
      const a = priorRows.filter(row => row.key.startsWith(item.id + "/")), b = currentRows.filter(row => row.key.startsWith(item.id + "/"));
      const describe = (rows: typeof a) => `${rows.filter(row => row.status === "passed").length}/${results.trials * 2} staged passes; ` +
        `${ratio(rows.reduce((n, row) => n + row.supported, 0), rows.reduce((n, row) => n + row.claims, 0))} supported; ` +
        `${rows.reduce((n, row) => n + row.missed.length, 0)} missed requirements; ${rows.reduce((n, row) => n + row.falseConnections, 0)} unsupported links`;
      console.log(`${item.id}: ${describe(a)} → ${describe(b)}`);
    }
  }
  const complete = results.finished && review && !(results.manifest.codeChangesDuringRun as string[] | undefined)?.length &&
    results.scans.length === results.cases.length * results.trials * 3;
  process.exitCode = complete && results.scans.every(scan => scan.stage === 3 ? !scan.issues.length : grade(results, scan, review, strict).status === "passed") ? 0 : 1;
}
