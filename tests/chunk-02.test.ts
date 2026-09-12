import assert from "node:assert/strict";
import { execFile, fork } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { chmod, cp, mkdir, readFile, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { inventoryFolder, MAX_ENTRIES, READ_CHARACTERS } from "../src/inventory.ts";
import { ANALYSIS_REVISION } from "../src/model.ts";
import { scan } from "../src/scan.ts";
import { call, finding, fixture, read, scripted, toolResult, tree } from "./helpers.ts";

beforeEach(t => {
  assert.ok("mock" in t);
  t.mock.method(globalThis, "fetch", () => { throw new Error("Offline test made a network request."); });
});
const databasePath = (root: string, stateDir: string) => join(stateDir, createHash("sha256").update(root).digest("hex"), "foldy.sqlite");
const childScript = fileURLToPath(new URL("support/scan-process.ts", import.meta.url));
const fixturePath = (batch: number) => fileURLToPath(new URL(`fixtures/cross-file/batch-${batch}/`, import.meta.url));
const forbidden = scripted(() => { throw new Error("Unchanged scan contacted the model."); });
const inspect = (path: string, quote: string) => scripted((_context, index) => [[read(path)], [finding(path, quote)], []][index]!);

test("CTX-01: a validated replacement retires the old finding, retains history and rejects invalid targets", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "note.txt"), "Reserve room Cedar.");
  const first = await scan(root, { stateDir, stream: inspect("note.txt", "Reserve room Cedar.") });
  const original = first.findings[0]!;
  const replace = (quote: string, target = original.id) => call("record_finding", { claim: "The note requests reserving room Cedar.",
    kind: "observed", evidence: [{ path: "note.txt", quote }], replacesFindingId: target });
  const second = await scan(root, { stateDir, model: "changed-tag", stream: scripted((_context, n) => [
    [read("note.txt")], [replace("Cedar is reserved.")], [replace("Reserve room Cedar.", "unknown")],
    [replace("Reserve room Cedar.")], [],
  ][n]) });
  assert.equal(second.toolErrors.length, 2);
  assert.equal(second.findings.length, 1);
  assert.notEqual(second.findings[0]!.id, original.id);
  assert.deepEqual(query(root, stateDir, "SELECT current FROM findings ORDER BY rowid"), [{ current: 0 }, { current: 1 }]);
  const cached = await scan(root, { stateDir, model: "changed-tag", stream: forbidden });
  assert.deepEqual(cached.findings, second.findings);
  assert.equal(cached.cached, true);
});

function query(root: string, stateDir: string, sql: string) {
  const db = new DatabaseSync(databasePath(root, stateDir), { readOnly: true });
  try { return db.prepare(sql).all().map(row => ({ ...row })); }
  finally { db.close(); }
}

async function childScan(root: string, stateDir: string, mode: string) {
  const { stdout } = await promisify(execFile)(process.execPath, [childScript, mode, root], {
    env: { ...process.env, FOLDY_STATE_DIR: stateDir }, timeout: 15_000, maxBuffer: 1_000_000,
  });
  return JSON.parse(stdout) as Awaited<ReturnType<typeof scan>>;
}

test("A03/A04: fresh processes retrieve earlier evidence, keep near-matches separate, and cache the third scan", async t => {
  const { root, stateDir } = await fixture(t);
  await cp(fixturePath(1), root, { recursive: true });
  const first = await childScan(root, stateDir, "first");
  assert.equal(first.status, "complete");
  await cp(fixturePath(2), root, { recursive: true });
  const before = await tree(root);
  const second = await childScan(root, stateDir, "second");
  assert.equal(second.status, "complete");
  const connection = second.findings.find(finding => finding.evidence.length === 2)!;
  assert.deepEqual(connection.evidence.map(ref => ref.path).sort(), ["archive/plan.md", "meetings/notes.txt"]);
  assert.equal(connection.evidence[0]!.sourceId, first.files.find(source => source.path === "archive/plan.md")!.sourceId);
  assert.ok(second.findings.some(finding => finding.id === first.findings[0]!.id));
  const counts = query(root, stateDir, "SELECT (SELECT count(*) FROM sources) AS sources, (SELECT count(*) FROM versions) AS versions, (SELECT count(*) FROM findings) AS findings");
  const third = await childScan(root, stateDir, "cached");
  assert.equal(third.cached, true);
  assert.equal(third.modelCalls, 0);
  assert.equal(third.toolCalls, 0);
  assert.deepEqual(third.findings, second.findings);
  assert.deepEqual(query(root, stateDir, "SELECT (SELECT count(*) FROM sources) AS sources, (SELECT count(*) FROM versions) AS versions, (SELECT count(*) FROM findings) AS findings"), counts);
  assert.deepEqual(await tree(root), before);
});

test("A03/A04: stable distinct identities, root isolation, exact finding deduplication, and model tag invalidation", async t => {
  const { directory, root, stateDir } = await fixture(t);
  await writeFile(join(root, "a.txt"), "Identical bytes.");
  await writeFile(join(root, "b.txt"), "Identical bytes.");
  const stream = () => scripted((_context, index) => [
    [read("a.txt"), read("b.txt")], [finding("a.txt", "Identical bytes."), finding("b.txt", "Identical bytes."), finding("a.txt", "Identical bytes.")], [],
  ][index]!);
  const first = await scan(root, { stateDir, model: "tag-one", stream: stream() });
  assert.notEqual(first.files[0]!.sourceId, first.files[1]!.sourceId);
  assert.equal(first.findings.length, 2);
  const next = await scan(root, { stateDir, model: "tag-two", stream: stream() });
  assert.equal(next.cached, false);
  assert.deepEqual(next.findings, first.findings);
  await symlink(root, join(directory, "alias"));
  assert.equal((await scan(join(directory, "alias"), { stateDir, model: "tag-two", stream: forbidden })).cached, true);
  const otherRoot = join(directory, "other-root");
  await mkdir(otherRoot);
  await writeFile(join(otherRoot, "a.txt"), "Identical bytes.");
  const other = await scan(otherRoot, { stateDir, stream: inspect("a.txt", "Identical bytes.") });
  assert.notEqual(other.files[0]!.sourceId, first.files[0]!.sourceId);
  assert.equal(other.findings.length, 1);
  assert.equal(query(root, stateDir, "SELECT count(*) AS count FROM versions")[0]!.count, 2);
});

test("A03/CTX-01: a reasoning upgrade migrates old state, keeps history, and revalidates before caching", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "note.txt"), "Previously recorded.");
  const first = await scan(root, { stateDir, stream: inspect("note.txt", "Previously recorded.") });
  const before = await tree(root);
  const db = new DatabaseSync(databasePath(root, stateDir));
  db.exec("ALTER TABLE state DROP COLUMN analysis_revision; ALTER TABLE state DROP COLUMN model_provider; ALTER TABLE versions DROP COLUMN document; DROP TABLE binaries; DROP TABLE document_cache; UPDATE state SET schema_version = 1");
  db.close();
  const failed = await scan(root, { stateDir, stream: scripted(() => "error") });
  assert.equal(failed.rebuildingKnowledge, true);
  assert.equal(failed.cached, false);
  assert.equal(failed.reasoningPending, true);
  assert.deepEqual(failed.findings, [], "Old conclusions stay historical until revalidated, including after a failed upgrade run.");
  assert.equal(query(root, stateDir, "SELECT count(*) AS count FROM findings WHERE current = 0")[0]!.count, 1);
  assert.deepEqual(query(root, stateDir, "SELECT schema_version, analysis_revision FROM state"),
    [{ schema_version: 4, analysis_revision: ANALYSIS_REVISION }]);
  const next = await scan(root, { stateDir, stream: scripted((_context, index) => [
    [finding("note.txt", "Previously recorded.")], // Prior inspection is not a read in this session.
    [read("note.txt")], [finding("note.txt", "Previously recorded.")], [],
  ][index]!) });
  assert.equal(next.toolErrors.length, 1);
  assert.match(next.toolErrors[0]!, /read in this session/);
  assert.equal(next.reasoningPending, false);
  assert.deepEqual(next.findings, first.findings, "Revalidated exact findings reuse their original IDs.");
  assert.equal(next.files[0]!.sourceId, first.files[0]!.sourceId);
  assert.equal((await scan(root, { stateDir, stream: forbidden })).cached, true);
  assert.deepEqual(await tree(root), before);
});

test("A03/RUN-02: completeness can add an omission without resetting the tool budget", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "note.txt"), "First fact. Second fact.");
  const report = await scan(root, { stateDir, stream: scripted((context, index) => {
    if (index === 3) assert.equal(context.messages.filter(message => message.role === "user").length, 1);
    return [[read("note.txt")], [finding("note.txt", "First fact.")], [], [finding("note.txt", "Second fact.")], [read("note.txt")], [finding("note.txt", "Second fact.")], []][index];
  }) });
  assert.equal(report.findings.length, 2);
  assert.equal(report.modelCalls, 7);
  assert.equal(report.toolErrors.length, 1);
  assert.equal(report.reasoningPending, false);
  await writeFile(join(root, "note.txt"), "Changed input.");
  let turns = 0;
  const limited = await scan(root, { stateDir, stream: scripted((_context, index) => {
    turns++;
    if (index === 1) return [];
    return Array.from({ length: index === 0 ? 18 : 3 }, (_, n) => ({ ...read("note.txt"), id: `read-${index}-${n}` }));
  }) });
  assert.equal(turns, 3);
  assert.equal(limited.executedToolCalls, 20);
  assert.equal(limited.toolCalls, 21);
  assert.equal(limited.reasoningPending, true);
});

test("A03/A09: changed, missing, unreadable and reverted sources cannot supply stale current conclusions", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "one.txt"), "Original unique.");
  await writeFile(join(root, "two.txt"), "Supporting unique.");
  const first = await scan(root, { stateDir, stream: scripted((_context, index) => [
    [read("one.txt"), read("two.txt")], [finding("two.txt", "Supporting unique."), call("record_finding", {
      claim: "Original supported connection.", kind: "inferred", uncertainty: "Test relationship.",
      evidence: [{ path: "one.txt", quote: "Original unique." }, { path: "two.txt", quote: "Supporting unique." }],
    })], [],
  ][index]!) });
  await writeFile(join(root, "one.txt"), "Updated distinct.");
  const changed = await scan(root, { stateDir, stream: scripted((context, index) => {
    if (index === 0) return [call("search_context", { query: "Original" }), finding("one.txt", "Original unique."), read("one.txt")];
    if (index === 1) {
      assert.deepEqual(toolResult(context, "search_context").results, []);
      return [finding("one.txt", "Updated distinct.")];
    }
    return [];
  }) });
  assert.equal(changed.files[0]!.sourceId, first.files[0]!.sourceId);
  assert.equal(changed.toolErrors.length, 1);
  assert.ok(!changed.findings.some(finding => finding.claim.includes("Original")));
  await rm(join(root, "two.txt"));
  const missing = await scan(root, { stateDir, stream: scripted(() => []) });
  assert.equal(missing.findings.length, 1);
  assert.equal(query(root, stateDir, "SELECT present FROM sources WHERE path = 'two.txt'")[0]!.present, 0);
  await chmod(join(root, "one.txt"), 0);
  const unreadable = await scan(root, { stateDir, stream: forbidden });
  assert.equal(unreadable.status, "incomplete");
  assert.deepEqual(unreadable.findings, []);
  await chmod(join(root, "one.txt"), 0o600);
  await writeFile(join(root, "one.txt"), "Original unique.");
  const reverted = await scan(root, { stateDir, stream: scripted(() => []) });
  assert.deepEqual(reverted.findings, [], "Reverting bytes cannot reactivate an old finding without validation.");
  assert.equal(query(root, stateDir, "SELECT count(*) AS count FROM versions")[0]!.count, 3);
  assert.equal(query(root, stateDir, "SELECT count(*) AS count FROM findings WHERE current = 0")[0]!.count, 3);
});

test("A03/A08: incomplete enumeration hides unverified knowledge without deleting source identities", async t => {
  const { root, stateDir } = await fixture(t);
  await mkdir(join(root, "z"));
  await writeFile(join(root, "z", "plan.txt"), "Known plan.");
  const first = await scan(root, { stateDir, stream: inspect("z/plan.txt", "Known plan.") });
  await chmod(join(root, "z"), 0);
  const inaccessible = await scan(root, { stateDir, stream: forbidden });
  assert.equal(inaccessible.reasoningPending, true);
  assert.deepEqual(inaccessible.findings, []);
  assert.equal(query(root, stateDir, "SELECT present FROM sources WHERE path = 'z/plan.txt'")[0]!.present, 1);
  await chmod(join(root, "z"), 0o700);
  for (let index = 0; index <= MAX_ENTRIES; index++) await writeFile(join(root, `a-${index}.bin`), "unsupported");
  const truncated = await scan(root, { stateDir, stream: forbidden });
  assert.equal(truncated.reasoningPending, true);
  assert.deepEqual(truncated.findings, []);
  const saved = query(root, stateDir, "SELECT id, present, verified FROM sources WHERE path = 'z/plan.txt'")[0]!;
  assert.deepEqual(saved, { id: first.files.find(source => source.path === "z/plan.txt")!.sourceId, present: 1, verified: 0 });
  for (let index = 0; index <= MAX_ENTRIES; index++) await rm(join(root, `a-${index}.bin`));
  const retried = await scan(root, { stateDir, stream: inspect("z/plan.txt", "Known plan.") });
  assert.equal(retried.findings[0]!.id, first.findings[0]!.id);
  const unavailable = join(root, "..", "root-away");
  await rename(root, unavailable);
  await assert.rejects(scan(root, { stateDir, stream: forbidden }), /ENOENT/);
  assert.equal(query(root, stateDir, "SELECT present FROM sources WHERE path = 'z/plan.txt'")[0]!.present, 1);
  await rename(unavailable, root);
  await rename(join(root, "z", "plan.txt"), join(root, "renamed.txt"));
  const renamed = await scan(root, { stateDir, stream: inspect("renamed.txt", "Known plan.") });
  assert.notEqual(renamed.files.find(source => source.path === "renamed.txt")!.sourceId, saved.id);
});

test("A03/A06: partial inspection is durable; search snippets do not authorize unseen quotations", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "long.txt"), "Visible.\n" + "x".repeat(READ_CHARACTERS - 20) + "BOUNDARY:" + "y".repeat(80) + " Unseen tail.");
  const first = await scan(root, { stateDir, stream: inspect("long.txt", "Visible.") });
  assert.equal(first.files[0]!.inspection, "partial");
  assert.equal(first.reasoningPending, true);
  const next = await scan(root, { stateDir, stream: scripted((_context, index) => [
    [call("search_context", { query: "Unseen tail." }), finding("long.txt", "Unseen tail.")],
    [read("long.txt", READ_CHARACTERS)], [finding("long.txt", "Unseen tail."), finding("long.txt", "BOUNDARY:yyyyyyyyyy")],
    [read("long.txt")], [finding("long.txt", "BOUNDARY:yyyyyyyyyy")], [],
  ][index]!) });
  assert.equal(next.cached, false);
  assert.equal(next.toolErrors.length, 2, "A quote spanning an old inspection and a fresh read needs both excerpts read again.");
  assert.equal(next.files[0]!.inspection, "full");
  assert.equal(next.reasoningPending, false);
  assert.equal(next.findings.length, 3);
  assert.equal(next.files[0]!.inspected.length, 1);
  assert.equal((await scan(root, { stateDir, stream: forbidden })).cached, true);
});

test("A06/CTX-01: rewritten and elided quotes are rejected; separated exact passages can recover", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "note.txt"), "Opening fact.\nLiteral marker: ...\nMiddle detail.\nClosing fact.\n");
  const before = await tree(root);
  const report = await scan(root, { stateDir, stream: scripted((_context, index) => [
    [read("note.txt")],
    [finding("note.txt", "The opening fact."), finding("note.txt", "Opening fact. ... Closing fact.")],
    [call("record_finding", {
      claim: "The note contains opening and closing facts, plus a literal ellipsis marker.", kind: "observed",
      evidence: ["Opening fact.", "Closing fact.", "Literal marker: ..."].map(quote => ({ path: "note.txt", quote })),
    })], [],
  ][index]) });
  assert.equal(report.toolErrors.length, 2);
  assert.ok(report.toolErrors.every(error => error.includes("does not exactly match")));
  assert.equal(report.status, "complete");
  assert.equal(report.reasoningPending, false);
  assert.equal(report.findings.length, 1, "Rejected attempts do not create saved findings.");
  assert.deepEqual(report.findings[0]!.evidence.map(ref => { assert.ok(ref.type !== "visual"); return ref.quote; }), ["Opening fact.", "Closing fact.", "Literal marker: ..."]);
  assert.equal((await scan(root, { stateDir, stream: forbidden })).cached, true);
  assert.deepEqual(await tree(root), before);
});

test("RUN-02: rejected finding writes cannot complete or cache without an accepted result", async t => {
  for (const existingFinding of [false, true]) {
    const { root, stateDir } = await fixture(t);
    await writeFile(join(root, "note.md"), "A **verified** detail.");
    const first = await scan(root, { stateDir, stream: scripted((_context, n) =>
      n === 0 ? [read("note.md")] : n === 1 && existingFinding ? [finding("note.md", "A **verified** detail.")] : []) });
    const rejected = await scan(root, { stateDir, model: "retry-test", stream: scripted((_context, n) => [
      [read("note.md")], [finding("note.md", "A verified detail.")], [],
      [read("note.md")], [finding("note.md", "A verified detail.")], [],
    ][n]) });
    assert.equal(rejected.files[0]!.inspection, "full");
    assert.equal(rejected.status, "incomplete");
    assert.equal(rejected.reasoningPending, true);
    assert.deepEqual(rejected.findingWrites, { accepted: 0, rejected: 2 });
    assert.match(rejected.errors.join(" "), /No finding write succeeded/);
    assert.deepEqual(rejected.findings, first.findings, "Existing knowledge cannot conceal this run's rejected work.");
    assert.equal(query(root, stateDir, "SELECT pending FROM state")[0]!.pending, 1);
    const retried = await scan(root, { stateDir, model: "retry-test", stream: inspect("note.md", "A **verified** detail.") });
    assert.equal(retried.cached, false);
    assert.equal(retried.reasoningPending, false);
    assert.equal(retried.status, "complete");
    assert.equal(retried.findings.length, 1);
    assert.equal(retried.files[0]!.sourceId, first.files[0]!.sourceId);
    assert.equal((await scan(root, { stateDir, model: "retry-test", stream: forbidden })).cached, true);
  }
});

test("CTX-01: text references preserve exact Markdown and cannot transfer between sources or sessions", async t => {
  const { root, stateDir } = await fixture(t);
  const contents = '# Notes\r\nKeep **class_name** and `self.value` unchanged.\r\n[Link](https://example.test/a_b) — “quoted” text.\r\n'.repeat(30);
  await writeFile(join(root, "a.md"), contents);
  await writeFile(join(root, "b.md"), contents);
  const before = await tree(root);
  let textRef = "";
  const cite = (path = "a.md", reference = textRef, quote?: string) => call("record_finding", {
    claim: "The notes request keeping class_name and self.value unchanged.", kind: "observed",
    evidence: [{ path, textRef: reference, ...(quote ? { quote } : {}) }],
  });
  const first = await scan(root, { stateDir, stream: scripted((context, n) => {
    if (n === 1) {
      const excerpt = toolResult(context, "read_file");
      assert.ok(excerpt.text.length > 2_000);
      assert.equal(excerpt.text, contents);
      assert.ok(excerpt.textRef);
      textRef = excerpt.textRef;
    }
    return [
      [read("a.md")],
      [cite("b.md"), cite("a.md", "invented"), cite("a.md", textRef, "Keep **class_name**")],
      [cite(), read("b.md")], [],
      [cite()], // The review is a fresh session, so the reference has expired.
      [read("a.md")],
      n === 6 ? [cite("a.md", toolResult(context, "read_file").textRef)] : [], [],
    ][n];
  }) });
  assert.equal(first.status, "complete", JSON.stringify(first.errors));
  assert.equal(first.toolErrors.length, 4);
  assert.equal(first.findings.length, 1, "The same original evidence keeps the finding ID across sessions.");
  const evidence = first.findings[0]!.evidence[0]!;
  assert.ok(evidence.type !== "visual");
  assert.equal(evidence.quote, contents);
  assert.equal(evidence.start, 0);
  assert.equal(evidence.end, contents.length);
  assert.equal((await scan(root, { stateDir, stream: forbidden })).cached, true);
  assert.deepEqual(await tree(root), before);

  await writeFile(join(root, "a.md"), "A changed **source**.");
  const changed = await scan(root, { stateDir, stream: scripted((context, n) => {
    if (n === 0) return [cite()];
    if (n === 1) return [read("a.md")];
    if (n === 2) return [call("record_finding", { claim: "The source changed.", kind: "observed",
      evidence: [{ path: "a.md", textRef: toolResult(context, "read_file").textRef }] })];
    return [];
  }) });
  assert.equal(changed.toolErrors.length, 1);
  assert.match(changed.toolErrors[0]!, /textRef/);
  assert.equal(changed.status, "complete");
  assert.equal(changed.findings.length, 1);
  assert.notEqual(changed.findings[0]!.id, first.findings[0]!.id);
  assert.equal(changed.files[0]!.sourceId, first.files[0]!.sourceId);
});

test("A03/A06/RUN-02: failure and controlled cancellation commit valid findings and force a retry", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "note.txt"), "Valid before failure.");
  const failed = await scan(root, { stateDir, stream: scripted((_context, index) =>
    index === 0 ? [read("note.txt")] : index === 1 ? [finding("note.txt", "Valid before failure.")] : "error") });
  assert.equal(failed.status, "failed");
  assert.equal(failed.findings.length, 1);
  assert.equal(failed.reasoningPending, true);
  const controller = new AbortController();
  const cancelled = await scan(root, { stateDir, signal: controller.signal, stream: scripted(() => {
    controller.abort(new Error("User cancelled.")); return [];
  }) });
  assert.equal(cancelled.cached, false);
  assert.equal(cancelled.status, "incomplete");
  assert.equal(cancelled.reasoningPending, true);
  assert.deepEqual(cancelled.findings, failed.findings);
  const retried = await scan(root, { stateDir, stream: scripted(() => []) });
  assert.equal(retried.cached, false);
  assert.equal(retried.reasoningPending, false);
  assert.deepEqual(retried.findings, failed.findings);
  assert.equal((await scan(root, { stateDir, stream: forbidden })).cached, true);
});

test("A03/A06: unsupported inputs stay visible without repeated inference; literal search has ten-result pages", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "note.txt"), "Keep 100%_literal.");
  await writeFile(join(root, "scan.bin"), "unsupported");
  const first = await scan(root, { stateDir, stream: inspect("note.txt", "Keep 100%_literal.") });
  assert.equal(first.status, "incomplete");
  assert.equal(first.reasoningPending, false);
  const cached = await scan(root, { stateDir, stream: forbidden });
  assert.equal(cached.cached, true);
  assert.equal(cached.files.find(source => source.path === "scan.bin")!.status, "unsupported");
  await mkdir(join(root, "new-folder"));
  await writeFile(join(root, "another.bin"), "new unsupported input");
  const added = await scan(root, { stateDir, stream: scripted(() => []) });
  assert.equal(added.cached, false, "New entries supply context once, even when their contents cannot be inspected.");
  assert.equal((await scan(root, { stateDir, stream: forbidden })).cached, true);
  for (let index = 0; index < 12; index++) await writeFile(join(root, `extra-${index}.txt`), "needle ".repeat(100));
  const searched = await scan(root, { stateDir, stream: scripted((context, index) => {
    if (index === 0) return [call("search_context", { query: "needle" })];
    if (index > 4) return [];
    const page = toolResult(context, "search_context");
    if (index === 1) {
      assert.equal(page.results.length, 10);
      assert.equal(page.nextOffset, 10);
      assert.ok(page.results.every((hit: { snippet: string }) => hit.snippet.length <= 240));
      return [call("search_context", { query: "needle", offset: page.nextOffset })];
    }
    if (index === 2) {
      assert.equal(page.results.length, 2); assert.equal(page.nextOffset, null);
      return [call("search_context", { query: "%_literal" })];
    }
    if (index === 3) {
      assert.equal(page.results.length, 2, "One current finding and its source match literally.");
      return [call("search_context", { query: "' OR 1=1 --" })];
    }
    assert.deepEqual(page.results, []);
    return [];
  }) });
  assert.deepEqual(searched.errors, []);
  assert.deepEqual(searched.toolErrors, []);
});

test("A01/A03: state is private, outside the root, and existing databases are validated without reset", async t => {
  const { directory, root, stateDir } = await fixture(t);
  await writeFile(join(root, "note.txt"), "Private state.");
  const before = await tree(root);
  await assert.rejects(scan(root, { stateDir: join(root, "state"), stream: forbidden }), /outside/);
  await symlink(root, join(directory, "state-alias"));
  await assert.rejects(scan(root, { stateDir: join(directory, "state-alias", "new"), stream: forbidden }), /outside/);
  assert.deepEqual(await tree(root), before);
  await assert.rejects(inventoryFolder(join(directory, "state-alias"), new AbortController().signal, join(directory, "state-alias")), /root changed/);
  await scan(root, { stateDir, stream: inspect("note.txt", "Private state.") });
  const path = databasePath(root, stateDir);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal((await stat(join(path, ".."))).mode & 0o777, 0o700);
  for (const update of ["UPDATE state SET schema_version = 999", "UPDATE state SET schema_version = 1, root = 'wrong-root'"]) {
    const db = new DatabaseSync(path); db.exec(update); db.close();
    await assert.rejects(scan(root, { stateDir, stream: forbidden }), /root or schema/);
    assert.equal(query(root, stateDir, "SELECT count(*) AS count FROM findings")[0]!.count, 1);
  }
  await writeFile(path, "corrupt database");
  await assert.rejects(scan(root, { stateDir, stream: forbidden }), /database/);
  assert.equal(await readFile(path, "utf8"), "corrupt database");
});

test("A03: storage failures inside tools fail visibly and roll back instead of pretending completion", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "note.txt"), "Keep saved knowledge.");
  const first = await scan(root, { stateDir, stream: inspect("note.txt", "Keep saved knowledge.") });
  await writeFile(join(root, "note.txt"), "New version.");
  let breakReads = false;
  const prepare = DatabaseSync.prototype.prepare;
  const mock = t.mock.method(DatabaseSync.prototype, "prepare", function (this: DatabaseSync, sql: string) {
    if (breakReads && sql.startsWith("SELECT text, inspected")) throw new Error("Simulated database I/O failure.");
    return prepare.call(this, sql);
  });
  await assert.rejects(scan(root, { stateDir, stream: scripted(() => { breakReads = true; return [read("note.txt")]; }) }), /database I\/O/);
  mock.mock.restore();
  assert.equal(query(root, stateDir, "SELECT count(*) AS count FROM versions")[0]!.count, 1);
  assert.equal(JSON.parse(query(root, stateDir, "SELECT data FROM findings WHERE current = 1")[0]!.data as string).id, first.findings[0]!.id);
});

test("A03/A08: overlapping scans are refused; abrupt termination rolls back and preserves committed knowledge", { timeout: 20_000 }, async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "draft.txt"), "Previously committed.");
  const first = await scan(root, { stateDir, stream: inspect("draft.txt", "Previously committed.") });
  await writeFile(join(root, "draft.txt"), "Uncommitted change.");
  const child = fork(childScript, ["hold", root], { env: { ...process.env, FOLDY_STATE_DIR: stateDir }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); });
  let stderr = "";
  child.stderr!.on("data", data => { stderr += data; });
  const ready = await Promise.race([once(child, "message"), once(child, "exit").then(() => { throw new Error(stderr || "Child exited before holding transaction."); })]);
  assert.equal(ready[0], "holding");
  await assert.rejects(scan(root, { stateDir, stream: forbidden }), /already writing.*SQLite busy/);
  await writeFile(join(root, "draft.txt"), "External edit during scan.");
  const exit = once(child, "exit"); child.kill("SIGKILL"); await exit;
  assert.equal(query(root, stateDir, "SELECT count(*) AS count FROM versions")[0]!.count, 1);
  assert.equal(JSON.parse(query(root, stateDir, "SELECT data FROM findings WHERE current = 1")[0]!.data as string).id, first.findings[0]!.id);
  const retried = await scan(root, { stateDir, stream: inspect("draft.txt", "External edit during scan.") });
  assert.equal(retried.status, "complete");
  assert.equal(retried.findings.length, 1);
  assert.equal(retried.findings[0]!.claim, "External edit during scan.");
});
