import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { type scan } from "../../src/scan.ts";
import { type Case, sourcesAt } from "./cases.ts";

export type Report = Awaited<ReturnType<typeof scan>>;
export const hash = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
export interface ScanResult {
  key: string;
  caseId: string;
  trial: number;
  stage: number;
  report?: Report;
  error?: string;
  networkRequests?: number;
  exitCode: number | string | null;
  signal?: string | null;
  stderr: string;
  wallMs: number;
  sourceBytesUnchanged: boolean;
  issues: string[];
  traceFile: string;
}
export interface Results {
  version: 1;
  manifest: Record<string, unknown>;
  cases: Case[];
  trials: number;
  scans: ScanResult[];
  finished: boolean;
}

// Retain unsuccessful process output too; a nonzero exit must not erase evidence.
export async function runProcess(args: string[], env: NodeJS.ProcessEnv, timeout = 315_000) {
  const start = Date.now();
  let stdout = "", stderr = "", exitCode: number | string | null = 0, signal: string | null = null;
  try {
    ({ stdout, stderr } = await promisify(execFile)(process.execPath, args, { env, timeout, killSignal: "SIGKILL", maxBuffer: 4_000_000 }));
  } catch (caught) {
    const error = caught as { stdout?: string; stderr?: string; code?: number | string; signal?: string; message: string };
    stdout = error.stdout ?? ""; stderr = error.stderr ?? ""; exitCode = error.code ?? null; signal = error.signal ?? null;
    if (!stderr) stderr = error.message;
  }
  let payload: { report?: Report; error?: string; networkRequests?: number };
  try { payload = JSON.parse(stdout); }
  catch { payload = { error: `No parseable scan result. stdout=${stdout.slice(0, 4_000)}` }; }
  return { ...payload, exitCode, signal, stderr, wallMs: Date.now() - start };
}

export function checkScan(item: Case, current: ScanResult, previous?: ScanResult): string[] {
  const issues: string[] = [];
  const report = current.report;
  if (!current.sourceBytesUnchanged) issues.push("Source tree changed during the scan.");
  if (current.error) issues.push(current.error);
  if (!report) return [...issues, "Missing scan report."];
  const files = sourcesAt(item, current.stage);
  const expectedStatus = item.stages[Math.min(current.stage, 2) - 1]!.expectedStatus;
  if (report.status !== expectedStatus) issues.push(`Expected ${expectedStatus}, got ${report.status}.`);
  if (current.exitCode !== (report.status === "complete" ? 0 : report.status === "incomplete" ? 2 : 1)) issues.push("Exit code disagrees with scan status.");
  if (report.reasoningPending) issues.push("Reasoning is unfinished.");
  if (report.errors.length) issues.push(...report.errors.map(error => `Scan error: ${error}`));
  const ids = new Set<string>();
  for (const [path, content] of Object.entries(files)) {
    const source = report.files.find(file => file.path === path);
    if (!source?.sourceId || ids.has(source.sourceId)) issues.push(`Missing or repeated source identity: ${path}.`);
    if (source?.sourceId) ids.add(source.sourceId);
    const earlier = previous?.report?.files.find(file => file.path === path);
    if (earlier && source?.sourceId !== earlier.sourceId) issues.push(`Identity changed at an existing path: ${path}.`);
    if (path.endsWith(".png")) {
      if (source?.status !== "unsupported" || source.inspection !== "none" || !source.reason) issues.push(`Unsupported input misreported: ${path}.`);
    } else {
      if (source?.status !== "ready" || source.version !== hash(content)) issues.push(`Incorrect current source version: ${path}.`);
      if (source?.inspection !== "full" || !source.inspected.some(range => range.start === 0 && range.end === content.length)) {
        issues.push(`Readable input not fully inspected: ${path}.`);
      }
    }
  }
  for (const source of report.files.filter(file => file.kind === "file")) {
    if (!(source.path in files)) issues.push(`Removed/unknown source listed as current: ${source.path}.`);
  }
  for (const finding of report.findings) {
    if (!finding.evidence.length) issues.push(`No evidence: ${finding.id}.`);
    for (const ref of finding.evidence) {
      const text = files[ref.path];
      const source = report.files.find(file => file.path === ref.path);
      if (text === undefined || ref.version !== hash(text) || source?.version !== ref.version || source?.sourceId !== ref.sourceId ||
        !ref.quote.trim() || text.slice(ref.start, ref.end) !== ref.quote ||
        !source.inspected.some(range => ref.start >= range.start && ref.end <= range.end)) issues.push(`Invalid/stale/uninspected evidence: ${finding.id}:${ref.path}.`);
    }
  }
  if (new Set(report.findings.map(finding => finding.id)).size !== report.findings.length) issues.push("Repeated finding IDs.");
  if (current.stage === 3) {
    if (!report.cached || report.modelCalls !== 0 || report.toolCalls !== 0 || report.executedToolCalls !== 0 || current.networkRequests !== 0) issues.push("Unchanged scan was not a zero-network, zero-call cache hit.");
    if (JSON.stringify(report.findings) !== JSON.stringify(previous?.report?.findings)) issues.push("Cached findings changed.");
  } else if (report.cached || report.modelCalls === 0 || !current.networkRequests) issues.push("A staged live scan did not use the local model.");
  return [...new Set(issues)];
}
