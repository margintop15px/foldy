import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { hash } from '../../../tests/quality/harness.ts';
const here = new URL('./', import.meta.url);
const results = JSON.parse(await readFile(new URL('results.json', here), 'utf8'));
assert.ok(results.finished, 'Wait for the complete collection.');
const live = results.scans.filter(s => s.stage < 3), cached = results.scans.filter(s => s.stage === 3);
function stats(values) {
  const sorted = values.toSorted((a,b)=>a-b), middle=(sorted.length-1)/2;
  return { n: sorted.length, median: (sorted[Math.floor(middle)]+sorted[Math.ceil(middle)])/2, min: sorted[0], max: sorted.at(-1) };
}
const tools = [];
for (const scan of live) {
  const starts = new Map(); let totalMs = 0;
  for (const e of (await readFile(new URL(scan.traceFile, here),'utf8')).split('\n').filter(Boolean).map(JSON.parse)) {
    if (e.type === 'tool_execution_start') starts.set(e.toolCallId, Date.parse(e.at));
    if (e.type === 'tool_execution_end' && starts.has(e.toolCallId)) totalMs += Date.parse(e.at)-starts.get(e.toolCallId);
  }
  tools.push({key:scan.key,totalMs});
}
const provenance = [];
for (const [path,fingerprint] of Object.entries(results.manifest.codeFiles)) {
  const current = hash(await readFile(new URL('../../../'+path, here),'utf8'));
  provenance.push({path,unchanged:current===fingerprint});
}
assert.ok(provenance.every(p=>p.unchanged), 'Evaluated source changed during collection.');
const timing = {
  resultsHash:hash(results), units:'milliseconds unless stated',
  collectionMs:Date.parse(results.manifest.finishedAt)-Date.parse(results.manifest.startedAt),
  stage1Wall:stats(live.filter(s=>s.stage===1).map(s=>s.wallMs)),
  stage2Wall:stats(live.filter(s=>s.stage===2).map(s=>s.wallMs)),
  allLiveWall:stats(live.map(s=>s.wallMs)), scanWork:stats(live.map(s=>s.report.durationMs)),
  cacheWall:stats(cached.map(s=>s.wallMs)), cacheWork:stats(cached.map(s=>s.report.durationMs)),
  toolExecutionPerScan:stats(tools.map(s=>s.totalMs)), tools,
  modelCalls:live.reduce((n,s)=>n+s.report.modelCalls,0),toolCalls:live.reduce((n,s)=>n+s.report.toolCalls,0),
  recoveredToolErrors:live.reduce((n,s)=>n+s.report.toolErrors.length,0),
  inputTokens:live.reduce((n,s)=>n+s.report.agentUsage.inputTokens,0),
  outputTokens:live.reduce((n,s)=>n+s.report.agentUsage.outputTokens,0),
  maxResponseTokens:Math.max(...live.map(s=>s.report.agentUsage.maxResponseTokens)),
  thinkingResponses:live.reduce((n,s)=>n+s.report.agentUsage.thinkingResponses,0),
  errors:live.filter(s=>s.report.errors.length).map(s=>({key:s.key,errors:s.report.errors})),
  codeProvenance:provenance,
  caveats:['Agent token counts exclude separate Pi compaction and Ollama preflight; wall time includes them.',
    'inputTokens sums the SDK usage.input field, which excludes separately reported cache-read/write tokens; it is not total prompt volume.',
    'Tool durations measure instrumented tool execution. Remaining time also includes model calls, preflight, session and application overhead.',
    'Baseline and current runs share fixtures and hardware but change prompts, thinking mode, evidence checks and the output-token adapter. This is not an isolated causal measurement of thinking.',
    'Host workload and thermal conditions were not controlled. A single host sample is retained separately.']
};
await writeFile(new URL('timing.json',here),JSON.stringify(timing,null,2)+'\n');
console.log(JSON.stringify({...timing,tools:undefined,codeProvenance:`${provenance.length} unchanged files`},null,2));
