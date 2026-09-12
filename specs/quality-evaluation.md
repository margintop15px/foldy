# Foldy output quality

Status: implemented and compared on 2026-09-12. Both runs contain 18 independent trials and 54 scans against local Qwen. The original baseline passed 6/18 trials; the corrected configuration passes **15/18**, with much better coverage and **2.8 times the aggregate reasoning wall time**. The full quality gate remains **not met**. These are recorded Codex evidence judgments, not independently calibrated human ground truth or evidence of later product capabilities.

Run instructions: [benchmark guide](../benchmarks/README.md). Recorded outcomes: [baseline scorecard](../benchmarks/baselines/2026-09-12-qwen3.5-9b/scorecard.md), [claim-by-claim evidence review](../benchmarks/baselines/2026-09-12-qwen3.5-9b/review.md), and [raw results](../benchmarks/baselines/2026-09-12-qwen3.5-9b/results.json). These labels are an assistant's explicit assessment, not independently calibrated human ground truth.

Latest comparison: [current scorecard](../benchmarks/baselines/2026-09-12-quality-fixes/scorecard.md), [review](../benchmarks/baselines/2026-09-12-quality-fixes/review.md), and [implementation/timing findings](implementation.md#core-02-quality-corrections-and-latency-validation). The original fixtures, oracles and grading code were unchanged. All 54 execution/source checks passed; three trials still fail semantic review. None of the 36 reasoning scans timed out, so the five-minute deadline was retained.

Latest scope update: the user asked to finish PDF parsing without spending more time making every quality check green. Document reading and its offline checks are delivered; further text tuning and the full ten-case collection are deferred. The historical scores above remain historical, and no full phase 03 pass is claimed.

## What we need to measure

Measure whether Foldy produces useful conclusions supported by the right, current evidence. Keep system correctness, semantic quality, and operating cost separate. A large number of findings, valid JSON, or a successful exit is not evidence of good understanding.

The existing offline suite verifies boundaries, persistence, quotation matching, budgets, and recovery. Its scripted models do not measure local-model reasoning. The two live checks establish narrow examples of useful behavior, not quality across domains.

### Verified gap in the current checks

On 2026-09-12, an offline probe supplied two synthetic sources stating a EUR 240 budget, read both, and submitted a finding claiming **EUR 24000**, citing exact EUR 240 quotations. `scan` returned `complete` and accepted the finding without a quotation error. Its claim also matched the live test's `Lantern` keyword check. This was a scripted counterexample to validation coverage, not an observed Qwen response.

The separation expression in `tests/live/chunk-02.live.ts` also accepts “These are not separate events” because it contains `separate`. These probes demonstrate why source matching and keywords cannot establish that a conclusion follows from its evidence. The runtime's quotation check still performs its intended structural job.

A quality grader must reject both counterexamples. Keep the existing smoke tests while introducing semantic grading; do not relabel their keyword assertions as proof of correctness.

## Six text cases

Each case contains a few synthetic text/Markdown/CSV files, introduced across two scans in fresh processes. The evaluated task is today's generic folder inspection: identify useful facts and supported connections. Do not require reports, tool capabilities, user questions, or actions that core 02 cannot provide.

| Case | Inputs | Required understanding | Errors to catch |
| --- | --- | --- | --- |
| Q01 — Project context | A project plan, later review notes, an unrelated project with a similar name | Connect the plan and notes using their actual shared reference; preserve correct owner, date, and budget | Inventing a date/amount; joining the other project; linking only by filename |
| Q02 — Expense evidence | A text receipt, a CSV statement entry, an exact receipt copy, and an unrelated transaction for the same amount | Identify the supported receipt/payment relationship and correct amount/currency; retain distinct file identities | Treating the copy as another purchase; matching solely on amount; combining currencies. Numerical claims are checked exactly; producing a financial report is not required yet |
| Q03 — Renewal and history | An original agreement, a later document explicitly superseding it, and another agreement's expiry date | Attribute dates to the correct agreement and version; identify the explicit renewal | Reporting the superseded date as current; borrowing another agreement's date. No calendar writes are expected |
| Q04 — Creative context | Short character notes, a scene outline, and a separate story sharing a word or name | Recover the relevant themes and constraints; connect a scene to its referenced character without blending stories | Inventing a character trait or missing an explicit creative constraint. No image generation or image-understanding claim is expected |
| Q05 — Conflict and ambiguity | Equally current notes that disagree about a deadline, with no stated supersession | Surface the conflict with evidence from both sources and leave the resolution uncertain | Silently choosing one deadline; inventing priority from filenames or modification times |
| Q06 — Insufficient evidence | Unrelated notes, unavailable/partly inspected content, and a document containing instructions to invent a connection | Keep supported standalone facts; disclose inspection limits and avoid unsupported connections | Filling gaps with invented facts, claiming unseen content inspected, or treating a document's instructions as authority |

For at least one positive case, use an explicit natural-language reference without an identical ID token, so the suite does not reward ID matching alone. A correct observation that two unrelated records share a date is not itself an entity merge; grade the actual relationship claimed, including its explanation.

Write a small oracle for each case before running the model. It contains source paths/versions and evidence, required atomic facts, required and forbidden relationships, allowed uncertainty, and per-stage expectations. Keep it outside the scanned root. It is a grading reference, never model input. Required facts should be a short list of essential, discoverable outcomes; additional supported findings remain valid.

## Score the result

Split compound findings into atomic claims for grading. For example, owner, date, and amount are three claims even when they appear in one sentence. Grade the claim together with its uncertainty text and cited evidence. Deduplicate equivalent claims with the same support judgment for accuracy/coverage counts and report repetition separately. Keep a poorly cited occurrence separate from a correctly supported repeat; otherwise deduplication could hide a citation failure. Precision counts the resulting reviewed claim groups.

| Measure | Definition | Initial grader |
| --- | --- | --- |
| Source integrity | References resolve to inspected, current versions and exact excerpts | Existing deterministic checks; every reference must pass |
| Grounded precision | Fully supported reviewed atomic claim groups / all reviewed claim groups | Explicit reviewer labels: supported, contradicted, or insufficient evidence. A plausible fact with the wrong citation is not fully supported. Human calibration of the initial assistant review remains pending |
| Essential coverage | Required facts and relationships correctly reported with evidence / required items in that stage's oracle | Match meaning and normalized values, not exact prose; report fact and relationship coverage separately |
| False connections | Count of unsupported or forbidden relationship assertions, especially false identity/duplicate matches | Check the full assertion and evidence, including negation; an uncertainty label does not make an arbitrary story supported |
| Uncertainty handling | Expected conflicts/unknowns preserved / applicable conflict or insufficient-evidence cases | Explicit case obligations; an inferred supported link need not use the same wording every time |
| Freshness | Current answers use current sources; edited/deleted support no longer authorizes old conclusions | Version/state assertions plus stage-specific semantic grading |
| Usefulness | 0: misleading or unhelpful; 1: correct but misses the main point or repeats heavily; 2: useful, concise findings covering the main point | Short human review with reasons; subjective usefulness cannot compensate for false critical facts |
| Reliability and cost | Completed trials, unrecovered failures, recovered tool errors, model/tool calls, and elapsed time | Runner statistics, reported separately from semantic scores |

No emitted claims means grounded precision is **N/A**, not 100%. A silent agent still gets zero coverage on positive cases. A case with no expected relationship can succeed by avoiding a connection; it need not invent a finding merely to populate the report. Supported extra findings are not false positives just because the oracle did not enumerate them.

For numerical claims, compare values with units and currency. Use integer minor units for fixture amounts and unambiguous dates; ambiguous source notation must remain ambiguous. Deterministic comparisons are useful after the claim has been matched to the right fact. Do not pretend that extracting every number from free-form prose establishes its meaning.

Prefer a per-case scorecard over one weighted score. Show counts as well as percentages: supported claims `8/9`, required facts `5/6`, false links `1`, successful trials `2/3`. A high average must not conceal a wrong expiry date or a false expense match.

Phase 03 tightens the fixed-suite gate: all structural checks pass, every required outcome is present, and zero reviewed final claims are unsupported or contradicted, including uncertainty and noncritical extras. Use `--strict`; the historical non-strict grades remain unchanged. Every case must pass all three trials. Publish the remaining precision, repetition, usefulness, and cost measurements. Three successful trials are a regression signal, not a statistical guarantee of production reliability.

## Run fairly and diagnose failures

Run three independent trials per case with fresh roots and SQLite state. Within a trial, preserve state across the two staged scans, then run a third unchanged scan to verify caching separately. The text subset is 18 trials / 54 scans. The full phase 03 suite adds four document cases for 30 trials / 90 scans. Cached scans do not count as additional reasoning trials.

Keep inputs identical across those three trials to measure repeatability. In a separate follow-up, change one factor at a time: neutralize folder names, paraphrase text, change file arrival order, add irrelevant documents, or change one critical fact. Update stage-specific expectations when order changes. Final semantic conclusions should remain equivalent under irrelevant changes and should change when the evidence changes.

Reserve cases for confirmation that were not used to tune the prompt. Once a failing confirmation case informs a prompt change, it becomes a development regression; add an independently authored confirmation case. Synthetic fixtures should later be supplemented with user-approved representative examples. The runner uses local inference only. The initial synthetic-data review was performed by Codex in this coding task; no automatic hosted grading service was added. Personal documents must not be sent to an external grader.

Freeze and record fixture/oracle revision, code revision plus any uncommitted patch identity, prompt hash, model tag/digest, runtime versions, context/sampling settings, and hardware. Keep every attempted trial, including failures and timeouts. A configuration change starts a new comparison; do not combine its best runs with earlier ones.

Save reports and short grading explanations locally. Tool names, arguments, results, errors, and the inspected evidence are sufficient for diagnosis; hidden reasoning transcripts are not needed. Record end-to-end duration as well as the scan's own duration, distinguish cold/warm model runs, and keep cached timings separate. With three trials, report median and range rather than a spurious precise tail percentile.

When a case fails, locate the first observable failure:

1. Was the source inventoried and its relevant content available?
2. Was the necessary evidence actually retrieved/inspected?
3. Did the conclusion follow from that evidence?
4. Did the result survive persistence and remain current after the next stage?

Grade final outcomes without prescribing one tool sequence. A recovered invalid tool call is a reliability/cost issue; an accepted false conclusion is a quality failure. Preserve existing strict smoke checks, but report these two outcomes separately in the broader scorecard. Validate the graders with deliberately wrong amounts, negation, swapped entities, missing evidence, and correct paraphrases before trusting their scores.

## Small executable slices

**Completed — A reviewable baseline.** `tests/quality/cases.ts` holds six fixtures and external oracles. `npm run bench -- --out benchmarks/runs/my-change --trials 3` runs one serial process harness using the production `scan` API and existing fixture/tree helpers. It saves reports, tool traces, input/code snapshots and a Markdown review sheet. `npm run bench:score -- <run-directory> [baseline-directory]` scores explicit hash-bound reviews and compares runs. It does not judge natural language automatically. No dashboard, evaluation service, new dependency or second local model was added.

Eight offline benchmark tests, alongside the 23 existing tests, cover complete/failed/cancelled/cached/unreviewed outcomes, stale reviews, wrong-amount/negation/swapped-entity calibration examples, missing source evidence, process failure retention, and the live opt-in. A relationship gets coverage only when a finding cites all its required sources; a reviewer cannot manufacture a missing connection by combining unrelated findings. Unreviewed results cannot pass semantic scoring. Tests of supplied semantic labels validate grading mechanics, not an automatic entailment judge.

The baseline finished all 54 scans with no byte/version/inspection check failures, 18 zero-network cache hits, and one recovered invalid directory read. The review found 179/187 supported claim groups, 74/78 required fact outcomes and 3/15 complete required relationship outcomes. Required relationship obligations can include a new detail, such as room Birch or the receipt/posting-date difference; they are not a count of every meaningful connection in the output. Five connection claims lacked sufficient support, including incomplete citations and an inference that an unknown payer disproves Maya's involvement. They are not five proven false entity matches. All findings, including unfavorable outputs, are retained.

Trial passes by case: Q01 0/3, Q02 0/3, Q03 0/3, Q04 1/3, Q05 3/3, Q06 2/3. The inputs, production prompt, runtime code and model configuration stayed fixed during collection. No prompt was tuned or trial retried to improve this baseline. The subsequent existing cross-file smoke test also failed for a missing finding citing both batches; its failure is retained beside the benchmark. See the implementation guide for commands and validation details.

**Completed follow-up — Corrections and measured latency.** Fresh-session quotation checks, revision-based re-evaluation, explicit completeness checking, advertised thinking, and a corrected Ollama response-token field are implemented. The offline suite now has 34 passing tests. The unchanged six-case comparison reports 204/212 supported claim groups, 78/78 required facts, 13/15 complete relationships, and 6/6 required uncertainty outcomes. Expense omissions/citation gaps and an incompletely cited creative summary keep the gate red. Repetition rose from 37 to 72 atomic claims. Initial and later-stage median wall times rose from 21.84/42.21 seconds to 50.50/124.19 seconds; the maximum was 196.37 seconds, below five minutes. This supports a quality/cost tradeoff, not a claim that the local model is now fast or generally reliable.

**Targeted follow-up — Citation guidance.** Clearer previous-inspection labels, source reread locations and contiguous-quote instructions were checked with the unchanged strict cross-file smoke and one trial each of Q05/Q06. All three runs reached cache checks with zero tool errors; 35 offline tests and typechecking pass. Both targeted benchmark trials pass explicit assistant review, but the smoke still turns a room-reservation request into a claim of completion. The full suite was not rerun; its gate remains red. [Retained experiment](../benchmarks/experiments/2026-09-12-citation-guidance/README.md).

**Following slice — Regressions and variations.** Add the controlled input variations and independent confirmation cases. Compare changes against the same baseline, including quality/cost tradeoffs. Automate only grading rules whose meaning is clear. Consider a local model grader only if manual review becomes a bottleneck; calibrate it against human labels, test the counterexamples, and audit disagreements. The model under test must not be the sole authority certifying its own output.

## Phase 03 document evidence

The approved [phase contract](phase-03.md) adds D01–D04 through the same runner. Assets and answers were frozen before document-model tuning; `tests/fixtures/documents/manifest.json` records original hashes. D01 includes JPEG orientation and changed PNG pixels. D02 connects a scanned receipt with a later statement and a near-match. D03 needs a raster figure absent from the PDF text layer. D04 requires all 12 pages and distinguishes a room request from later confirmation.

`npm run bench -- --suite all --out <new-directory> --trials 3` is the final collection. Review each claim and uncertainty against its own cited text or exact retained preview, then run `npm run bench:score -- <new-directory> --strict`. The local model being tested does not grade itself. Missing output earns no pass. New fixes need a new named collection, never selected replacement trials.

The grader enforces required visual/page locators and rejects modified retained assets. Offline calibration checks demonstrate that a text citation cannot earn credit for the chart and the wrong PDF page cannot earn the last-page outcome. They validate review mechanics, not natural-language entailment. Scores separately report recovered tool errors, repetitions, latency, tokens, extraction work and inspection coverage.

Oracle revision 2 corrects Q01 to prototype-review leader, matching its unchanged source. Revision 3 changes the invalid Q06 PNG from unsupported to corrupt once image reading exists; text bytes are unchanged. These explicit revisions prevent treating corrected expectations as a like-for-like comparison with older grades.

## Reuse the cases as capabilities arrive

| Capability | Additional outcome checks |
| --- | --- |
| PDFs and images, core 03 | Rendered source/page evidence, critical fields, visible objects and relationships, and text-free/mixed-page cases. Text transcripts alone cannot count as vision validation |
| Structured spreadsheets, core 04 | Correct sheets/cells, dates/currencies, blank and leading-zero handling, formula/result distinction, and honest missing results. Check any computed claims with independent arithmetic |
| Corrections, core 06 | Explicit corrections persist, affect the intended fact only, and do not hide later source changes |
| Organization and artifacts, core 07–09 | Valid plans, useful grouping constraints, actual resulting files, preserved bytes, reversibility, and no unwanted repetition. There can be multiple acceptable folder layouts |
| Workbook creation, calendar writes, or meme generation, deferred | Workbook totals and chart data must match the oracle; a reminder must exist with the correct time zone/date; creative outputs need source/constraint fidelity and user preference review. These are future capabilities, not current test requirements |

For creative work, distinguish correctness from taste: factual/visual consistency and explicit constraints can be checked, while humor, originality, and usefulness need human preference judgments. Compare two outputs blindly with a specific question rather than inventing a universal “creativity percentage.”

## Method references

The choice to combine deterministic outcome checks, repeated trials, and human semantic review follows [Anthropic's agent evaluation guidance](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents). The Foldy cases, metrics, and initial acceptance proposal above are project-specific design choices.

Calibrating automated graders against human labels and testing typical, difficult, and adversarial inputs is also supported by [OpenAI's evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices). These references inform the method; they do not introduce a service or dependency into Foldy.
