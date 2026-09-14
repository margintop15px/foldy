import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { saveOverview } from "../src/overview.ts";
import { saveReport } from "../src/report.ts";
import { fixture } from "./helpers.ts";

test("Folder overview embeds saved data safely and handles filtering, null metadata and duplicate hashes", async t => {
  const { root } = await fixture(t);
  const text = '</script><script>throw new Error("Injected")</script><!-- & $& {{ query }}';
  const files = [
    { filePath: "a.md", fileHash: "same-hash", fileType: "text", summary: text, abstract: "Detailed first note." },
    { filePath: "nested/b.md", fileHash: "same-hash", fileType: "text", summary: "Another note.", abstract: "Cedar reservation." },
    { filePath: "__proto__/missing", fileHash: null, fileType: null, summary: "", abstract: "" },
    { filePath: "toString", fileHash: null, fileType: null, summary: "", abstract: "" },
  ];
  const json = JSON.stringify(files);
  await saveReport(root, json);
  const path = await saveOverview(root);
  assert.equal(path, join(root, ".foldy.html"));
  const html = await readFile(path, "utf8");
  assert.equal(await readFile(join(root, ".foldy.json"), "utf8"), json);
  assert.ok(!html.includes(text), "Untrusted text must not terminate its JSON script element.");
  assert.ok(!html.includes('src="./support.js"'));
  assert.ok(!html.includes("<!--FOLDY_DATA-->"));
  assert.ok(!html.includes("Study notes"));
  const data = html.match(/<script type="application\/json" id="foldy-report">([\s\S]*?)<\/script>/)![1]!;
  assert.deepEqual(JSON.parse(data), { folderName: "root", files });
  const logic = html.match(/<script type="text\/x-dc" data-dc-script>([\s\S]*?)<\/script>/)![1]!;
  // Run the actual template logic offline; browser rendering is checked separately.
  const Component = new Function("DCLogic", "document", `${logic}; return Component;`)(class {
    props = {};
    state = {};
    setState(update: any) { Object.assign(this.state, typeof update === "function" ? update(this.state) : update); }
  }, { getElementById: () => ({ textContent: data }) });
  const component = new Component();
  const items = () => component.renderVals().groups.flatMap((group: any) => group.items);
  assert.equal(component.renderVals().folderName, "root");
  assert.equal(component.renderVals().countFiles, 4);
  assert.equal(component.renderVals().countTypes, 2);
  assert.ok(items().every((item: any) => !item.open));
  assert.equal(items().find((item: any) => item.path === "a.md").summary, text);
  assert.equal(items().find((item: any) => item.path === "__proto__/missing").hash, "unavailable");
  items().find((item: any) => item.path === "a.md").onToggle();
  assert.deepEqual(items().filter((item: any) => item.open).map((item: any) => item.path), ["a.md"]);
  component.renderVals().onToggleAll();
  assert.ok(items().every((item: any) => item.open));
  component.renderVals().onToggleAll();
  assert.ok(items().every((item: any) => !item.open));
  component.renderVals().onQuery({ target: { value: "CEDAR" } });
  assert.deepEqual(items().map((item: any) => item.path), ["nested/b.md"]);
  component.renderVals().onQuery({ target: { value: "" } });
  component.renderVals().filters.find((filter: any) => filter.label === "unknown").onClick();
  assert.equal(items().length, 2);
  component.renderVals().onQuery({ target: { value: "no match" } });
  assert.equal(component.renderVals().empty, true);
  await saveReport(root, "[]");
  await saveOverview(root);
  assert.match(await readFile(path, "utf8"), /"files":\[\]/);
  await saveReport(root, "{}");
  await assert.rejects(saveOverview(root), /flat .foldy.json/);
  assert.deepEqual((await readdir(root)).sort(), [".foldy.html", ".foldy.json"]);
});
