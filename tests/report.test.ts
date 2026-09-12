import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { inventoryFolder } from "../src/inventory.ts";
import { saveReport } from "../src/report.ts";
import { scan } from "../src/scan.ts";
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
  const inventory = await inventoryFolder(root, new AbortController().signal);
  assert.deepEqual(inventory.sources.map(item => item.path), ["nested", "nested/.foldy.json"]);
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
