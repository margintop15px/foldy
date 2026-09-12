import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, test } from "node:test";
import { promisify } from "node:util";
import { createScanSession, localFetch, openAIFetch, prepareOpenAIModel, selectModel } from "../src/model.ts";
import { scan } from "../src/scan.ts";
import { finding, fixture, read, scripted } from "./helpers.ts";

beforeEach(t => {
  assert.ok("mock" in t);
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-openai-key";
  t.after(() => { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; });
  t.mock.method(globalThis, "fetch", () => { throw new Error("Offline provider tests must not access the network."); });
});

function response(index: number, action?: { name: string; arguments: object }) {
  const item = action ? { type: "function_call", id: `fc_${index}`, call_id: `call_${index}`, name: action.name,
    arguments: JSON.stringify(action.arguments), status: "completed" }
    : { type: "message", id: `msg_${index}`, role: "assistant", status: "completed", content: [{ type: "output_text", text: "Done.", annotations: [] }] };
  const events = [
    { type: "response.output_item.done", output_index: 0, item },
    { type: "response.completed", response: { id: `resp_${index}`, status: "completed", output: [item],
      usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 } } },
  ];
  return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""),
    { headers: { "Content-Type": "text/event-stream", "x-request-id": `req_synthetic_${index}` } });
}

test("Providers: selection defaults to Ollama, validates explicit choices and keeps endpoint boundaries", async t => {
  assert.deepEqual(selectModel(), { provider: "ollama", modelTag: "qwen3.5:9b" });
  assert.deepEqual(selectModel("openai"), { provider: "openai", modelTag: "gpt-4.1-mini" });
  assert.deepEqual(selectModel("openai", "gpt-5-mini"), { provider: "openai", modelTag: "gpt-5-mini" });
  assert.throws(() => selectModel("opneai"), /FOLDY_PROVIDER/);
  assert.throws(() => prepareOpenAIModel("https://example.com/model"), /catalog/);
  assert.throws(() => localFetch("https://api.openai.com/v1/responses"), /local Ollama/);
  for (const url of ["http://api.openai.com/v1/responses", "https://api.openai.com.evil.test/v1/responses",
    "https://api.openai.com/v1/files", "https://user:pass@api.openai.com/v1/responses", "http://127.0.0.1:11434/v1/responses"]) {
    assert.throws(() => openAIFetch(url), /OpenAI mode only permits/);
  }
  t.mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.redirect, "error", "Credentials and documents cannot follow redirects.");
    return new Response("ok");
  });
  await openAIFetch("https://api.openai.com/v1/responses");
});

test("Providers: OpenAI serializes exact PDF pixels and tool results, validates citations and caches without a key", async t => {
  const { root, stateDir } = await fixture(t);
  await copyFile(new URL("fixtures/documents/mixed.pdf", import.meta.url), join(root, "a.pdf"));
  const before = await readFile(join(root, "a.pdf"));
  let requests = 0, visualRef = "", expectedImage = "";
  let requestError: unknown;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    try {
      const request = new Request(input, init);
      assert.equal(request.url, "https://api.openai.com/v1/responses");
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-openai-key");
      assert.equal(init?.redirect, "error");
      const body = await request.json();
      const index = requests++;
      assert.equal(body.model, "gpt-4.1-mini");
      assert.equal(body.max_output_tokens, undefined);
      assert.equal(body.store, false);
      assert.equal(body.temperature, 0);
      assert.equal(body.reasoning_effort, undefined);
      assert.deepEqual(body.tools.map((tool: { name: string }) => tool.name).sort(), ["read_file", "record_finding", "search_context"]);
      if (index === 1) {
        const output = body.input.find((item: { type: string; call_id?: string }) => item.type === "function_call_output" && item.call_id === "call_0")?.output;
        assert.ok(Array.isArray(output), "The Responses tool result must contain image blocks.");
        const images = output.filter((block: { type: string }) => block.type === "input_image");
        assert.equal(images.length, 1);
        assert.ok(images[0].image_url === expectedImage, "The serialized request must contain the exact rendered pixels.");
      }
      const action = index === 0 ? { name: "read_file", arguments: { path: "a.pdf", page: 1 } }
        : index === 1 ? { name: "record_finding", arguments: { claim: "Wrong limit.", kind: "observed",
          evidence: [{ path: "a.pdf", page: 1, quote: "The limit is 99 C." }] } }
        : index === 2 ? { name: "record_finding", arguments: { claim: "The limit is 60 C; Tuesday's chart value is 72 C.", kind: "observed",
          evidence: [{ path: "a.pdf", page: 1, quote: "Temperature limit: at most 60 C." }, { path: "a.pdf", page: 1, visualRef }] } }
        : undefined;
      return response(index, action);
    } catch (error) { requestError = error; throw error; }
  });
  const report = await scan(root, { provider: "openai", stateDir, onToolEvent: event => {
    if (event.type !== "tool_execution_end" || event.toolName !== "read_file" || event.isError) return;
    const content = (event.result as { content: { type: string; text?: string; data?: string; mimeType?: string }[] }).content;
    visualRef = JSON.parse(content.find(block => block.type === "text")!.text!).visualRef;
    const image = content.find(block => block.type === "image")!;
    expectedImage = `data:${image.mimeType};base64,${image.data}`;
  } });
  if (requestError) throw requestError;
  assert.equal(report.status, "complete", JSON.stringify(report.errors));
  assert.equal(report.provider, "openai");
  assert.equal(report.model?.provider, "openai");
  assert.equal(report.model?.name, "gpt-4.1-mini");
  assert.equal(report.toolErrors.length, 1, "Fabricated text remains rejected with the cloud provider.");
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]!.evidence.length, 2);
  assert.equal(report.files[0]!.inspection, "full");
  assert.equal(report.processing.renderedPages, 1);
  assert.ok(requests >= 5, "The same production review pass runs.");
  assert.ok(!JSON.stringify(report).includes("synthetic-openai-key"));
  delete process.env.OPENAI_API_KEY;
  t.mock.method(globalThis, "fetch", () => { throw new Error("Cached scan tried the network."); });
  const cached = await scan(root, { provider: "openai", stateDir });
  assert.equal(cached.cached, true);
  assert.equal(cached.modelCalls, 0);
  assert.deepEqual(cached.modelResponses, []);
  assert.ok(Object.values(cached.processing).every(value => value === 0));
  assert.deepEqual(cached.findings, report.findings);
  assert.deepEqual(await readFile(join(root, "a.pdf")), before);
});

test("Providers: missing keys and API failures preserve pending work without fallback", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "note.txt"), "Synthetic input.");
  delete process.env.OPENAI_API_KEY;
  const missing = await scan(root, { provider: "openai", stateDir });
  assert.equal(missing.status, "failed");
  assert.equal(missing.reasoningPending, true);
  assert.match(missing.errors.join(" "), /OPENAI_API_KEY/);
  assert.equal(missing.modelCalls, 0);
  process.env.OPENAI_API_KEY = "synthetic-openai-key";
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    assert.equal(String(input), "https://api.openai.com/v1/responses");
    requests++;
    return Response.json({ error: { message: "Synthetic authentication failure", type: "invalid_request_error", code: "invalid_api_key" } },
      { status: 401, headers: { "x-request-id": "req_auth_failure", "set-cookie": "sensitive-response-header" } });
  });
  const failed = await scan(root, { provider: "openai", stateDir });
  assert.equal(requests, 1);
  assert.equal(failed.status, "failed");
  assert.equal(failed.reasoningPending, true);
  assert.equal(failed.cached, false);
  assert.deepEqual(failed.modelResponses, [{ modelCall: 1, httpStatus: 401, requestId: "req_auth_failure" }]);
  assert.ok(!JSON.stringify(failed).includes("sensitive-response-header"));
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    assert.equal(String(input), "http://127.0.0.1:11434/api/show");
    return new Response("Unavailable", { status: 503 });
  });
  const local = await scan(root, { stateDir });
  assert.equal(local.provider, "ollama", "An available OpenAI key never switches the default provider.");
  assert.equal(local.status, "failed");
});

test("Providers: a streaming failure after text reads stays pending and a fresh scan retries without losing source identity", async t => {
  const { root, stateDir } = await fixture(t);
  const contents = "First verified detail.\n".padEnd(4_000, " ") + "Second verified detail.";
  await writeFile(join(root, "note.txt"), contents);
  let requests = 0, fail = true;
  let requestError: unknown;
  const message = "An error occurred while processing your request. You can retry your request.";
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    try {
      const request = new Request(input, init);
      assert.equal(request.url, "https://api.openai.com/v1/responses");
      const body = await request.json();
      const index = requests++;
      const textRefs: string[] = [];
      if (index === 2) {
        const outputs = body.input.filter((item: { type: string }) => item.type === "function_call_output");
        assert.deepEqual(outputs.map((item: { call_id: string }) => item.call_id), ["call_0", "call_1"]);
        assert.equal(JSON.parse(outputs[0].output).text + JSON.parse(outputs[1].output).text, contents);
        for (const output of outputs) {
          const textRef = JSON.parse(output.output).textRef;
          assert.equal(typeof textRef, "string");
          textRefs.push(textRef);
        }
        if (fail) return new Response(`data: ${JSON.stringify({ error: { code: "server_error", message } })}\n\n`,
          { headers: { "Content-Type": "text/event-stream", "x-request-id": "req_stream_failure" } });
      }
      return response(index, index < 2 ? { name: "read_file", arguments: { path: "note.txt", offset: index * 4_000 } }
        : index === 2 ? { name: "record_finding", arguments: { claim: "First verified detail. Second verified detail.", kind: "observed",
          evidence: textRefs.map(textRef => ({ path: "note.txt", textRef })) } }
        : undefined);
    } catch (error) { requestError = error; throw error; }
  });
  const failed = await scan(root, { provider: "openai", stateDir });
  if (requestError) throw requestError;
  assert.equal(requests, 3, "A failed provider response is not silently retried.");
  assert.equal(failed.status, "failed");
  assert.equal(failed.reasoningPending, true);
  assert.equal(failed.files[0]!.inspection, "full", "Inspected text does not mean completed reasoning.");
  assert.deepEqual(failed.findings, []);
  assert.deepEqual(failed.errors, [message]);
  assert.deepEqual(failed.toolErrors, []);
  assert.deepEqual(failed.modelResponses, [
    { modelCall: 1, httpStatus: 200, requestId: "req_synthetic_0" },
    { modelCall: 2, httpStatus: 200, requestId: "req_synthetic_1" },
    { modelCall: 3, httpStatus: 200, requestId: "req_stream_failure" },
  ]);
  requests = 0; fail = false;
  const retried = await scan(root, { provider: "openai", stateDir });
  if (requestError) throw requestError;
  assert.equal(retried.status, "complete", JSON.stringify(retried.errors));
  assert.equal(retried.cached, false);
  assert.equal(retried.reasoningPending, false);
  assert.equal(retried.findings.length, 1);
  assert.equal(retried.findings[0]!.evidence.map(ref => { assert.ok(ref.type !== "visual"); return ref.quote; }).join(""), contents);
  assert.equal(retried.files[0]!.sourceId, failed.files[0]!.sourceId);
  t.mock.method(globalThis, "fetch", () => { throw new Error("Completed scan tried the network."); });
  const cached = await scan(root, { provider: "openai", stateDir });
  assert.equal(cached.cached, true);
  assert.deepEqual(cached.findings, retried.findings);
  assert.deepEqual(cached.modelResponses, []);
  assert.equal(await readFile(join(root, "note.txt"), "utf8"), contents);
});

test("Providers: schema-3 migration preserves local cache and provider switches invalidate it even for equal tags", async t => {
  const { root, stateDir } = await fixture(t);
  await writeFile(join(root, "a.txt"), "Keep this finding.");
  const model = "gpt-4.1-mini";
  const first = await scan(root, { stateDir, model, stream: scripted((_context, turn) =>
    turn === 0 ? [read("a.txt")] : turn === 1 ? [finding("a.txt", "Keep this finding.")] : []) });
  const db = new DatabaseSync(join(stateDir, createHash("sha256").update(root).digest("hex"), "foldy.sqlite"));
  try { db.exec("ALTER TABLE state DROP COLUMN model_provider; UPDATE state SET schema_version = 3, model_info = json_remove(model_info, '$.provider')"); }
  finally { db.close(); }
  const forbidden = scripted(() => { throw new Error("Cache ran the model."); });
  const migrated = await scan(root, { stateDir, model, stream: forbidden });
  assert.equal(migrated.cached, true);
  assert.deepEqual(migrated.findings, first.findings);
  for (const provider of ["openai", "ollama"]) {
    const changed = await scan(root, { provider, model, stateDir, stream: scripted(() => []) });
    assert.equal(changed.cached, false);
    assert.ok(changed.modelCalls > 0);
    assert.equal(changed.provider, provider);
    assert.equal(changed.files[0]!.sourceId, first.files[0]!.sourceId);
    assert.deepEqual(changed.findings, first.findings);
    assert.equal((await scan(root, { provider, model, stateDir, stream: forbidden })).cached, true);
  }
});

test("Providers: OpenAI compaction uses the same transport and reasoning models omit unsupported temperature", async t => {
  const { root } = await fixture(t);
  for (const name of ["gpt-4.1-mini", "gpt-5-mini"]) {
    const bodies: Record<string, any>[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      assert.equal(request.url, "https://api.openai.com/v1/responses");
      bodies.push(await request.json());
      return response(bodies.length);
    });
    const session = await createScanSession(root, [], prepareOpenAIModel(name), new AbortController().signal);
    try {
      await session.prompt("Synthetic summary input. ".repeat(800));
      await session.prompt("Summarize the synthetic input. ".repeat(800));
      await session.compact();
      assert.equal(bodies.length, 3);
      assert.deepEqual(bodies.map(body => body.max_output_tokens), [undefined, undefined, Math.floor(0.8 * 8_192)]);
      assert.ok(bodies.every(body => body.model === name && body.store === false));
      if (name === "gpt-5-mini") {
        assert.ok(bodies.every(body => body.temperature === undefined && body.reasoning.effort === "low"));
      } else assert.ok(bodies.every(body => body.temperature === 0 && body.reasoning === undefined));
    } finally { await session.abort(); session.dispose(); }
  }
});

test("Providers: empty OpenAI scans cache without credentials and CLI environment selection is explicit", async t => {
  const { root, stateDir } = await fixture(t);
  delete process.env.OPENAI_API_KEY;
  const env = { ...process.env, OPENAI_API_KEY: "", FOLDY_PROVIDER: "openai", FOLDY_MODEL: "gpt-4.1-mini", FOLDY_STATE_DIR: stateDir };
  const driver = new URL("../src/cli.ts", import.meta.url).pathname;
  const initial = await promisify(execFile)(process.execPath, [driver, "scan", root], { env });
  const first = JSON.parse(initial.stdout);
  assert.equal(first.provider, "openai");
  assert.equal(first.modelCalls, 0);
  assert.match(initial.stderr, /OpenAI mode selected/);
  const { stdout } = await promisify(execFile)(process.execPath, [driver, "scan", root], { env });
  assert.equal(JSON.parse(stdout).cached, true);
  await assert.rejects(scan(root, { provider: "opneai", stateDir }), /FOLDY_PROVIDER/);
});
