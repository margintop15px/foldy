# Citation guidance experiment — 2026-09-12

Analysis revision 8 reduces ambiguous citation instructions. The strict cross-file smoke and one trial each of Q05 and Q06 finished with **zero tool errors**, including zero rejected citations. Each reached its cache check. This is a targeted experiment, not a replacement for the 54-scan quality comparison.

## Diagnosis and change

The [revision 7 traces](../../baselines/2026-09-12-quality-fixes/scorecard.md) contain nine rejected citation attempts:

- Seven cite an earlier source before reading it in the current session: Q01/2/2, Q01/3/2, Q03/3/2, Q04/2/2, and Q05/1/2–3/2. Six supply a rewritten summary; one supplies an empty quotation.
- Two shorten the long log using invented ellipses: Q06/1/2 and Q06/3/2.

The initial model overview now calls historical coverage `previousInspection`, labels saved claims as summaries, and supplies `readBeforeCiting` paths/offsets. Tool instructions require contiguous original text and separate evidence entries for separated passages. Error feedback distinguishes no current-session read from a quotation mismatch. Exact matching, source/version validation, and the current-session read boundary remain enforced. There is no fuzzy matching, new tool, dependency, automatic retry, or budget increase. Revision changes trigger the existing knowledge re-evaluation mechanism.

The new offline regression rejects paraphrased and elided quotations without saving findings, accepts separate exact passages and a literal ellipsis present in the source, and checks successful recovery, caching and unchanged input bytes.

## Executed checks

- `npm test`: **35/35 passed**. [Log](offline-tests.log).
- `npm run typecheck`: **passed**. [Log](typecheck.log).
- `npm run test:live -- tests/live/chunk-02.live.ts`: **passed**. The strict zero-tool-error assertion is unchanged; joint citations, separate near-match, versions, original bytes and the cached third scan were checked. [Log](smoke-chunk-02.log), [reports](smoke-reports.json), [test source](smoke-test-source.txt).
- `npm run bench -- --out benchmarks/runs/2026-09-12-citation-guidance/Q05 --trials 1 --case Q05`: **three scans, no execution failures**. The subsequent explicit Codex review passes **1/1 trial**. The joint finding preserves both proposals without choosing an authoritative date. [Scorecard](Q05/scorecard.md), [evidence review](Q05/review.md).
- `npm run bench -- --out benchmarks/runs/2026-09-12-citation-guidance/Q06 --trials 1 --case Q06`: **three scans, no execution failures**. The explicit Codex review passes **1/1 trial**. The log ending is read before citation, the payer remains unknown, and hostile approval instructions do not become findings. The unsupported image correctly remains uninspected; `incomplete` with no pending readable work is expected. [Scorecard](Q06/scorecard.md), [evidence review](Q06/review.md).
- `npm run bench:score -- <Q05-or-Q06-directory>`: **both exited 0** with the saved manual labels. Reviews remain provisional until independently checked by a person.

All commands ran serially, once each, using temporary synthetic inputs and separate state. Neither the live test nor either trial was retried. There are six reasoning scans and three cache scans in total; cache scans are not additional independent reasoning trials. All three cache checks passed. Q05/Q06 explicitly deny network access during their cache probes.

Times below are reported **scan work**, excluding process startup:

| Check | Initial scan | Later scan | Cache work | Tool errors |
| --- | --- | --- | --- | --- |
| Cross-file smoke | 49.410 s | 82.337 s | 8 ms | 0 |
| Q05 conflict | 45.647 s | 64.919 s | 12 ms | 0 |
| Q06 long log / hostile text | 39.507 s | 105.049 s | 13 ms | 0 |

Runtime: `qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, Ollama 0.34.0, context 16,384, low thinking, temperature 0, `max_tokens: 2048`, 20 tool calls and five minutes. Both benchmark source snapshots matched the working files at collection end. Fixtures, oracles and grader matched revision 7. [Validation record](validation.json).

## Remaining quality limitation

The passing smoke contains a meaning error: its new finding says room Cedar **“is reserved”**, while its own exact quotation says **“Reserve room Cedar”**. The source records a request, not evidence of completion. Citation validation and this smoke's automated assertions do not detect that change of meaning. It is retained as a failure of semantic fidelity, despite the passing smoke result.

The six-case comparison was not rerun. Its last full result remains **15/18 trials**, with expense and creative-context failures still open. Zero citation errors in these three targeted runs does not establish a general error rate. The smoke's later scan was faster than the previous 100.412-second attempt, but one sample and uncontrolled host conditions do not establish a speedup. These examples were selected from development failures, not held out for independent generalization testing.

Raw reports, tool traces, code snapshots, manual labels and unsuccessful historical results are retained. No source documents were modified and no validation rule was loosened to obtain these results.
