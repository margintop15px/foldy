import fs from 'node:fs';
const here = new URL('./',import.meta.url);
const reviewed = new Set([...fs.readFileSync(new URL('review-notes.mjs',here),'utf8').matchAll(/(?:review|sameReview)\("([^"]+)"/g)].map(m=>m[1]));
const results = JSON.parse(fs.readFileSync(new URL('results.json',here),'utf8'));
for(const s of results.scans) if(s.stage<3&&!reviewed.has(s.key)) console.log(JSON.stringify({key:s.key,issues:s.issues,errors:s.report?.errors,toolErrors:s.report?.toolErrors,usage:s.report?.agentUsage,findings:s.report?.findings.map((f,i)=>({n:i+1,claim:f.claim,kind:f.kind,uncertainty:f.uncertainty,evidence:f.evidence.map(e=>({path:e.path,quote:e.quote}))}))},null,2));
