import assert from 'node:assert/strict';
import { appendFileSync, writeFileSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan } from '/Users/usuario/Projects/foldy/src/scan.ts';

const out = '/Users/usuario/Projects/foldy/benchmarks/experiments/2026-09-12-pdf-reader';
await mkdir(out);
const temporary = await mkdtemp(join(tmpdir(), 'foldy-pdf-smoke-'));
const root = join(temporary, 'root'), stateDir = join(temporary, 'state');
await mkdir(root);
const source = '/Users/usuario/Projects/foldy/tests/fixtures/documents/mixed.pdf';
await copyFile(source, join(root, 'a.pdf'));
await copyFile(source, join(out, 'source.pdf'));
const before = await readFile(join(root, 'a.pdf'));
try {
  const report = await scan(root, { stateDir, maxRunMs: 180_000, onToolEvent: event => {
    let logged = event;
    if (event.type === 'tool_execution_end' && event.toolName === 'read_file' && !event.isError) {
      const blocks = event.result.content;
      const metadata = JSON.parse(blocks.find(block => block.type === 'text').text);
      logged = { ...event, result: { ...event.result, content: blocks.map(block => {
        if (block.type !== 'image') return block;
        const path = `preview-${metadata.preview.hash}.${block.mimeType === 'image/jpeg' ? 'jpg' : 'png'}`;
        writeFileSync(join(out, path), Buffer.from(block.data, 'base64'));
        return { type: 'image', mimeType: block.mimeType, path, hash: metadata.preview.hash };
      }) } };
    }
    appendFileSync(join(out, 'tools.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...logged }) + '\n');
  } });
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  assert.deepEqual(await readFile(join(root, 'a.pdf')), before);
  console.log(JSON.stringify(report, null, 2));
  if (report.status === 'complete' && !report.reasoningPending) {
    const cached = await scan(root, { stateDir, stream: () => { throw new Error('Cache contacted the model.'); } });
    await writeFile(join(out, 'cache.json'), JSON.stringify(cached, null, 2) + '\n');
    assert.equal(cached.cached, true);
    assert.equal(cached.modelCalls, 0);
    assert.ok(Object.values(cached.processing).every(value => value === 0));
    assert.deepEqual(cached.findings, report.findings);
    assert.deepEqual(await readFile(join(root, 'a.pdf')), before);
    assert.equal(report.files[0].inspection, 'full');
    assert.ok(report.findings.some(finding => finding.evidence.some(ref => ref.type === 'visual' && ref.page === 1)));
    console.log('Focused mixed-PDF smoke and zero-work cache check passed. Semantic review is separate.');
  } else process.exitCode = 2;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
