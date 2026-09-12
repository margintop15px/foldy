import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type TestContext } from "node:test";
import { createAssistantMessageEventStream, type AssistantMessage, type Context, type ToolCall } from "@earendil-works/pi-ai";
import { type ModelStream } from "../src/model.ts";

export async function fixture(t: TestContext) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "foldy-test-")));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, "root");
  await mkdir(root);
  return { directory, root, stateDir: join(directory, "state") };
}

export async function tree(root: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (const name of (await readdir(root)).sort()) {
    const path = join(root, name);
    const info = await lstat(path);
    rows.push([name, info.mode, info.isSymbolicLink() ? await readlink(path) : info.isDirectory()
      ? await tree(path) : createHash("sha256").update(await readFile(path)).digest("hex")]);
  }
  return rows;
}

export const call = (name: string, args: Record<string, unknown>, id = name): ToolCall => ({ type: "toolCall", id, name, arguments: args });
export const read = (path: string, offset?: number) => call("read_file", { path, ...(offset === undefined ? {} : { offset }) }, `read-${path}-${offset}`);
export const finding = (path: string, quote: string) => call("record_finding", { claim: quote, kind: "observed", evidence: [{ path, quote }] });

export function toolResult(context: Context, name: string) {
  const message = context.messages.findLast(message => message.role === "toolResult" && message.toolName === name);
  assert.ok(message && message.role === "toolResult");
  const content = message.content.find(item => item.type === "text");
  assert.ok(content && content.type === "text");
  return JSON.parse(content.text);
}

export function scripted(turn: (context: Context, index: number) => ToolCall[] | "error" | undefined): ModelStream {
  let index = 0;
  return (model, context) => {
    // Exhausted scripts have nothing more to add during the completeness check.
    const reply = turn(context, index++) ?? [];
    const message: AssistantMessage = {
      role: "assistant", model: model.id, provider: model.provider, api: model.api,
      timestamp: Date.now(), stopReason: reply === "error" ? "error" : reply.length ? "toolUse" : "stop",
      content: reply === "error" ? [] : reply.length ? reply : [{ type: "text", text: "Done." }],
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      ...(reply === "error" ? { errorMessage: "Local inference unavailable (offline simulation)." } : {}),
    };
    const stream = createAssistantMessageEventStream();
    if (message.stopReason === "error") stream.push({ type: "error", reason: "error", error: message });
    else stream.push({ type: "done", reason: reply.length ? "toolUse" : "stop", message });
    return stream;
  };
}
import assert from "node:assert/strict";
