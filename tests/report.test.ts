import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { inventoryFolder, type Source } from "../src/inventory.ts";
import { FILE_REPORT_PROMPT, HTML_REPORT_NAME, fileReportEvidence, flatReport, generateFileReport, saveReport } from "../src/report.ts";
import { scan } from "../src/scan.ts";
import type { Finding, TextEvidence } from "../src/store.ts";
import { finding, fixture, read, scripted } from "./helpers.ts";

beforeEach(t => {
  assert.ok("mock" in t);
  t.mock.method(globalThis, "fetch", () => { throw new Error("Offline test made a network request."); });
});

test("report updates preserve unaffected findings and do not invalidate the scan cache", async t => {
  const { root, stateDir } = await fixture(t);
  const inspect = (path: string, quote: string) => scripted((_context, n) => [[read(path)], [finding(path, quote)], []][n]!);
  const publish = async (stream: ReturnType<typeof scripted>) => {
    const report = await scan(root, { stateDir, stream });
    await saveReport(root, JSON.stringify(report));
    assert.deepEqual(JSON.parse(await readFile(join(root, ".foldy.json"), "utf8")), report);
    return report;
  };
  await writeFile(join(root, "a.txt"), "Reserve Cedar.");
  const first = await publish(inspect("a.txt", "Reserve Cedar."));
  await writeFile(join(root, "b.txt"), "Reserve Birch.");
  const second = await publish(inspect("b.txt", "Reserve Birch."));
  assert.ok(second.findings.some(item => item.id === first.findings[0]!.id));
  await writeFile(join(root, "b.txt"), "Reserve Oak.");
  const third = await publish(inspect("b.txt", "Reserve Oak."));
  assert.ok(third.findings.some(item => item.id === first.findings[0]!.id));
  assert.ok(!third.findings.some(item => item.claim.includes("Birch")));
  const cached = await publish(scripted(() => { throw new Error("Cache invoked model."); }));
  assert.equal(cached.cached, true);
  assert.equal(cached.modelCalls, 0);
  assert.deepEqual(cached.findings, third.findings);
  assert.deepEqual(cached.files.map(item => item.path), ["a.txt", "b.txt"]);
});

test("A01: report destinations reject symlinks/directories and exclude only root report files", async t => {
  const { root, directory } = await fixture(t);
  const target = join(directory, "outside.json");
  await writeFile(target, "original");
  await symlink(target, join(root, ".foldy.json"));
  await assert.rejects(saveReport(root, "{}"), /regular file/);
  assert.equal(await readFile(target, "utf8"), "original");
  assert.deepEqual(await readdir(root), [".foldy.json"]);
  await mkdir(join(root, "nested"));
  await mkdir(join(root, "nested", ".foldy.json"));
  await assert.rejects(saveReport(join(root, "nested"), "{}"), /regular file/);
  await writeFile(join(root, ".foldy.json.00000000-0000-0000-0000-000000000000.tmp"), "partial");
  await symlink(target, join(root, HTML_REPORT_NAME));
  await assert.rejects(saveReport(root, "<html></html>", HTML_REPORT_NAME), /regular file/);
  assert.equal(await readFile(target, "utf8"), "original");
  await mkdir(join(root, "nested", HTML_REPORT_NAME));
  await assert.rejects(saveReport(join(root, "nested"), "<html></html>", HTML_REPORT_NAME), /regular file/);
  await writeFile(join(root, ".foldy.html.00000000-0000-0000-0000-000000000000.tmp"), "partial");
  const inventory = await inventoryFolder(root, new AbortController().signal);
  assert.deepEqual(inventory.sources.map(item => item.path), ["nested", "nested/.foldy.html", "nested/.foldy.json"]);
});

test("CLI stores exactly stdout, including incomplete reports, and reports save failures", async t => {
  const { root, stateDir } = await fixture(t);
  const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
  const run = () => promisify(execFile)(process.execPath, [cli, "scan", root], {
    env: { ...process.env, FOLDY_STATE_DIR: stateDir, FOLDY_PROVIDER: "ollama", FOLDY_MODEL: "qwen3.5:9b" },
  });
  // Empty and unsupported-only roots never contact the provider, even in the child process.
  const first = await run();
  assert.equal(await readFile(join(root, ".foldy.json"), "utf8"), first.stdout);
  const second = await run();
  assert.equal(JSON.parse(second.stdout).cached, true);
  assert.equal(await readFile(join(root, ".foldy.json"), "utf8"), second.stdout);
  await writeFile(join(root, "unsupported.bin"), "unsupported");
  await assert.rejects(run(), (error: any) => {
    assert.equal(error.code, 2);
    assert.equal(JSON.parse(error.stdout).status, "incomplete");
    return true;
  });
  const saved = await readFile(join(root, ".foldy.json"), "utf8");
  assert.equal(JSON.parse(saved).status, "incomplete");
  const fs = await import("node:fs/promises");
  const mocked = t.mock.method(fs.default, "rename", async () => { throw new Error("Simulated write failure"); });
  syncBuiltinESMExports();
  try { await assert.rejects(saveReport(root, "{}"), /Simulated write failure/); }
  finally { mocked.mock.restore(); syncBuiltinESMExports(); }
  assert.equal(await readFile(join(root, ".foldy.json"), "utf8"), saved);
  assert.ok(!(await readdir(root)).some(name => name.endsWith(".tmp")));
  await unlink(join(root, ".foldy.json"));
  await mkdir(join(root, ".foldy.json"));
  await assert.rejects(run(), (error: any) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /regular file/);
    return true;
  });
});

test("Flat report: five fields, MD5 metadata and generated prose without a claim-copy fallback", () => {
  const source = (path: string, metadata: Partial<Source> = {}): Source => ({ path, kind: "file", status: "ready", inspected: [], ...metadata });
  const evidence = (path: string): TextEvidence => ({ path, sourceId: path, version: "saved-hash", quote: "Fact.",
    start: 0, end: 5, startLine: 1, endLine: 1 });
  const files = [
    source("z.txt", { format: "text", size: 5, version: "saved-hash", md5: "text-md5", text: "Fact." }),
    source("a.pdf", { format: "pdf", size: 200, version: "pdf-hash", md5: "pdf-md5" }),
    source("empty.png", { format: "image", size: 0, version: "image-hash", md5: "image-md5", status: "error" }),
    source("unsupported.xlsx", { size: 12, status: "unsupported" }),
    source("large.txt", { format: "text", size: 65_537, status: "skipped" }),
    source("unreadable.txt", { format: "text", status: "error" }),
    source("directory", { kind: "directory" }), source("link", { kind: "symlink" }), source("other", { kind: "other" }),
  ];
  const findings: Finding[] = [
    { id: "joint", claim: "Shared fact.", kind: "inferred", uncertainty: "Possible connection.",
      evidence: [evidence("a.pdf"), evidence("z.txt"), evidence("z.txt")] },
    { id: "single", claim: "Fact.", kind: "observed", evidence: [evidence("z.txt")] },
  ];
  assert.deepEqual(fileReportEvidence(files[0]!, findings), { filePath: "z.txt", fileType: "text",
    excerpts: [{ page: undefined, quote: "Fact." }], visualFindings: [] });
  const report = { files, fileReports: {
    "z.txt": { abstract: "A detailed description of the fact in the text file.", summary: "A factual note." },
    "a.pdf": { abstract: "A detailed description of the fact in the PDF file.", summary: "A factual document." },
  } };
  const original = structuredClone(report);
  assert.deepEqual(flatReport(report), [
    { filePath: "z.txt", fileType: "text", fileHash: "text-md5", ...report.fileReports["z.txt"] },
    { filePath: "a.pdf", fileType: "pdf", fileHash: "pdf-md5", ...report.fileReports["a.pdf"] },
    { filePath: "empty.png", fileType: "image", fileHash: "image-md5", abstract: "", summary: "" },
    { filePath: "unsupported.xlsx", fileType: null, fileHash: null, abstract: "", summary: "" },
    { filePath: "large.txt", fileType: "text", fileHash: null, abstract: "", summary: "" },
    { filePath: "unreadable.txt", fileType: "text", fileHash: null, abstract: "", summary: "" },
  ]);
  assert.deepEqual(report, original);
  assert.deepEqual(flatReport({ files: [] }), []);
  assert.equal(flatReport({ files })[0]!.abstract, "");
});

test("MD5 metadata hashes original text and binary bytes while SHA-256 versions stay unchanged", async t => {
  const { root } = await fixture(t);
  const inputs = [
    { path: "bom.txt", bytes: Buffer.from("\ufeffCafé\r\n") },
    { path: "binary.png", bytes: Buffer.from([0, 255, 128, 13, 10]) },
    { path: "invalid.txt", bytes: Buffer.from([255, 254]) },
  ];
  for (const { path, bytes } of inputs) await writeFile(join(root, path), bytes);
  const inventory = await inventoryFolder(root, new AbortController().signal);
  for (const { path, bytes } of inputs) {
    const source = inventory.sources.find(source => source.path === path)!;
    assert.equal(source.md5, createHash("md5").update(bytes).digest("hex"));
    assert.equal(source.version, createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(inventory.sources.find(source => source.path === "invalid.txt")!.status, "error");
});

const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
function runCli(args: string[], stateDir: string, browserFails = false) {
  const bootstrap = `
    import childProcess from "node:child_process";
    import { appendFileSync, readFileSync } from "node:fs";
    import { syncBuiltinESMExports } from "node:module";
    globalThis.fetch = () => { throw new Error("Offline CLI test made a network request."); };
    childProcess.execFile = (command, args, callback) => {
      if (command !== "open") throw new Error("Unexpected command: " + command);
      if (!readFileSync(args[0], "utf8").includes('id="foldy-report"')) throw new Error("HTML must be saved before opening.");
      appendFileSync(${JSON.stringify(join(stateDir, "browser.jsonl"))}, JSON.stringify({ command, args }) + "\\n");
      callback(${browserFails ? 'new Error("Browser unavailable")' : "null"}, "", "");
    };
    syncBuiltinESMExports();
  `;
  const blockNetwork = `data:text/javascript,${encodeURIComponent(bootstrap)}`;
  const result = spawnSync(process.execPath, ["--import", blockNetwork, cli, ...args], {
    encoding: "utf8", timeout: 15_000,
    env: { ...process.env, OPENAI_API_KEY: "", FOLDY_PROVIDER: "openai", FOLDY_MODEL: "gpt-4.1-mini", FOLDY_STATE_DIR: stateDir },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

test("CLI reports: first flat request generates distinct prose; subsequent full and flat requests use saved state", async t => {
  const { root, stateDir } = await fixture(t);
  await mkdir(join(root, "notes"));
  const path = "notes/plan.txt", text = "Reserve room Cedar.";
  await writeFile(join(root, path), text);
  const seeded = await scan(root, { stateDir, provider: "openai", model: "gpt-4.1-mini",
    stream: scripted((_context, index) => [[read(path)], [finding(path, text)], []][index]) });
  assert.equal(seeded.status, "complete");
  assert.equal(seeded.findings.length, 1);

  for (const flags of [[], ["--report", "full"]]) {
    const result = runCli(["scan", root, ...flags], stateDir);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "complete");
    assert.equal(report.cached, true);
    assert.equal(report.modelCalls, 0);
    assert.deepEqual(report.files, seeded.files);
    assert.deepEqual(report.findings, seeded.findings);
  }
  assert.ok(!(await readdir(root)).includes(HTML_REPORT_NAME));
  assert.ok(!(await readdir(stateDir)).includes("browser.jsonl"));
  const prose = { abstract: "The note requests a reservation for room Cedar. It does not confirm a completed booking.",
    summary: "A request to reserve room Cedar." };
  const generated = await scan(root, { stateDir, provider: "openai", model: "gpt-4.1-mini", generateFileReports: true,
    stream: scripted((context, index) => {
      assert.ok(context.systemPrompt?.startsWith(FILE_REPORT_PROMPT));
      assert.equal(index, 0, "The report should require just one model call.");
      assert.match(JSON.stringify(context.messages), /Reserve room Cedar/);
      assert.deepEqual(context.tools ?? [], []);
      return [];
    }, JSON.stringify(prose)) });
  assert.equal(generated.status, "complete", generated.errors.join("\n"));
  assert.equal(generated.cached, false);
  assert.equal(generated.modelCalls, 1);
  assert.equal(generated.reasoningPending, false);
  assert.deepEqual(generated.findings, seeded.findings);
  assert.deepEqual(generated.files, seeded.files);
  const result = runCli(["scan", "--report", "flat", root], stateDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(join(root, ".foldy.json"), "utf8"), result.stdout);
  assert.match(result.stderr, /OpenAI mode selected/);
  assert.deepEqual(JSON.parse(result.stdout), [{ filePath: path, fileType: "text",
    fileHash: createHash("md5").update(text).digest("hex"), ...prose }]);
  const html = await readFile(join(root, HTML_REPORT_NAME), "utf8");
  assert.match(html, /A request to reserve room Cedar\./);
  assert.deepEqual(JSON.parse(await readFile(join(stateDir, "browser.jsonl"), "utf8")),
    { command: "open", args: [join(root, HTML_REPORT_NAME)] });
  const browserFailure = runCli(["scan", root, "--report", "flat"], stateDir, true);
  assert.equal(browserFailure.status, 0, browserFailure.stderr);
  assert.equal(browserFailure.stdout, result.stdout);
  assert.match(browserFailure.stderr, /Could not open the browser: Browser unavailable/);
  const cached = await scan(root, { stateDir, provider: "openai", model: "gpt-4.1-mini", generateFileReports: true,
    stream: scripted(() => { assert.fail("A cached report must not contact the model."); }) });
  assert.equal(cached.cached, true);
  assert.equal(cached.modelCalls, 0);
  assert.deepEqual(cached.fileReports, generated.fileReports);
  assert.ok(!cached.files.some(file => file.path === HTML_REPORT_NAME));
  const opened = await readFile(join(stateDir, "browser.jsonl"), "utf8");
  await unlink(join(root, HTML_REPORT_NAME));
  await mkdir(join(root, HTML_REPORT_NAME));
  const saveFailure = runCli(["scan", root, "--report", "flat"], stateDir);
  assert.equal(saveFailure.status, 1, saveFailure.stderr);
  assert.match(saveFailure.stderr, /\.foldy.html must be a regular file/);
  assert.equal(await readFile(join(root, ".foldy.json"), "utf8"), saveFailure.stdout);
  assert.equal(await readFile(join(stateDir, "browser.jsonl"), "utf8"), opened);
});

test("File reports reject malformed or empty text and retry reporting without repeating scan reasoning", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "note.txt"), "Reserve room Cedar.");
  const seeded = await scan(root, { stateDir,
    stream: scripted((_context, index) => [[read("note.txt")], [finding("note.txt", "Reserve room Cedar.")], []][index]) });
  assert.equal(seeded.status, "complete");
  for (const reply of ["not JSON", "null", JSON.stringify({ abstract: "Missing summary." }),
    JSON.stringify({ abstract: "", summary: "Short." }), JSON.stringify({ abstract: "Details.", summary: " " })]) {
    const failed = await scan(root, { stateDir, generateFileReports: true, stream: scripted((context, index) => {
      assert.ok(context.systemPrompt?.startsWith(FILE_REPORT_PROMPT));
      assert.equal(index, 0);
      return [];
    }, reply) });
    assert.equal(failed.status, "failed");
    assert.equal(failed.reasoningPending, false);
    assert.equal(failed.cached, false);
    assert.match(failed.errors.join("\n"), /File report for note.txt/);
    assert.equal(flatReport(failed)[0]!.abstract, "");
    assert.deepEqual(failed.findings, seeded.findings);
  }
  const prose = { abstract: "The note asks for room Cedar to be reserved, without confirming that the reservation has been made.",
    summary: "A request to reserve room Cedar." };
  const recovered = await scan(root, { stateDir, generateFileReports: true,
    stream: scripted(() => [], JSON.stringify(prose)) });
  assert.equal(recovered.status, "complete", recovered.errors.join("\n"));
  assert.deepEqual(recovered.fileReports?.["note.txt"], prose);
  assert.deepEqual(recovered.findings, seeded.findings);
});

test("File reports preserve model prose without character-length or distinctness rejection", async t => {
  const { root } = await fixture(t);
  for (const prose of [
    { abstract: "Detailed paragraph. ".repeat(300), summary: "A longer summary. ".repeat(30) },
    { abstract: "The model returned this wording.", summary: "The model returned this wording." },
  ]) {
    const actual = await generateFileReport({ filePath: "note.txt", fileType: "text", excerpts: [{ quote: "Evidence." }], visualFindings: [] }, {
      root, model: { name: "offline-test", contextWindow: 32_768 }, signal: new AbortController().signal,
      stream: scripted(() => [], JSON.stringify(prose)), onModelCall: () => {}, onResponse: () => {}, onMessage: () => {},
    });
    assert.deepEqual(actual, { abstract: prose.abstract.trim(), summary: prose.summary.trim() });
  }
});

test("File report failures do not suppress later files, and retry reuses successful reports", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "a.txt"), "Reserve room Cedar.");
  await writeFile(join(root, "b.txt"), "Reserve room Willow.");
  const seeded = await scan(root, { stateDir, stream: scripted((_context, turn) => [
    [read("a.txt"), read("b.txt")], [finding("a.txt", "Reserve room Cedar."), finding("b.txt", "Reserve room Willow.")], [],
  ][turn]) });
  assert.equal(seeded.status, "complete");
  const prose = { abstract: "The note requests a reservation for room Willow.", summary: "A room request." };
  const replies = [scripted(() => [], "invalid JSON"), scripted(() => [], JSON.stringify(prose))];
  let calls = 0;
  const partial = await scan(root, { stateDir, generateFileReports: true,
    stream: (model, context, options) => replies[calls++]!(model, context, options) });
  assert.equal(partial.status, "failed");
  assert.equal(partial.reasoningPending, false);
  assert.equal(calls, 2);
  assert.match(partial.errors.join("\n"), /File report for a.txt/);
  assert.equal(flatReport(partial)[0]!.abstract, "");
  assert.deepEqual(partial.fileReports?.["b.txt"], prose);
  const recovered = await scan(root, { stateDir, generateFileReports: true,
    stream: scripted(() => [], JSON.stringify({ abstract: "The note requests a reservation for room Cedar.", summary: "A room request." })) });
  assert.equal(recovered.status, "complete");
  assert.equal(recovered.modelCalls, 1);
  assert.deepEqual(recovered.fileReports?.["b.txt"], prose);
  assert.ok(flatReport(recovered).every(file => file.abstract && file.summary));
});

test("File reports regenerate only changed source evidence and exclude other files' text from joint findings", async t => {
  const { root, stateDir } = await fixture(t);
  const text = "Reserve room Cedar.";
  await writeFile(join(root, "a.txt"), text);
  await writeFile(join(root, "b.txt"), text);
  const prose = { abstract: "This note requests a reservation for room Cedar; it does not confirm a booking.", summary: "A request for room Cedar." };
  let scanTurn = 0, reportCalls = 0;
  const first = await scan(root, { stateDir, generateFileReports: true, stream: scripted(context => {
    if (context.systemPrompt?.startsWith(FILE_REPORT_PROMPT)) { reportCalls++; return []; }
    return [[read("a.txt"), read("b.txt")], [finding("a.txt", text), finding("b.txt", text)], []][scanTurn++];
  }, JSON.stringify(prose)) });
  assert.equal(first.status, "complete", first.errors.join("\n"));
  assert.equal(reportCalls, 2);
  await writeFile(join(root, "a.txt"), "Reserve room Willow.");
  scanTurn = 0; reportCalls = 0;
  const updated = { abstract: "This note requests a reservation for room Willow; the booking remains unconfirmed.", summary: "A request for room Willow." };
  const second = await scan(root, { stateDir, generateFileReports: true, stream: scripted(context => {
    if (context.systemPrompt?.startsWith(FILE_REPORT_PROMPT)) {
      reportCalls++;
      assert.match(JSON.stringify(context.messages), /Willow/);
      assert.ok(!JSON.stringify(context.messages).includes("Cedar"));
      return [];
    }
    return [[read("a.txt")], [finding("a.txt", "Reserve room Willow.")], []][scanTurn++];
  }, JSON.stringify(updated)) });
  assert.equal(second.status, "complete", second.errors.join("\n"));
  assert.equal(reportCalls, 1);
  assert.deepEqual(second.fileReports?.["a.txt"], updated);
  assert.deepEqual(second.fileReports?.["b.txt"], prose);

  const source = second.files.find(file => file.path === "a.txt")!;
  const joint: Finding = { ...second.findings.find(item => item.evidence.some(ref => ref.path === "a.txt"))!,
    claim: "A Willow room request and an unrelated festival with catering for Noor." };
  joint.evidence = [...joint.evidence, { path: "festival.txt", sourceId: "festival", version: "festival-version",
    quote: "Noor arranges catering for a festival.", start: 0, end: 37, startLine: 1, endLine: 1 }];
  const input = fileReportEvidence(source, [joint]);
  assert.match(JSON.stringify(input), /Willow/);
  assert.ok(!JSON.stringify(input).includes("festival"));
  assert.ok(!JSON.stringify(input).includes("Noor"));
});

test("CLI reports: complete, incomplete and failed scans retain exit codes in both formats", async t => {
  const { root, stateDir } = await fixture(t);
  for (const [status, code] of [["complete", 0], ["incomplete", 2], ["failed", 1]] as const) {
    if (status === "incomplete") await writeFile(join(root, "unsupported.bin"), "123");
    if (status === "failed") await writeFile(join(root, "readable.txt"), "No credentials for this offline scan.");
    for (const format of ["full", "flat"]) {
      const result = runCli(["scan", root, "--report", format], stateDir);
      assert.equal(result.status, code, result.stderr);
      assert.equal(await readFile(join(root, ".foldy.json"), "utf8"), result.stdout);
      const report = JSON.parse(result.stdout);
      if (format === "full") {
        assert.equal(report.status, status);
        assert.equal(report.modelCalls, 0);
        if (status === "failed") assert.match(report.errors.join("\n"), /OPENAI_API_KEY/);
      } else if (status === "complete") assert.deepEqual(report, []);
      else {
        assert.equal(report.length, status === "failed" ? 2 : 1);
        assert.deepEqual(report.find((file: { filePath: string }) => file.filePath === "unsupported.bin"),
          { filePath: "unsupported.bin", fileType: null, fileHash: null, abstract: "", summary: "" });
      }
    }
  }
});

test("CLI reports: invalid arguments fail before creating scan state", async t => {
  const { root, stateDir, directory } = await fixture(t);
  for (const args of [
    ["scan", root, "--report"], ["scan", root, "--report", "csv"], ["scan", root, "--report="],
    ["scan", root, "--unknown"], ["scan", root, "extra"], ["scan"], ["watch", root],
  ]) {
    const result = runCli(args, stateDir);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Usage:|--report|--unknown/);
    assert.ok(!result.stderr.includes("OpenAI mode selected"));
  }
  assert.deepEqual(await readdir(directory), ["root"]);
});
