import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { createHash } from "node:crypto";
import { symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { crc32 } from "node:zlib";
import { beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { AgentSession } from "@earendil-works/pi-coding-agent";
import sharp from "sharp";
import { extractDocument, MAX_PREVIEW_BASE64, MAX_PAGE_TEXT_BYTES } from "../src/documents.ts";
import { scan } from "../src/scan.ts";
import { call, finding, fixture, read, scripted, toolResult, tree } from "./helpers.ts";

beforeEach(t => { assert.ok("mock" in t); t.mock.method(globalThis, "fetch", () => { throw new Error("Offline test attempted network access."); }); });
const asset = (name: string) => new URL(`./fixtures/documents/${name}`, import.meta.url);
const pdfRead = (path: string, page = 1, offset = 0) => call("read_file", { path, page, offset }, `read-${path}-${page}-${offset}`);
const visual = (path: string, visualRef: string, page?: number) => call("record_finding", {
  claim: "A supported visual observation for boundary testing.", kind: "observed", evidence: [{ path, visualRef, ...(page ? { page } : {}) }],
});
const forbidden = scripted(() => { throw new Error("Cache contacted the model."); });

test("A03/A05/A09: twelve PDF pages persist across fresh processes, connect to later text and cache without extraction", async t => {
  const { root, stateDir } = await fixture(t);
  await copyFile(asset("long.pdf"), join(root, "a.pdf"));
  const driver = fileURLToPath(new URL("./support/document-process.ts", import.meta.url));
  const run = async (mode: string) => JSON.parse((await promisify(childProcess.execFile)(process.execPath, [driver, mode, root], {
    env: { ...process.env, FOLDY_STATE_DIR: stateDir }, timeout: 30_000, maxBuffer: 2_000_000,
  })).stdout) as Awaited<ReturnType<typeof scan>>;
  const first = await run("first");
  assert.equal(first.status, "complete", JSON.stringify(first.errors));
  assert.equal(first.files[0]!.inspection, "full");
  assert.equal(first.processing.jobs, 12);
  assert.equal(Object.keys(first.files[0]!.document!.pages).length, 12);
  await writeFile(join(root, "b.txt"), "Room Elm is now confirmed.");
  const before = await tree(root);
  const second = await run("second");
  assert.equal(second.status, "complete");
  assert.equal(second.processing.jobs, 0);
  assert.equal(second.processing.cacheHits, 1);
  assert.equal(second.findings.length, 2);
  assert.equal(second.findings[1]!.evidence[0]!.sourceId, first.files[0]!.sourceId);
  assert.equal(second.findings[1]!.evidence[0]!.page, 12);
  const cached = await run("cached");
  assert.equal(cached.cached, true);
  assert.equal(cached.modelCalls, 0);
  assert.ok(Object.values(cached.processing).every(count => count === 0));
  assert.deepEqual(cached.findings, second.findings);
  assert.deepEqual(await tree(root), before);
});

test("A05/A06: PDF text continuation keeps the cap explicit and does not repeat omitted work", async t => {
  const { root, stateDir } = await fixture(t);
  await copyFile(asset("text-overflow.pdf"), join(root, "a.pdf"));
  const report = await scan(root, { stateDir, stream: scripted((context, turn) => {
    if (turn === 0) return [pdfRead("a.pdf")];
    if (turn > 17) return [];
    const page = toolResult(context, "read_file");
    assert.equal(page.page, 1);
    assert.equal(page.pageCount, 1);
    assert.equal(page.nextPage, null);
    assert.ok(page.text.length <= 4000);
    assert.equal(page.textTruncated, true);
    return page.nextOffset === null ? [] : [pdfRead("a.pdf", 1, page.nextOffset)];
  }) });
  assert.equal(report.status, "incomplete");
  assert.equal(report.reasoningPending, false);
  assert.equal(report.processing.jobs, 1);
  assert.equal(report.processing.cacheHits, 16);
  assert.equal(report.files[0]!.inspection, "partial");
  const page = report.files[0]!.document!.pages[1]!;
  assert.deepEqual(page.inspected, [{ start: 0, end: MAX_PAGE_TEXT_BYTES }]);
  assert.ok(page.visual);
  const cached = await scan(root, { stateDir, stream: forbidden });
  assert.equal(cached.cached, true);
  assert.equal(cached.status, "incomplete");
  assert.equal(cached.processing.jobs, 0);
});

test("A06/RUN-02: cancellation commits delivered document evidence and resumes remaining work", async t => {
  const { root, stateDir } = await fixture(t);
  await copyFile(asset("a.png"), join(root, "a.png"));
  await copyFile(asset("b.jpg"), join(root, "b.jpg"));
  const controller = new AbortController();
  const first = await scan(root, { stateDir, signal: controller.signal, onToolEvent: event => {
    if (event.type === "tool_execution_end" && event.toolName === "record_finding" && !event.isError) controller.abort("Stop after first saved finding.");
  }, stream: scripted((context, turn) => turn === 0 ? [read("a.png")] : [visual("a.png", toolResult(context, "read_file").visualRef)]) });
  assert.equal(first.status, "incomplete");
  assert.equal(first.reasoningPending, true);
  assert.equal(first.findings.length, 1);
  assert.deepEqual(first.files.map(file => file.inspection), ["full", "none"]);
  const second = await scan(root, { stateDir, stream: scripted((context, turn) => turn === 0 ? [read("b.jpg")]
    : turn === 1 ? [visual("b.jpg", toolResult(context, "read_file").visualRef)] : []) });
  assert.equal(second.status, "complete");
  assert.equal(second.findings[0]!.id, first.findings[0]!.id);
  assert.equal(second.processing.jobs, 1);
});

test("A01/A09: symlink substitution during document extraction invalidates the source without outside inspection", async t => {
  const { directory, root, stateDir } = await fixture(t);
  await copyFile(asset("a.png"), join(root, "a.png"));
  const outside = join(directory, "outside.png");
  await copyFile(asset("a-changed.png"), outside);
  const before = await readFile(outside);
  const originalFork = childProcess.fork;
  t.mock.method(childProcess, "fork", (...args: Parameters<typeof childProcess.fork>) => {
    const child = originalFork(...args);
    child.once("message", () => { unlinkSync(join(root, "a.png")); symlinkSync(outside, join(root, "a.png")); });
    return child;
  });
  const report = await scan(root, { stateDir, stream: scripted((_context, turn) => turn === 0 ? [read("a.png")] : []) });
  assert.equal(report.findings.length, 0);
  assert.equal(report.files[0]!.inspection, "none");
  assert.equal(report.files[0]!.status, "error");
  assert.equal(report.reasoningPending, true);
  assert.deepEqual(await readFile(outside), before);
});

test("A05/A06: real images, orientation, PDF pixels/text, encryption, and bounded page text", async () => {
  for (const name of ["a.png", "c-oriented.jpg", "receipt-scan.pdf", "mixed.pdf", "text-overflow.pdf"]) {
    const result = await extractDocument(await readFile(asset(name)), name.endsWith("pdf") ? "pdf" : "image", 1, true, AbortSignal.timeout(30_000));
    assert.ok("page" in result, JSON.stringify(result));
    assert.ok(result.page.preview);
    const preview = result.page.preview;
    assert.equal(createHash("sha256").update(preview.data).digest("hex"), preview.hash);
    assert.ok(preview.width <= 2_000 && preview.height <= 2_000);
    assert.ok(4 * Math.ceil(preview.data.length / 3) <= MAX_PREVIEW_BASE64);
    assert.deepEqual(result.page.warnings, []);
    if (name === "c-oriented.jpg") {
      assert.deepEqual([preview.width, preview.height], [1000, 650]);
      const pixel = await sharp(preview.data).extract({ left: 150, top: 155, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
      assert.ok(pixel[0]! > 150 && pixel[1]! < 100 && pixel[2]! < 100, "The top-left circle remains red after EXIF rotation.");
    }
    if (name === "receipt-scan.pdf") assert.equal(result.page.text, "");
    if (name === "mixed.pdf") { assert.match(result.page.text, /ST-204/); assert.doesNotMatch(result.page.text, /72/); }
    if (name === "text-overflow.pdf") { assert.equal(Buffer.byteLength(result.page.text), MAX_PAGE_TEXT_BYTES); assert.equal(result.page.textTruncated, true); }
  }
  const encrypted = await extractDocument(await readFile(asset("encrypted.pdf")), "pdf", 1, true, AbortSignal.timeout(30_000));
  assert.ok("error" in encrypted && /password/i.test(encrypted.error));
});

test("A05/A06: a large noisy preview is reduced to fit the encoded payload and reports the reduction", async () => {
  const noise = Buffer.alloc(2000 * 2000 * 3);
  let seed = 123456789;
  for (let index = 0; index < noise.length; index++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; noise[index] = seed & 255; }
  const input = await sharp(noise, { raw: { width: 2000, height: 2000, channels: 3 } }).png().toBuffer();
  assert.ok(input.length > MAX_PREVIEW_BASE64);
  const reply = await extractDocument(input, "image", 1, true, AbortSignal.timeout(30_000));
  assert.ok("page" in reply, JSON.stringify(reply));
  assert.equal(reply.page.reduced, true);
  assert.deepEqual([reply.page.originalWidth, reply.page.originalHeight], [2000, 2000]);
  assert.ok(4 * Math.ceil(reply.page.preview!.data.length / 3) <= MAX_PREVIEW_BASE64);
});

test("A01/A05: PDF actions, links and attachments are not executed, followed or extracted", async () => {
  const script = Buffer.from("throw new Error('PDF_SCRIPT_EXECUTED');").toString("hex");
  const content = "BT /F1 12 Tf 20 100 Td (Visible page content.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R /OpenAction 5 0 R /Names << /EmbeddedFiles << /Names [(attachment.txt) 8 0 R] >> >> >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 6 0 R >> >> /Annots [7 0 R] >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /S /JavaScript /JS <${script}> >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Annot /Subtype /Link /Rect [0 0 20 20] /A << /S /URI /URI (https://example.invalid/private) >> >>",
    "<< /Type /Filespec /F (attachment.txt) /EF << /F 9 0 R >> >>",
    "<< /Type /EmbeddedFile /Length 29 >>\nstream\nATTACHMENT SHOULD STAY UNREAD\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const reply = await extractDocument(Buffer.from(pdf), "pdf", 1, true, AbortSignal.timeout(30_000));
  assert.ok("page" in reply, JSON.stringify(reply));
  assert.match(reply.page.text, /Visible page content/);
  assert.doesNotMatch(reply.page.text, /ATTACHMENT|PDF_SCRIPT/);
  assert.ok(reply.page.preview);
  assert.deepEqual(reply.page.warnings, []);
});

test("A03/A04/A05: image evidence survives restart, identical copies share processing but keep separate inspection and identities", async t => {
  const { root, stateDir } = await fixture(t);
  await copyFile(asset("a.png"), join(root, "a.png"));
  await copyFile(asset("a.png"), join(root, "b.png"));
  const before = await tree(root);
  const first = await scan(root, { stateDir, stream: scripted((context, turn) => {
    if (turn === 0) return [read("a.png")];
    if (turn === 1) return [visual("a.png", toolResult(context, "read_file").visualRef)];
    return [];
  }) });
  assert.equal(first.limits.maxToolCalls, null);
  assert.equal(first.limits.maxRunMs, 900_000);
  assert.equal(first.processing.jobs, 1);
  assert.equal(first.reasoningPending, true);
  assert.deepEqual(first.files.map(file => file.inspection), ["full", "none"]);
  assert.notEqual(first.files[0]!.sourceId, first.files[1]!.sourceId);
  assert.equal(first.findings[0]!.evidence[0]!.type, "visual");
  const second = await scan(root, { stateDir, stream: scripted((context, turn) => {
    if (turn === 0) return [read("b.png")];
    if (turn === 1) return [visual("b.png", toolResult(context, "read_file").visualRef)];
    return [];
  }) });
  assert.equal(second.status, "complete");
  assert.equal(second.processing.jobs, 0);
  assert.equal(second.processing.cacheHits, 1);
  assert.equal(second.findings.length, 2);
  const cached = await scan(root, { stateDir, stream: forbidden });
  assert.equal(cached.cached, true);
  assert.deepEqual(cached.findings, second.findings);
  assert.deepEqual(cached.processing, { jobs: 0, cacheHits: 0, decodedImages: 0, renderedPages: 0, extractionMs: 0 });
  assert.deepEqual(await tree(root), before);
});

test("A05/CTX-01: PDFs require correct pages, exact text or delivered pixels; search exposes partial coverage", async t => {
  const { root, stateDir } = await fixture(t);
  await copyFile(asset("long.pdf"), join(root, "a.pdf"));
  let visualRef = "";
  const report = await scan(root, { stateDir, stream: scripted((context, turn) => {
    if (turn === 0) return [visual("a.pdf", "invented", 12), pdfRead("a.pdf", 12)];
    if (turn === 1) {
      const page = toolResult(context, "read_file");
      visualRef = page.visualRef;
      assert.equal(page.page, 12); assert.equal(page.pageCount, 12); assert.equal(page.nextPage, null);
      return [visual("a.pdf", visualRef, 11), call("record_finding", { claim: "Missing page.", kind: "observed", evidence: [{ path: "a.pdf", quote: "Calibration owner: Talia." }] }),
        call("record_finding", { claim: "Wrong quote.", kind: "observed", evidence: [{ path: "a.pdf", page: 12, quote: "Reservation complete." }] }),
        call("record_finding", { claim: "Wrong text-reference page.", kind: "observed", evidence: [{ path: "a.pdf", page: 11, textRef: page.textRef }] }),
        call("record_finding", { claim: "Calibration owner is Talia; the page requests room Elm.", kind: "observed", evidence: [
          { path: "a.pdf", page: 12, textRef: page.textRef }, { path: "a.pdf", page: 12, visualRef },
        ] }), call("search_context", { query: "Talia" })];
    }
    if (turn === 2) {
      const hits = toolResult(context, "search_context").results;
      assert.ok(hits.some((hit: { page?: number; inspection?: string }) => hit.page === 12 && hit.inspection !== "full"));
    }
    return [];
  }) });
  assert.equal(report.toolErrors.length, 5);
  assert.equal(report.findings.length, 1);
  assert.equal(report.files[0]!.inspection, "partial");
  assert.equal(report.reasoningPending, true);
  const text = report.findings[0]!.evidence[0]!;
  assert.ok(text.type !== "visual");
  assert.match(text.quote, /Calibration owner: Talia\./);
  assert.equal(text.page, 12);
  assert.equal(report.findings[0]!.evidence[1]!.page, 12);
});

test("A06/RUN-02: rendering without successful model delivery is not visual inspection; retry reuses extraction", async t => {
  const { root, stateDir } = await fixture(t);
  await copyFile(asset("a.png"), join(root, "a.png"));
  const failed = await scan(root, { stateDir, stream: scripted((_context, turn) => turn === 0 ? [read("a.png")] : "error") });
  assert.equal(failed.status, "failed");
  assert.equal(failed.files[0]!.inspection, "none");
  assert.equal(failed.reasoningPending, true);
  const retry = await scan(root, { stateDir, stream: scripted((context, turn) => turn === 0 ? [read("a.png")]
    : turn === 1 ? [visual("a.png", toolResult(context, "read_file").visualRef)] : []) });
  assert.equal(retry.status, "complete");
  assert.equal(retry.processing.jobs, 0);
  assert.equal(retry.processing.cacheHits, 1);
});

test("A06: corrupt images/PDFs remain visible and cached while other files continue", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "bad.png"), "invalid image");
  await writeFile(join(root, "bad.pdf"), "invalid PDF");
  await copyFile(asset("encrypted.pdf"), join(root, "locked.pdf"));
  await writeFile(join(root, "note.txt"), "Still readable.");
  const report = await scan(root, { stateDir, stream: scripted((_context, turn) => turn === 0
    ? [read("bad.png"), read("bad.pdf"), read("locked.pdf"), read("note.txt")]
    : turn === 1 ? [finding("note.txt", "Still readable.")] : []) });
  assert.equal(report.status, "incomplete");
  assert.equal(report.reasoningPending, false);
  assert.equal(report.findings.length, 1);
  assert.ok(report.files.filter(file => file.path !== "note.txt").every(file => file.status === "error" && file.reason && file.inspection === "none"));
  const cached = await scan(root, { stateDir, stream: forbidden });
  assert.equal(cached.cached, true);
  assert.equal(cached.processing.jobs, 0);
});

test("A05/CTX-01: a cached raster decode cannot masquerade as PDF extraction for identical bytes", async t => {
  const { root, stateDir } = await fixture(t);
  await copyFile(asset("a.png"), join(root, "a.png"));
  await copyFile(asset("a.png"), join(root, "b.pdf"));
  const report = await scan(root, { stateDir, stream: scripted((_context, turn) => turn === 0 ? [read("a.png"), read("b.pdf")] : []) });
  assert.equal(report.files.find(file => file.path === "a.png")!.inspection, "full");
  assert.equal(report.files.find(file => file.path === "b.pdf")!.status, "error");
  assert.equal(report.files.find(file => file.path === "b.pdf")!.inspection, "none");
  assert.equal(report.processing.jobs, 2);
});

test("A06/RUN-02: helper failure, cancellation and deadline are visible and recoverable", async t => {
  const bytes = await readFile(asset("a.png"));
  await assert.rejects(extractDocument(bytes, "image", 1, true, new AbortController().signal, 1), /deadline/);
  const controller = new AbortController();
  const pending = extractDocument(bytes, "image", 1, true, controller.signal);
  controller.abort(new Error("Cancelled by test."));
  await assert.rejects(pending, /Cancelled/);
  const originalFork = childProcess.fork;
  t.mock.method(childProcess, "fork", (...args: Parameters<typeof childProcess.fork>) => {
    const child = originalFork(...args);
    child.once("spawn", () => child.kill("SIGKILL"));
    return child;
  });
  await assert.rejects(extractDocument(bytes, "image", 1, true, new AbortController().signal), /helper failed/);
});

test("A09: a changed source during extraction cannot supply current findings", async t => {
  const { root, stateDir } = await fixture(t);
  await copyFile(asset("a.png"), join(root, "a.png"));
  const changed = await readFile(asset("a-changed.png"));
  const originalFork = childProcess.fork;
  const mock = t.mock.method(childProcess, "fork", (...args: Parameters<typeof childProcess.fork>) => {
    const child = originalFork(...args);
    child.once("message", () => writeFileSync(join(root, "a.png"), changed));
    return child;
  });
  const report = await scan(root, { stateDir, stream: scripted((_context, turn) => turn === 0 ? [read("a.png")] : []) });
  assert.equal(report.findings.length, 0);
  assert.equal(report.files[0]!.status, "error");
  assert.match(report.files[0]!.reason!, /changed/);
  assert.equal(report.reasoningPending, true);
  mock.mock.restore();
  const retried = await scan(root, { stateDir, stream: scripted((context, turn) => turn === 0 ? [read("a.png")]
    : turn === 1 ? [visual("a.png", toolResult(context, "read_file").visualRef)] : []) });
  assert.equal(retried.status, "complete");
  assert.equal(retried.files[0]!.version, createHash("sha256").update(changed).digest("hex"));
});

test("A05: a text-only model reads PDF text, reports unavailable visual inspection and caches honest limitations", async t => {
  const { root, stateDir } = await fixture(t);
  await copyFile(asset("a.png"), join(root, "a.png"));
  await copyFile(asset("mixed.pdf"), join(root, "b.pdf"));
  const report = await scan(root, { stateDir, offlineModel: { name: "text-only", contextWindow: 8192, capabilities: ["tools"] },
    stream: scripted((_context, turn) => turn === 0 ? [read("a.png"), pdfRead("b.pdf")]
      : turn === 1 ? [call("record_finding", { claim: "Temperature limit: at most 60 C.", kind: "observed", evidence: [{ path: "b.pdf", page: 1, quote: "Temperature limit: at most 60 C." }] })] : []) });
  assert.equal(report.status, "incomplete");
  assert.equal(report.reasoningPending, false);
  assert.equal(report.processing.decodedImages, 0);
  assert.equal(report.processing.renderedPages, 0);
  assert.deepEqual(report.files.map(file => file.inspection), ["none", "partial"]);
  assert.ok(report.files.every(file => file.document?.visualUnavailable));
  const cached = await scan(root, { stateDir, stream: forbidden });
  assert.equal(cached.cached, true);
  assert.equal(cached.reasoningPending, false);
});

test("A05: the actual Ollama request carries the rendered pixels only when vision is advertised", async t => {
  for (const vision of [true, false]) {
    const { root, stateDir } = await fixture(t);
    await copyFile(asset("a.png"), join(root, "a.png"));
    let requests = 0, expectedImage = "", visualRef = "";
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init), path = new URL(request.url).pathname;
      if (path === "/api/show") return Response.json({ model_info: { "general.architecture": "test" }, capabilities: vision ? ["tools", "vision"] : ["tools"] });
      if (path === "/api/ps") return Response.json({ models: [{ name: "test:latest", context_length: 16384, digest: "test" }] });
      if (path !== "/v1/chat/completions") return Response.json({ version: "test" });
      const body = await request.json();
      const index = requests++;
      if (index === 1) {
        const images = body.messages.flatMap((message: { content: unknown }) => Array.isArray(message.content)
          ? message.content.filter((block: { type: string }) => block.type === "image_url").map((block: { image_url: { url: string } }) => block.image_url.url) : []);
        assert.deepEqual(images, vision ? [expectedImage] : []);
        assert.equal(body.max_tokens, undefined);
        assert.equal(body.max_completion_tokens, undefined);
      }
      const action = index === 0 ? { name: "read_file", arguments: { path: "a.png" } }
        : index === 1 && vision ? { name: "record_finding", arguments: { claim: "Three red circles are above two blue squares.", kind: "observed", evidence: [{ path: "a.png", visualRef }] } } : undefined;
      const delta = action ? { role: "assistant", tool_calls: [{ index: 0, id: `call-${index}`, type: "function", function: { name: action.name, arguments: JSON.stringify(action.arguments) } }] }
        : { role: "assistant", content: "Done." };
      return new Response(`data: ${JSON.stringify({ id: "test", model: "test", choices: [{ index: 0, delta, finish_reason: action ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`,
        { headers: { "Content-Type": "text/event-stream" } });
    });
    const report = await scan(root, { model: "test", stateDir, onToolEvent: event => {
      if (event.type !== "tool_execution_end" || event.toolName !== "read_file" || event.isError) return;
      const result = event.result as { content: { type: string; text?: string; data?: string; mimeType?: string }[] };
      visualRef = JSON.parse(result.content.find(block => block.type === "text")!.text!).visualRef;
      const image = result.content.find(block => block.type === "image")!;
      expectedImage = `data:${image.mimeType};base64,${image.data}`;
    } });
    assert.equal(report.files[0]!.inspection, vision ? "full" : "none");
    assert.equal(report.findings.length, vision ? 1 : 0);
    assert.equal(report.reasoningPending, false);
    assert.ok(requests >= 2);
  }
});

test("CTX-01/RUN-02: same-batch citations and large image read batches still require successful model delivery", async t => {
  const { root, stateDir } = await fixture(t);
  await copyFile(asset("a.png"), join(root, "a.png"));
  const premature = visual("a.png", "not-delivered-yet");
  let reference = "";
  const report = await scan(root, { stateDir, onToolEvent: event => {
    if (event.type === "tool_execution_end" && event.toolName === "read_file" && !event.isError) {
      const result = event.result as { content: { type: string; text: string }[] };
      reference = JSON.parse(result.content.find(block => block.type === "text")!.text).visualRef;
      // Simulate a caller knowing the ref before the model has received its pixels.
      (premature.arguments.evidence as { visualRef: string }[])[0]!.visualRef = reference;
    }
  }, stream: scripted((_context, turn) => turn === 0 ? [read("a.png"), premature] : turn === 1 ? [visual("a.png", reference)] : []) });
  assert.equal(report.toolErrors.length, 1);
  assert.match(report.toolErrors[0]!, /not-yet-delivered/);
  assert.equal(report.findings.length, 1);
  const fresh = await fixture(t);
  await copyFile(asset("a.png"), join(fresh.root, "a.png"));
  const limited = await scan(fresh.root, { stateDir: fresh.stateDir, stream: scripted((_context, turn) => turn === 0
    ? Array.from({ length: 100 }, (_, n) => call("read_file", { path: "a.png" }, `read-${n}`)) : "error") });
  assert.equal(limited.files[0]!.inspection, "none");
  assert.equal(limited.executedToolCalls, 100);
  assert.equal(limited.toolCalls, 100);
  assert.ok(limited.modelCalls >= 2);
  assert.equal(limited.status, "failed");
  assert.equal(limited.reasoningPending, true);
});

test("CTX-01: actual Pi compaction invalidates text and visual citation eligibility until reread", async t => {
  const { root, stateDir } = await fixture(t);
  await copyFile(asset("a.png"), join(root, "a.png"));
  await writeFile(join(root, "note.txt"), "A current text fact.");
  const originalPrompt = AgentSession.prototype.prompt;
  let compacted = false, phase = 0, reference = "", textReference = "";
  const citeText = () => call("record_finding", { claim: "A current text fact.", kind: "observed",
    evidence: [{ path: "note.txt", textRef: textReference }] });
  t.mock.method(AgentSession.prototype, "prompt", async function (this: AgentSession, ...args: Parameters<typeof originalPrompt>) {
    await originalPrompt.apply(this, args);
    if (!compacted) {
      compacted = true;
      const savedPhase = phase;
      phase = 100;
      await originalPrompt.call(this, "Synthetic unrelated context padding. ".repeat(800));
      phase = savedPhase;
      await this.compact();
      await originalPrompt.call(this, "Check citation eligibility after compaction.");
    }
  });
  const report = await scan(root, { stateDir, offlineModel: { name: "compaction-test", contextWindow: 32768, capabilities: ["tools", "vision"] },
    onToolEvent: event => {
      if (event.type !== "tool_execution_end" || event.toolName !== "read_file" || event.isError) return;
      const result = event.result as { content: { type: string; text?: string }[] };
      const metadata = JSON.parse(result.content.find(block => block.type === "text")!.text!);
      if (metadata.path === "note.txt") textReference = metadata.textRef;
    }, stream: scripted(context => {
    if (!context.tools?.some(tool => tool.name === "read_file")) return []; // Pi's compaction summary.
    switch (phase++) {
      case 0: return [read("note.txt"), read("a.png")];
      case 1: reference = toolResult(context, "read_file").visualRef; return [];
      case 2: return [visual("a.png", reference), finding("note.txt", "A current text fact."), citeText()];
      case 3: return [read("note.txt"), read("a.png")];
      case 4: return [visual("a.png", toolResult(context, "read_file").visualRef), citeText()];
      default: return [];
    }
  }) });
  assert.deepEqual(report.errors, []);
  assert.ok(compacted);
  assert.equal(report.toolErrors.length, 3);
  assert.ok(report.toolErrors.some(error => error.includes("visualRef")));
  assert.ok(report.toolErrors.some(error => error.includes("No excerpt read")));
  assert.ok(report.toolErrors.some(error => error.includes("textRef")));
  assert.equal(report.findings.length, 2);
  assert.equal(report.status, "complete", JSON.stringify(report.errors));
});

test("A06: input byte and pixel limits reject work before unbounded decoding", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "large.png"), Buffer.alloc(20 * 1024 * 1024 + 1));
  await writeFile(join(root, "large.pdf"), Buffer.alloc(50 * 1024 * 1024 + 1));
  const report = await scan(root, { stateDir, stream: forbidden });
  assert.equal(report.modelCalls, 0);
  assert.equal(report.processing.jobs, 0);
  assert.ok(report.files.every(file => file.status === "skipped" && file.inspection === "none" && /limit/.test(file.reason!)));
  const png = Buffer.from(await readFile(asset("a.png")));
  png.writeUInt32BE(9000, 16); png.writeUInt32BE(8000, 20);
  png.writeUInt32BE(crc32(png.subarray(12, 29)), 29);
  const result = await extractDocument(png, "image", 1, true, AbortSignal.timeout(30_000));
  assert.ok("error" in result && /pixel limit/i.test(result.error), JSON.stringify(result));
});
