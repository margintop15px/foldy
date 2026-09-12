# Foldy v1 implementation chunks

Status: chunks 01–02 are implemented. Phase 03 is in progress under its stricter semantic gate. Chunks 04–09 and Telegram T01–T02 remain unimplemented; their commands are target development interfaces. The Telegram specification is complete as a design deliverable, not as runtime evidence.

Read [the behavioral specification](foldy-v1.md) before executing a chunk. [README](README.md) holds accepted decisions and progress.

The [messaging contract](telegram-v1.md) selects CopilotKit Channels with Telegram first and adds two optional integration chunks without renumbering core work. The chosen order is 01–06, T01, 07–08, T02, then 09. Further providers will reuse the Channels boundary and Foldy operations after Telegram. Core operation remains usable without integration credentials. Adding the specification and this roadmap is the first deliverable; do not implement future prerequisites as part of that documentation change.

## Working agreement

Work on one chunk at a time. Each chunk has one primary runnable outcome, its own test file, and a stopping point. Later chunks extend earlier behavior without weakening its tests. Stop a completed chunk with a concise handoff; do not pull deferred capabilities into it.

Use TypeScript on Node.js 24 and Node's built-in test runner. Introduce `npm run foldy`, `npm test`, and `npm run typecheck` in chunk 01. The test script must accept explicit test paths so a chunk can be checked without a custom test harness. Keep model access replaceable by a simple test function; do not build a provider framework.

Model tests are explicitly opt-in. Offline tests must never contact Ollama, download a model, or rely on personal documents. Name live tests `tests/live/chunk-NN.live.ts` and exclude them from ordinary test discovery. Introduce `npm run test:live -- <test-file>` as `FOLDY_LIVE=1 node --test --test-concurrency=1`; live tests must refuse model access without that flag. Use temporary test roots/state directories and clean up only data created by that test.

Telegram uses `tests/telegram-01.test.ts` and `tests/telegram-02.test.ts`, with live counterparts under `tests/live/`. Offline integration tests replace network access and the clock; they do not contact Telegram, CopilotKit Intelligence, or Ollama. Exercise the installed SDK's public types/rendering and StateStore contract as well as application behavior. Real-bot checks require the same explicit live opt-in plus a dedicated personal test bot, an Intelligence test project/channel, local pairing to disposable state, and synthetic content. Missing live evidence is pending, not permission to label an integration complete.

Use the Pi SDK's existing lifecycle/context facilities. Keep custom tools narrow and application-owned. Use Node's built-in `node:sqlite` in chunk 02, add document/image extraction dependencies in chunk 03, use ExcelJS for spreadsheet reading in chunk 04, and add Chokidar in chunk 05. Include exact installed dependency versions in the lockfile. Internal module boundaries should follow actual code pressure rather than a speculative architecture.

### Completion evidence for every chunk

Record the following beneath the chunk when implemented:

- Relevant commit identifier if one exists, otherwise changed paths.
- Exact commands run and their outcomes.
- Acceptance IDs covered, including any live-model evidence.
- Remaining limitations and the next chunk's entry point.

Mark a chunk complete only when its runnable outcome and required checks pass. A missing live check is pending evidence, not a pass. Do not create a separate report hierarchy for routine checks; keep the evidence here.

## 01 — Read a folder

**Prerequisite:** none. **Requirements:** V1-01–03, OBS-01/05, CTX-01, RUN-01/02, trust boundaries. **Scenarios:** A01, A02, text portion of A06.

**Outcome:** inspect a real folder with the local model and print findings with source references. The selected folder remains unchanged.

Implement the Node/TypeScript entry point, `scan <root>`, canonical root checks, text/Markdown/CSV reading, and explicit Pi tool registration. Print the input files, findings, source references, and errors. At this stage findings may live only for that run. Support visible failure for an unavailable local model and refuse remote fallback. Apply the initial run budgets immediately.

Supply Pi's configuration/resources explicitly; verify that hostile project files cannot change the application's tools or settings. Do not expose Pi's default unrestricted filesystem or shell tools. Select and document the local model's effective context size during the smoke check rather than confusing its advertised maximum with available memory.

**Run:** `npm run foldy -- scan ./tests/fixtures/text`

**Verify:** `npm test -- tests/chunk-01.test.ts` and `npm run typecheck`.

**Live check:** `npm run test:live -- tests/live/chunk-01.live.ts` against local `qwen3.5:9b`. The test inspects two synthetic text files and verifies usable source references. Offline tests exercise outside-path rejection, symlinks, dropped instructions, unavailable inference, and unchanged user-file bytes.

**Candidate experiment:** support an explicit `FOLDY_MODEL=<installed-local-model-id>` override in these same local smoke checks. Evaluate MiniCPM5-2B text reasoning and a structured tool call if its GGUF runs through the existing Ollama/Pi path. Record results, peak memory, latency, and backend/parser compatibility alongside the baseline. If that path fails, record the blocker rather than adding a custom tool-call parser or a second inference service to this chunk. Its text-only result is not a pass for chunk 03's visual tests.

**Stop:** one-shot text inspection works. Persistence, watching, and file mutation belong to later chunks.

Evidence (2026-09-11):

- Commit: `6043bbb` (`Implement Foldy chunk 01: local read-only scans`). Paths: `src/{cli,inventory,model,scan}.ts`, `tests/chunk-01.test.ts`, `tests/live/chunk-01.live.ts`, `tests/fixtures/text/{project.md,notes.txt}`, root `README.md`, `package.json`, `package-lock.json`, `tsconfig.json`, and `.gitignore`.
- `npm test -- tests/chunk-01.test.ts` and `npm test`: 13 passing offline tests for A01, A02, the text portion of A06, CTX-01 quotation checks, and RUN-02 call/time limits. Default discovery excludes the live test. Tests replace model access and reject network requests, including during Pi compaction. They check hostile project/global Pi resources, outside paths and symlinks, invalid/unread evidence, unchanged source trees, incomplete inputs, unavailable inference, oversized call batches, and cancellation.
- `npm run typecheck`: passed. `env -u FOLDY_LIVE node --test tests/live/chunk-01.live.ts`: intentionally refused before model access, confirming the opt-in guard.
- `npm run foldy -- scan ./tests/fixtures/text`: exited 0 with complete inspection, three source-referenced findings, five tool calls, and no errors in 18.036 seconds. This verifies the documented command-line entry point as well as the library test.
- `npm run test:live -- tests/live/chunk-01.live.ts`: passed on the final runtime integration. Qwen inspected both synthetic files, made five tool calls, and recorded three findings in **23.427 seconds**, with no tool errors. The review-date finding cites `notes.txt` line 2 and `project.md` line 3; the other findings identify Mara's responsibility and the room still to be chosen. Test checks verify exact quotations and unchanged input bytes. An earlier passing run took 20.105 seconds; these are smoke timings, not a performance benchmark.
- Configuration: macOS, M4 Pro / 24 GB, Node 24.19.0, Pi SDK and Pi AI 0.85.1, Ollama 0.34.0, `qwen3.5:9b` Q4_K_M, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`. Effective context from `/api/ps`: **16,384 tokens**. Response limit: 2,048 tokens; temperature: 0; `reasoning_effort: none`; provider retries disabled. Pi compaction is enabled with 2,048 reserved and 2,048 recent tokens and uses the same guarded local model connection.
- Peak observed Ollama allocation: **5,940,130,609 bytes (5.53 GiB)**, sampled through `/api/ps` once per second. This is Ollama's reported model allocation, not whole-process RSS or total machine memory; a short peak between samples could be missed.
- Retained failure: the first Qwen tool-use evaluation exhausted 20 calls in 113.877 seconds. It read both files but repeatedly supplied `observation`, `fact`, or similar values to a union-of-literals `kind` schema. Zero findings were accepted. Replacing that schema with an explicit enum and spelling out `observed` / `inferred` in the prompt resolved the failure without relaxing validation. The initial filesystem smoke also exposed Darwin's rejection of combining `O_NOFOLLOW_ANY` and `O_NOFOLLOW`; the reader now uses the appropriate single flag.
- Candidate command: `FOLDY_MODEL=hf.co/openbmb/MiniCPM5-2B-GGUF:Q4_K_M npm run test:live -- tests/live/chunk-01.live.ts`. The official GGUF downloaded and loaded locally, advertised tools, and used a 16,384-token context, but **failed** its first tool-bearing request with HTTP 400: `Failed to initialize samplers: failed to parse grammar`. Duration: 1.774 seconds; zero tool calls and findings. Digest: `e680c6c9f9033490cb68df7c1145f733a3a1b377b387af0937251a70d3c71a14`; peak observed Ollama allocation: 2,323,738,787 bytes (2.16 GiB), with only one sample. Text/tool quality and useful inference latency remain unmeasured because of this backend compatibility failure. No custom parser or second inference service was added. This is not a visual-understanding evaluation.
- Operational limits: 200 inventory entries, 32 directory levels, 64 KiB per text file, and 4,000 UTF-16 characters per tool read with continuation offsets. Unsupported, unreadable, invalid, oversized, or partly read inputs are explicit; no unsupported format is described as inspected. Finding references point to in-memory snapshots from this scan.
- Remaining scope: persistence and cross-session context start in **chunk 02** by storing the current source/finding/evidence records in SQLite. PDF/image inspection, structured spreadsheets, watching, the same-root process guard, and mutations remain in their assigned later chunks. No general v1 completion or model semantic reliability is implied by this two-file smoke check.

## 02 — Remember and connect

**Prerequisite:** 01. **Requirements:** OBS-04, CTX-01–04, records/state storage, persistence-related portion of V1-01. **Scenarios:** A03, A04, persistence portions of A08/A09, regression of A01/A02/A06 and RUN-02.

**Outcome:** a new scan connects a new file to relevant evidence from an earlier process run.

Use one small `node:sqlite` module for source identities, content versions, extracted text, actual inspection ranges, findings, and evidence. Exact repeated findings reuse their IDs. Identical files at different paths remain distinct sources; external renames conservatively become removal/addition. Older versions and stale findings remain historical.

Store `foldy.sqlite` beneath `~/Library/Application Support/Foldy/<sha256-of-canonical-root>/`. `ScanOptions.stateDir` and `FOLDY_STATE_DIR` replace the base directory, keeping the per-root subdirectory. Create private state and validate the database root/schema before use. Refuse state within the scanned root, including through symlink aliases. Never reset or discard an existing database on error.

Inventory and fingerprint each scan before using saved knowledge. Changed, missing, or unverifiable sources cannot support current findings or retrieval. Incomplete enumeration does not mark unseen sources deleted. A finding invalidated by a source transition must be validated again before becoming current, even if the source later returns to earlier bytes.

Give each fresh Pi session a bounded overview of changes, current sources, and saved findings, including their kind and uncertainty. `search_context(query, offset)` performs parameterized literal text search over current text/findings with ten-result pages and short snippets. `read_file(path, offset)` retrieves the original version from SQLite. New findings require exact quotations from ranges read in this session; extraction, search, and inspection in an earlier session do not authorize a new citation.

Ask for new contributions and complete citations, retain uncertainty in the saved overview, and use low reasoning effort when Ollama advertises thinking support. Record the selected mode. After a successful initial pass, one completeness check can finish partial reads and add omitted facts. It shares the same session, 20-call counter and five-minute deadline; failure, cancellation or exhaustion prevents another pass. This is a completeness aid, not an independent semantic judge.

Save validated findings, inspection coverage, and unfinished-work status on controlled completion, inference failure, or cancellation. Unchanged completed work with the same model tag and analysis revision returns `cached: true`, zero model/tool calls, and current findings without contacting Ollama. New/changed inputs, loss of current evidence, a different tag/revision, or unfinished reasoning cause another run. Unsupported files remain visible without repeatedly causing inference by themselves. A newly observed entry or changed unsupported-file metadata supplies context once; a root with no readable text makes no model requests.

An analysis revision change reports `rebuildingKnowledge: true` and re-evaluates readable sources. Old findings remain historical until revalidated; exact findings reuse their IDs. Schema 1 migrates transactionally to schema 2 by adding the analysis revision to the saved run. Bump `ANALYSIS_REVISION` when changing reasoning instructions or evidence rules so an old cache cannot bypass the change.

Bring the persistence writer guard forward from chunk 05: acquire SQLite's write transaction before inventory and commit when results are saved. Refuse an overlapping scan of the same root database immediately. Commit the initial empty schema before starting the first scan transaction; abrupt termination rolls back scan work and preserves previously committed knowledge. Normal user file operations remain possible. No separate lock service is added.

Create `tests/fixtures/cross-file/batch-1` and `batch-2`. The fixture test driver copies these into the same temporary root in order and invokes fresh scan processes; the two batch directories are not separate workspaces.

**Run:** `npm run foldy -- scan ./tests/fixtures/text` twice; the second run reuses internal state without duplicating unchanged source versions.

**Verify:** `npm test` and `npm run typecheck`. Cover fresh processes, cached scans with no network access or duplicate records, distinct file identities, root isolation, stale/unverifiable evidence, partial inspection, failed inference, cancellation, retry, overlapping scans, interrupted transactions, database failures, and unchanged source bytes. Keep all test state outside source folders.

**Live checks:** `npm run test:live -- tests/live/chunk-01.live.ts` and `npm run test:live -- tests/live/chunk-02.live.ts`. The second driver adds the staged cross-file fixtures to one temporary root across fresh CLI processes. A finding must cite the earlier plan and later notes while keeping the unrelated near-match separate; a third unchanged process must use cached results.

**Stop:** cross-file understanding persists. There is no separate vector store, graph service, or memory-provider framework.

Evidence (2026-09-11–12, Europe/Madrid):

- Changed paths: new `src/store.ts`, updates to `src/{inventory,model,scan}.ts`, new `tests/chunk-02.test.ts`, `tests/helpers.ts`, `tests/support/scan-process.ts`, `tests/live/chunk-02.live.ts`, and the staged `tests/fixtures/cross-file/` collection. Chunk 01 tests now isolate state outside their source trees. Root README and these specifications document the interfaces and boundaries. No new dependency or slice 02 commit was added.
- `npm test`: **23 passing offline tests** (13 slice 01 regressions and 10 slice 02 tests). A03/A04 cover three fresh processes, source/finding identity, literal search and paging, root isolation, exact finding deduplication, and cached scans without network access. A06/RUN-02 cover separately persisted inspection ranges, quotations spanning adjacent inspected excerpts, unseen quotation rejection after search, failure, controlled cancellation, retry, and unchanged unsupported inputs. A08/A09 cover missing/unreadable/unverified sources, incomplete enumeration, an unavailable root, byte reversion, conservative rename identity, writer refusal, and a killed process rolling back uncommitted versions/findings while preserving prior knowledge. A01 and storage checks cover private state, containment through aliases, a changed root, root/schema mismatch, corrupt databases, injected database I/O failure, and unchanged source bytes.
- `npm run typecheck`: **passed**. `git diff --check`: **passed**. Tests use temporary state outside source folders; child-process offline drivers also reject every network request.
- `npm run test:live -- tests/live/chunk-01.live.ts`: **passed** after the final shared-prompt change. Final scan: **24.075 seconds**, four model calls, four tool calls, two findings, no tool errors, both inputs fully inspected and unchanged. Earlier integration runs also passed in 31.169 and 23.392 seconds. Peak sampled Ollama allocation was **5,940,130,609 bytes (5.53 GiB)** across 25 samples on the final run; this is `/api/ps` model allocation, not process RSS.
- `npm run test:live -- tests/live/chunk-02.live.ts`: the initial run **passed** across three fresh CLI processes. Batch 1 took **10.075 seconds**, three model calls and two tool calls, recording the Project Lantern plan. Batch 2 took **29.502 seconds**, three model calls and five tool calls, and produced a finding citing both `archive/plan.md` lines 3–5 and `meetings/notes.txt` lines 2–4. The shared `LTN-204` project identifier supports the connection. The separate `FEST-811` festival record remained a distinct finding despite matching date and EUR 240 amount. All three sources were fully inspected with exact versioned quotations and unchanged bytes. Batch 3 returned the same IDs/findings with `cached: true`, **zero model/tool calls**, and an **8 ms** scan duration. These timings exclude process startup and are smoke measurements, not benchmarks. The later failed rerun and targeted prompt correction are retained below.
- Retained failure: the live rerun after cache invalidation changes passed batch 1 in **27.927 seconds** (seven model calls, six tool calls), but failed the batch 2 check after **72.206 seconds** (15 model/tool calls). Foldy rejected one inexact quotation from `archive/plan.md`; the model subsequently recorded a valid cross-batch finding, but also speculated in a separate finding's uncertainty about shared resource allocation based only on matching date/amount. No invalid quotation was accepted. The test stopped before batch 3 and was not counted as a pass. The generic prompt was clarified to retrieve every cited original in the current session, copy quotations exactly, and require concrete linking evidence for cross-file connections instead of speculative date/amount matches. Quotation and live acceptance checks were not relaxed.
- After that prompt correction, `npm run test:live -- tests/live/chunk-02.live.ts` **passed** with the original checks unchanged. Batch 1: **16.198 seconds**, three model calls, two tool calls, one finding. Batch 2: **39.391 seconds**, seven model/tool calls, a supported `LTN-204` connection citing both batches, and a separate `FEST-811` finding; three current findings total, no tool errors, all three sources fully inspected and unchanged. Batch 3: **12 ms**, `cached: true`, identical finding/source IDs, zero model/tool calls. The final evidence spans two positive live runs and the retained failure; it does not establish model determinism.
- Runtime: macOS, M4 Pro / 24 GB, Node 24.19.0, built-in SQLite 3.53.3, Pi SDK/AI 0.85.1, Ollama 0.34.0, `qwen3.5:9b` Q4_K_M, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`. Effective context **16,384 tokens**, response limit 2,048, temperature 0, `reasoning_effort: none`, provider retries disabled, fresh Pi sessions with existing compaction settings. No model/backend change or cloud fallback was needed.
- Retained limitations: search uses literal substrings with SQLite's ASCII-only case folding, ten hits per page, and 240-character snippets. The overview budgets 2,000 characters for changes, 6,000 for source rows, and 4,000 for saved findings, plus framing. Cache invalidation compares model tags; changing weights under an unchanged tag is not detected on a cache hit. Reworded claims or changed supporting evidence can create separate findings; semantic deduplication is not implemented. History is retained in SQLite with no retention policy or history command yet. The writer guard coordinates processes sharing the same per-root database, so overrides must use the same base to share state and locking. The small synthetic live collection establishes this slice's supported connection, not general semantic reliability.
- Next: **chunk 03 — Understand images and PDFs**. Watching, structured spreadsheets, corrections, mutations, and generated artifacts remain in their assigned chunks.

### Quality baseline after core 02 — executed, quality gate not met

Evidence (2026-09-12, Europe/Madrid):

**Subsequent configuration correction:** the baseline's 2,048-token response limit was configured in the SDK but sent as `max_completion_tokens`. A request-level probe later confirmed this field, while [Ollama 0.34.0's request type](https://github.com/ollama/ollama/blob/v0.34.0/openai/openai.go#L102) reads `max_tokens`. The intended client cap was therefore not applied through the supported field. The raw baseline and its original manifests remain unchanged; interpret their token-limit setting as configuration intent. Current code explicitly selects `max_tokens`, with an offline test inspecting the actual request. The five-minute scan deadline was always enforced by Foldy.

- Added `tests/quality/{cases,harness,scan-process,run,score}.ts`, `tests/quality.test.ts`, the benchmark commands in `package.json`, `benchmarks/README.md`, and the retained baseline under `benchmarks/baselines/2026-09-12-qwen3.5-9b/`. The production change is one optional tool-event callback in `src/scan.ts` for local diagnostic traces. No inference prompt, dependency, authority or file-format capability changed. Ad hoc `benchmarks/runs/` output is ignored; the baseline is retained.
- `npm test`: **31 passing offline tests**, comprising 23 existing tests and eight benchmark/calibration tests. `npm run typecheck`: **passed**. The new checks cover unreviewed versus passed results, exact-quote-but-wrong-claim examples, stale/missing evidence and reviews, required joint citations, failure/cancellation/cache status, process interruption output, and live opt-in. Semantic calibration examples use explicit labels; they do not implement an automatic natural-language judge.
- `npm run bench -- --out benchmarks/baselines/2026-09-12-qwen3.5-9b --trials 3`: **completed all 54 scans** over 18 fresh trials in 19m55s. It exited 0 for execution checks; semantic results were still unreviewed at that point. All 36 staged scans finished their readable work and all 18 unchanged scans were zero-network, zero-model/tool-call cache hits. Q06 intentionally reports `incomplete` for an unsupported image placeholder. No user-file bytes changed; all checked source identities, versions, inspection ranges and stale-source exclusions passed. One `read_file("notes")` request was refused as a directory and recovered in Q05/3/1; it is retained as a tool error, not an accepted finding or failed trial.
- The completed explicit Codex review gives **6/18 full trial passes**, **179/187 supported claim groups**, **74/78 required fact outcomes**, and **3/15 full required relationship outcomes**. Case passes: Q01 0/3, Q02 0/3, Q03 0/3, Q04 1/3, Q05 3/3, Q06 2/3. Gaps include omitted room/charge/expiry details, repeated summaries, missing sources for otherwise correct connections, and treating an unknown payer as evidence against a named payer. Five insufficiently supported connection assertions include citation gaps; they are not five proven false identity matches. **The quality gate is red.** `npm run bench:score -- benchmarks/baselines/2026-09-12-qwen3.5-9b` correctly exits 1.
- Provenance and cost: all 36 live scans used `qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, Ollama 0.34.0, effective context 16,384, temperature 0, 2,048 output tokens, reasoning disabled and no retries. Node 24.19.0 / SQLite 3.53.3 on Apple M4 Pro / 24 GiB. Ollama initially had no loaded model; later runs were warm. Totals: 164 model calls and 166 requested tool calls. Median cached scan work was 12.5 ms; median cached process wall time was 974.5 ms. Per-case median/range timings, every raw report and tool trace, frozen fixtures/oracles, code hashes and the exact uncommitted source snapshot are in the baseline. All starting code fingerprints matched at collection end. Grading validation was subsequently tightened to require joint citations; no baseline grade changed, and its final source/hash are retained separately.
- `npm run test:live -- tests/live/chunk-01.live.ts`: **passed**. 27.070-second scan, four model calls, four tool calls, two findings, no errors, full text inspection and unchanged bytes. Peak sampled Ollama allocation was 5,940,130,609 bytes across 28 samples, not whole-process RSS.
- `npm run test:live -- tests/live/chunk-02.live.ts`: **failed**, retained without retry or prompt tuning. Batch 1 completed in 15.111 seconds (three model calls, two tool calls). Batch 2 completed in 50.588 seconds (12 model/tool calls), with exact quotes and no tool errors, but repeated the Lantern summary with a single new-source citation instead of recording a finding citing both batches. Assertion: `A supported finding must cite both batches.` The smoke stopped before its cache stage. Both smoke logs are saved beside the baseline. Earlier passing evidence above remains historical; it does not establish repeatability.
- [Scorecard](../benchmarks/baselines/2026-09-12-qwen3.5-9b/scorecard.md), [full evidence review](../benchmarks/baselines/2026-09-12-qwen3.5-9b/review.md), and [benchmark instructions](../benchmarks/README.md). Labels were authored by Codex against synthetic sources and are provisional until independently human-calibrated. This is a small fixed development suite, not a holdout or production reliability estimate. The next quality work should improve newly reported outcomes and complete cross-file citations, then compare a separate run against this unchanged baseline; watching, formats and actions remain in their assigned slices.

### Core 02 quality corrections and latency validation

Status: corrections implemented and the 54-scan comparison completed on 2026-09-12. The full semantic gate remains **not met**: 15/18 trials pass the recorded assistant review.

- New evidence must have been read in the current Pi session, even when an earlier session inspected the same saved version. Durable inspection coverage remains separate. A regression rejects quotes assembled from old and new session coverage until the needed excerpt is read again.
- Analysis revision 7 invalidates previously current conclusions for re-evaluation while retaining source identities and historical findings. Schema 1 migrates transactionally to schema 2; failed re-evaluation stays pending rather than restoring obsolete conclusions. Exact revalidated findings keep their IDs.
- Generic instructions request useful new details, complete joint citations, and explicit uncertainty. Saved overviews preserve finding kind and uncertainty. Models advertising thinking use low reasoning effort. One completeness check shares the original session, 20-tool-call limit and five-minute deadline; the offline regression verifies that it cannot reset the budget.
- The Ollama adapter now sends the supported `max_tokens: 2048` field. The request-level test inspects actual serialized inference requests for both thinking-capable and non-thinking models. Reports include aggregate agent input/output tokens, largest response and the count of responses containing thinking, without saving reasoning text. These counters exclude separate Pi compaction and model preflight; scan duration includes them. `inputTokens` sums the SDK input field, excluding any separately reported cache-read/write tokens; it is not total prompt volume.
- `npm test`: **34 passed**; `npm run typecheck` and `git diff --check`: **passed**. All 15 captured production/benchmark files matched their starting fingerprints at collection end. The original six fixtures, oracles and semantic grader are unchanged, including a byte-for-byte comparison with the baseline scorer. Intermediate diagnostic runs remain separate under `benchmarks/runs/`; none is substituted for a failed full-run trial.

The full command was `npm run bench -- --out benchmarks/runs/2026-09-12-validated-quality --trials 3`. It finished **54/54 scans** in **55m32s**, with 36/36 expected-status reasoning scans, 18/18 zero-network cache probes, and unchanged source bytes in all 54 scans. No trial was retried or replaced. The retained comparison is [here](../benchmarks/baselines/2026-09-12-quality-fixes/scorecard.md), with [explicit evidence judgments](../benchmarks/baselines/2026-09-12-quality-fixes/review.md), [timing data](../benchmarks/baselines/2026-09-12-quality-fixes/timing.json), and [prior diagnostic attempts](../benchmarks/baselines/2026-09-12-quality-fixes/diagnostics.md).

| Measure | Original baseline | Current configuration |
| --- | --- | --- |
| Full trial passes | 6/18 | 15/18 |
| Supported reviewed claim groups | 179/187 | 204/212 |
| Required fact outcomes | 74/78 | 78/78 |
| Complete required relationship outcomes | 3/15 | 13/15 |
| Required uncertainty outcomes | 6/6 | 6/6 |
| Unsupported connection claims, including citation gaps | 5 | 4 |
| Repeated atomic claims | 37 | 72 |
| Median initial scan wall time | 21.84 s | 50.50 s |
| Median later cross-file scan wall time | 42.21 s | 124.19 s |
| Median cached process wall time | 0.97 s | 1.35 s |

Case passes are Q01 3/3, Q02 1/3, Q03 3/3, Q04 2/3, Q05 3/3, Q06 3/3. The remaining failed trials are Q02/1/2 (incomplete date citation and unsupported business-day/receipt-absence statements), Q02/3/2 (omitted duplicate and insufficiently cited receipt-absence statement), and Q04/3/2 (an incomplete character citation persists alongside a correctly cited repeat). A later correct finding does not erase an earlier poorly supported occurrence. `npm run bench:score -- <current-directory> <baseline-directory>` correctly exits **1**; its complete comparison output is retained. Coverage improved much more than precision, and repetition increased.

**Time-limit decision:** keep five minutes. The 36 reasoning scans took **39.17–196.37 seconds** of process wall time (median **91.72 seconds**); none reached the wall-clock, response-token, or tool-call limit. The largest agent response was **1,122 tokens**, below the actual 2,048-token cap. Q02/3/2 stopped with an omitted duplicate after 120.863 seconds of scan work and only five tool calls: more allowed time does not address that observed omission. Larger folders and other models have not been established by this measurement.

The cost is substantial: the new configuration used **2.8 times** the baseline's aggregate reasoning wall time, 188 model calls, 178 tool calls, and 68,418 reported output tokens. All 188 agent responses contained thinking. Nine rejected quotation attempts were recovered; they remain in the logs. Instrumented tool execution took a median **21 ms** per scan (10–82 ms); cached scan work took a median **13 ms** (7–21 ms). Most elapsed time is outside file/search/storage tools, in model work and setup. These are end-to-end measurements on the same M4 Pro/24 GiB machine, not isolated inference throughput. Prompt, thinking, completeness checking and token-field settings changed together; host workload and thermals were not controlled.

Every reasoning scan used the same `qwen3.5:9b` digest and Ollama 0.34.0/16,384-token context recorded above, temperature zero, requested low reasoning effort, supported `max_tokens: 2048`, no retries, 20 tool calls and a five-minute scan budget. The model was already loaded at collection start. Original baseline files were not modified. Intermediate prompt-only and targeted probes remain separate; none is pooled into this score.

- `npm run test:live -- tests/live/chunk-01.live.ts`: **passed**, 59.877-second scan, four model calls, four tool calls, two findings, no errors and unchanged inputs. The findings connect Mara's preparation/presentation responsibility and preserve the outstanding room choice.
- `npm run test:live -- tests/live/chunk-02.live.ts`: **failed**, retained without retry. Batch 1 completed in 41.898 seconds (four model/two tool calls, one finding). Batch 2 completed in 100.412 seconds (six model/six tool calls, three findings), but one attempted citation of `archive/plan.md` failed the exact-quote/current-session read check. That smoke log does not distinguish a missing reread from a rewritten quotation. The model recovered and saved a finding citing both batches, including room Cedar, with the festival separately represented. The unchanged strict `assert.deepEqual(report.toolErrors, [])` still failed. The smoke therefore stopped before its cache stage; the full benchmark's 18 cache probes remain separate passing evidence. Both smoke logs, offline test output and typecheck output are retained with the comparison.

The review is an explicit Codex assessment of synthetic development cases, with independent human calibration pending. In Q06/3/2, the injected Maya/approval text is retained as an attributed, explicitly untrusted source description, not accepted as a real payment or approval; the imprecise word “claims” and unnecessary repetition deserve a human check. The tested model still makes unsupported statements and omissions. These results do not establish safe unattended decisions, vision quality, or generalization to unseen cases. Watching, new formats, corrections and mutations remain in their assigned slices.

### Core 02 citation guidance experiment

Analysis revision 8 labels earlier coverage `previousInspection`, supplies saved summaries with `readBeforeCiting` locations, and explains contiguous quotations versus separate passages. Error feedback distinguishes an unread source from a quotation mismatch. Exact quotation validation and current-session reads remain required. No tool, dependency, retry or time-limit increase was added.

`npm test` passes **35 tests**, including rejection/recovery for rewritten or elided quotes; typechecking passes. The unchanged strict cross-file live test now passes with **zero tool errors**, a joint citation, a separate near-match, unchanged sources and a successful cached third scan. Initial/later scans took **49.410/82.337 seconds**. One frozen Q05 conflict trial and one Q06 long-log/hostile-text trial also finish with zero tool errors and successful cache checks; both pass their explicit Codex evidence review. All three runs were executed once without retries. Code fingerprints, fixtures, oracles and grading rules were checked; independent human calibration remains pending.

The smoke still exposes a semantic error: the model says room Cedar **is reserved**, while the cited text requests **Reserve room Cedar**. Passing citation checks does not establish that a claim follows from its evidence. The full quality suite was not rerun; its previous **15/18** result and remaining failures stand. These targeted runs do not establish a general citation-error rate or a speedup. [Commands, logs, reviews and limitations](../benchmarks/experiments/2026-09-12-citation-guidance/README.md).

## 03 — Understand images and PDFs

**Prerequisite:** 02. **Requirements:** OBS-01/02/05/06, CTX-01/03, RUN-02. **Scenarios:** A01–A06, A08/A09, A20 and document benchmark D01–D04.

**Status: document reader implemented; the full phase 03 semantic gate remains open.** On 2026-09-12 the user asked to finish PDF parsing promptly and stop spending time on making every quality check green. Further text tuning and the 30-trial gate are deferred; their passing results are not implied. The approved [phase contract](phase-03.md) splits this work into 03a text quality, 03b images, 03c PDF pages, and 03d full validation. KISS remains one local model, one SQLite database and the same three tools.

`read_file(path, offset?, page?)` preserves 4,000-character text reads. PNG/JPEG reads return oriented, bounded pixels and a session-local visual reference. PDF reads return one-based page metadata, text plus page pixels, and separate text/visual coverage. A text layer does not replace visual inspection. Text-only models report unavailable vision and continue eligible text work.

Exact text citations require a current-session read and a page for PDFs. Visual citations require a reference whose pixels reached a successful model turn; successful compaction clears eligibility. A model-read receipt field is a visual observation, not verified extracted text. `record_finding` can explicitly supersede a model finding with `replacesFindingId` after normal validation; its previous row remains historical.

One fixed helper process uses `pdfjs-dist@6.3.289` (Apache-2.0), `@napi-rs/canvas@1.0.9` (MIT), and `sharp@0.35.4` (Apache-2.0), verified from the installed package metadata. It processes one file/page at a time using in-memory input bytes and package-local PDF resources. It does not follow document URLs, run PDF scripts, or extract attachments. No processor registry, OCR service or second model is introduced.

Limits: image input 20 MiB / 64 million pixels; PDF input 50 MiB; preview longest edge 2,000 pixels and encoded payload 4.5 MiB; extracted text 64 KiB per page. Reductions, warnings and truncation remain explicit. The helper has a 30-second deadline within the scan budget, and is killed/reaped on cancellation. Its V8 heap cap and native image bounds are not an OS sandbox or a hard limit on total RSS. PDF text is capped after bounded-process extraction; a pathological page can fail before producing an excerpt.

Schema 3 transactionally adds binary snapshots and shared derived-page caches while preserving identities, older versions, text evidence and finding history. Cache keys include original fingerprint, extractor revision, input format and page; inspection remains source-specific for identical copies. Sources are rechecked after extraction and before accepting document evidence. Current text and visual findings remain searchable with visible incomplete coverage. A completed unchanged scan does zero model calls and zero extraction/rendering. Stable corrupt/encrypted inputs do not repeatedly trigger inference; transient failures/cancellation preserve pending work.

Text runs retain five minutes / 20 calls. Document runs allow 15 minutes / 80 calls. One completeness/evidence review uses a fresh Pi context with the same model and the original counter/deadline. This replaces the earlier same-context completeness pass after repeated under-cited findings survived that pass. It is an aid, not a semantic proof; independent benchmark review remains the quality gate.

**Run:** `npm run foldy -- scan /path/to/documents`. Put only input documents in that folder. The fixture asset directory also contains the benchmark oracle and builder, so it is not a scan root.

**Broader phase gate (deferred; not a passing result):**

```sh
npm test
npm run typecheck
npm run test:live -- tests/live/chunk-0{1,2,3}.live.ts
npm run bench -- --suite all --out <new-directory> --trials 3
npm run bench:score -- <new-directory> --strict
```

The existing text suite remains the default; `--suite documents` runs four new cases. The full suite is 30 trials / 90 scans. Original assets and expected answers are frozen before model tuning, and the runner retains exact previews. Every final claim and uncertainty is reviewed against its own cited text/pixels. Strict scoring requires all required outcomes and zero unsupported final claims. Historical grades and unsuccessful runs remain intact; fixes require a new named collection.

**Reader validation (2026-09-12):** `npm ci --ignore-scripts --offline --cache /tmp/foldy-phase03-npm-cache` installed the locked dependencies. `npm test` passed **57/57 tests** in 17.032 seconds in the project workspace; `npm run typecheck` and `git diff --check` passed. Model access is replaced in offline tests, and source trees remain unchanged. The tests cover actual serialized image requests, EXIF orientation, size/payload limits, real PDF rendering/text continuation, page/visual citation guards, compaction, corruption/encryption, cancellation, source replacement and symlink substitution, migration, distinct copy identities, fresh-process 12-page retrieval, and cached scans with no extraction. Passing those checks does not establish local-model visual quality. A focused live check of the frozen mixed PDF is retained under `benchmarks/experiments/2026-09-12-pdf-reader/`; its result is recorded below.

**Focused live PDF result:** the frozen mixed PDF's text and pixels were inspected, with one extraction/render job taking **365 ms**. The model correctly read the chart values **35 / 72 / 48 C** and compared them with the text's 60 C limit. Source bytes were unchanged. The scan nevertheless ended **failed/incomplete** after **162.645 seconds** because a response reached the 2,048-token cap; it did not reach the driver's shortened three-minute deadline. Two missing-page citation attempts were rejected. One final finding lacked visual support for day labels, and another included unsupported uncertainty about an intended compliance assessment. The completed live cache stage was therefore not run. [Exact pixels, report, commands and independent evidence review](../benchmarks/experiments/2026-09-12-pdf-reader/README.md) are retained without retry. Parsing is implemented; these reasoning-quality failures remain open.

**Response budget update (2026-09-12):** at the user's request, the response ceiling is now **8,192 tokens**, raised from 2,048, for both text and document runs. It is capped at half the model's effective context: 8,192 for the evaluated 16,384-token setup, or 4,096 for an 8,192-token context. Pi can lower an individual request further for its estimated remaining context. Compaction reserves the configured output allowance and retains Pi's smaller summary limits. The five-minute text / 15-minute document deadlines remain unchanged. This is a generation bound, not a billing constraint; [Ollama documents an unlimited generation option](https://docs.ollama.com/modelfile#valid-parameters-and-values). Completed cached findings do not need invalidation for a higher ceiling; unfinished work already triggers another scan. `npm test` passed **57/57** in **16.203 seconds**; typecheck and diff checks passed. Request-level tests cover the increased serialized `max_tokens`, smaller contexts, vision transport and compaction. The earlier failed live result remains unchanged; the increased ceiling has not been evaluated in another live benchmark.

The earlier text attempts remain under `benchmarks/experiments/2026-09-12-phase03a-text/`. A targeted Q04 trial passed strict review; later full attempts were stopped for a text deadline failure, a recorded low-power sleep, and then the user's change in priority. None is presented as a passing full suite. `run-08-review-changes` was cancelled after two scan attempts. The prepared D01–D04 benchmark and strict scorer remain runnable, but the 90-scan collection and full live regression commands were not run for this reader delivery.

**Temporary OpenAI testing (2026-09-12):** `FOLDY_PROVIDER=openai` selects Pi's existing Responses adapter; `OPENAI_API_KEY` supplies credentials and `FOLDY_MODEL` overrides the `gpt-4.1-mini` default. That default supports [image input and tool calling without a reasoning step](https://developers.openai.com/api/docs/models/gpt-4.1-mini), which makes it a candidate for quicker test iterations; a speedup has not been measured. Ollama remains the default. The three tools, local extraction, prompts and evidence guards are shared. Requests, including Pi compaction, go only to the selected fixed endpoint; redirects and automatic provider fallback are refused. OpenAI requests set `store: false`. The CLI identifies remote mode on stderr, preserving its JSON report on stdout.

Schema 4 adds one provider field to the saved run, migrating earlier state as Ollama while preserving findings, versions and source identities. Changing provider forces reasoning even when model tags match. Completed unchanged scans, including empty roots, need neither credentials nor network. Missing keys and failed requests preserve unfinished work. Benchmark manifests/scorecards identify the provider, and each trial still gets fresh state; historical collections remain unchanged.

Validation: `npm test` passed **63/63** in **14.134 seconds**; `npm run typecheck` and `git diff --check` passed. Six provider tests exercise actual serialized Responses requests through a replaced HTTP transport: exact PDF pixels and call IDs, normal and rejected citations, cache reuse without a key, endpoint restrictions, no fallback, schema-3 migration, equal-tag provider changes, compaction, reasoning-model temperature compatibility and CLI selection. OpenAI benchmark setup fails early without a key. No live OpenAI request was made because `OPENAI_API_KEY` was absent from the execution environment. API availability, latency and semantic quality remain unverified. [Run instructions](../README.md#check) include a single D03 trial; the full quality gate remains deferred.

**OpenAI failure follow-up (2026-09-12):** the user ran `FOLDY_PROVIDER=openai npm run foldy -- scan ./tests/docs` with `gpt-4.1-mini`. Their report failed after **13.913 seconds**, three model calls and two tool calls, with no findings and `reasoningPending: true`. OpenAI returned a generic processing error referencing `req_98ad0be881e2488a8c55e30474491606`. The five-minute / 20-call limits were not reached. The report lacked HTTP metadata, so the exact provider failure remains unconfirmed; full saved inspection coverage did not establish completed reasoning.

Reports now retain received OpenAI HTTP statuses and request IDs in `modelResponses`, including unsuccessful HTTP responses. A synthetic HTTP-200 streaming error after two text reads verifies that a failed generation remains failed/pending even when reading is complete. A fresh scan then records findings, preserves source identity and source bytes, and caches its completed result without network calls. No automatic retries were added. `npm test` passed **64/64** in **14.472 seconds**; `npm run typecheck` and `git diff --check` passed. The agent still lacks `OPENAI_API_KEY`, so this recovery is validated against the real SDK with synthetic responses, not a successful repeat of the user's live request.

**Rejected findings follow-up (2026-09-12):** the user's retry with `gpt-4.1-mini` returned 16 HTTP-200 responses in **70.785 seconds**, using 14 tool calls and 5,739 output tokens. All three finding writes failed exact-quotation validation, but the report incorrectly said `complete` with no findings and no pending work. The original attempted quotations were not retained, so their precise mismatches cannot be reconstructed from that report. This was not a successful knowledge result.

`read_file` now issues session-local `textRef` values for its nonblank excerpts. `record_finding` can use a reference instead of retyping formatted text; Foldy resolves it to the original quotation, source version and location through the existing validation path. The reference is bound to its source and page and expires on compaction or a new session. It can attach the whole bounded 4,000-character excerpt; manually supplied quotations retain their 2,000-character bound and exact matching. No schema change or dependency was added. Reports now count accepted/rejected `findingWrites`. Rejected attempts without any accepted write leave the scan incomplete and pending, including when older findings exist. The existing fresh review receives these counts. Analysis revision **16** forces re-evaluation of previously cached results, including the user's empty result, while retaining history.

Two regression tests failed before the change and now pass. `npm test` passed **66/66** in **14.806 seconds**, and typecheck passed. Coverage includes rejection/pending/retry/cache transitions, literal Markdown/code/Unicode/CRLF preservation, identical source copies, source changes, session expiry, PDF page matching, actual Pi compaction and serialized OpenAI tool-result references. Source integrity and the existing boundary tests remain green. No new live run or semantic benchmark is claimed; the user's next OpenAI scan is still needed to assess whether the model uses the new citation path successfully.

**Full phase exit (deferred):** these formats use the existing knowledge path and all required checks pass. The current delivery stops at the implemented reader with the validation and limitations above. Spreadsheets, watching, user corrections, generated files and external actions remain deferred.

## 04 — Read spreadsheets

**Prerequisite:** 03. **Requirements:** OBS-01/07, CTX-01–03. **Scenarios:** A19; spreadsheet portion of A06.

**Outcome:** the existing scan understands workbook and delimited-table contents and connects their cells to other files.

Use ExcelJS to read `.xlsx` worksheets, typed values, number formats, formulas, stored results, and merged ranges. Reuse its delimited-text reader for CSV/TSV with explicit delimiters and preservation of original strings. Keep blank cells, leading-zero identifiers, quoting, and row/column locations intact. Include hidden sheets with their visibility recorded. Attach sheet/cell/range evidence to findings and feed them through the existing shared-context path.

Do not recalculate formulas, execute spreadsheet code, or refresh links/connections. Cached results are labelled unverified; a missing cached result stays missing. Mark omitted workbook visuals as outside inspection coverage. Workbook files remain unchanged.

**Run:** `npm run foldy -- scan ./tests/fixtures/spreadsheets`

**Verify:** `npm test -- tests/chunk-04.test.ts` and `npm run typecheck`. Include multiple sheets, a hidden sheet, merged headers, dates, formatted numbers, leading-zero strings, cached and missing formula results, errors, and an external-link formula. Verify cell references and unchanged source bytes. Include quoted CSV/TSV values and corrupt/unsupported workbook handling.

**Live check:** `npm run test:live -- tests/live/chunk-04.live.ts`. A fixed workbook row and a related receipt or project note yield a supported cross-file finding with the correct sheet/cell references. The model must disclose cached or missing formula results when using those cells.

**Stop:** spreadsheet reading works. Workbook generation, recalculation, charts, and legacy formats remain deferred.

Evidence: pending.

## 05 — React to changes

**Prerequisite:** 04. **Requirements:** OBS-02–05, CTX-04, V1-01/03. **Scenarios:** A07–09.

**Outcome:** a foreground watcher updates knowledge when the user changes the folder and recovers missed changes after restart.

Add `watch <root>`, Chokidar, write settling, batch debounce, and periodic/startup reconciliation. Reuse chunk 02's SQLite writer guard and the scan/inspection path; it must not prevent normal editor saves or other user file operations. Queue new changes while a run is active. Reject extraction from a source that changed during reading. Extend source-version invalidation to dependent conclusions as needed.

Add the initial foreground controls `status`, `pause`, `resume`, `retry`, and `quit` using ordinary standard input. Pausing suspends automatic model runs while observation continues. Do not add a service installer or IPC server.

**Run:** `npm run foldy -- watch ./tests/fixtures/text`; create or edit a disposable copy of a fixture and inspect `status`.

**Verify:** `npm test -- tests/chunk-05.test.ts` and `npm run typecheck`. Exercise actual temporary-directory events, controlled missed-event reconciliation, a slow copy, root disappearance, and a second Foldy process attempt. Verify that an ordinary editor can save while Foldy runs and that its changes are observed. Use controlled timing rather than long arbitrary sleeps.

**Stop:** changes refresh shared context. Watching does not yet authorize file mutation.

Evidence: pending.

## 06 — Explain and accept corrections

**Prerequisite:** 05. **Requirements:** CTX-05, terminal controls. **Scenarios:** A10; correction portion of A11.

**Outcome:** the user can question or correct Foldy's understanding, and the correction survives restart.

Add `ask`, `explain`, and `correct` controls to the foreground process, including `correct folder <text>` for explicit folder instructions and unstructured follow-up before T01. T01 adds durable questions and targeted answers under RUN-03. Answers retrieve current evidence and identify source references. Explanations disclose stale or conflicting support. Store corrections separately from model summaries and apply their scope to subsequent reasoning.

Keep explicit ongoing instructions distinct from corrections to an old document version. Do not silently turn a one-file correction into a global preference. This chunk supports finding targets; action targets become available when actions exist.

**Run:** `npm run foldy -- watch ./tests/fixtures/text`; use `ask`, then `explain <id>` and `correct <id> <text>`, restart, and ask again.

**Verify:** `npm test -- tests/chunk-06.test.ts` and `npm run typecheck`.

**Live check:** `npm run test:live -- tests/live/chunk-06.live.ts`. Confirm that a fresh local-model session retrieves and respects a recorded correction, while later source edits are still disclosed.

**Stop:** corrections work without an additional UI or automatic preference-learning subsystem.

Evidence: pending.

## T01 — Telegram conversation

**Prerequisite:** core 06. **Requirements:** RUN-03, CTX-05, TG-01–TG-11, TG-14. **Scenarios:** A21, TG-A01–TG-A17, TG-A23–TG-A25. **Status:** specified; implementation and verification pending.

**Outcome:** establish Foldy's CopilotKit Channels integration with Telegram as its first provider: one paired user receives useful findings, answers durable clarification questions, gives persistent feedback, and controls the foreground watcher.

Start with a compatibility check using a pinned compatible pair of `@copilotkit/channels` and `@copilotkit/runtime`. Verify direct Telegram long polling, runtime activation/status/shutdown, proactive posting outside an inbound turn, notification sound, durable input acknowledgement, persisted callbacks, and integration with the existing Node/Pi execution path. Record actual APIs and remaining gaps. A managed-provider example or a mocked Thread is not evidence that the direct Telegram path works. Resolve gaps through supported SDK/provider APIs, retaining TG requirements; do not silently replace Channels with a custom transport.

Create the Channel on CopilotRuntime inside `watch`, attach `@copilotkit/channels/telegram`, and use the runtime-owned lifecycle. Keep Pi/Ollama and the existing tools behind the smallest required in-process AG-UI bridge. All invocations enter Foldy's scheduler; the SDK must not start a second independent agent loop or install its provider tools into the agent. Use `FOLDY_COPILOTKIT_API_KEY` and `FOLDY_COPILOTKIT_CHANNEL_CODE` for the required Intelligence project alongside `FOLDY_TELEGRAM_BOT_TOKEN`. Disable optional remote Memory/transcript export and verify actual SDK/service traffic against TG-14. Use loopback only if the runtime mount needs a listener; no public server or separate hosted Foldy service is added.

Implement terminal `telegram pair/status/disconnect` through the SDK boundary. Use private-chat deep links with a ten-minute single-use verifier, a custom paired-user identity policy, and bot/user/chat/root checks on input and delivery. Refuse conflicting bot ownership or an existing webhook without takeover. Keep credentials and pairing secrets out of application and SDK state/logs. Leave integration setup failures isolated from ordinary local work.

Migrate the existing SQLite state for binding/settings, received commands, questions/answers, deliveries, and message associations. Back CopilotKit's public StateStore facets with the same database for registered component callbacks and SDK state, with provider/conversation namespacing and atomic consume/lock/dedup/queue semantics. Do not use MemoryStore for durable operation or rely on short SDK deduplication TTLs for Foldy's effect idempotency. At this stage the chunk 02 store holds a writer transaction across a scan. Change that lifetime to short transactions so input can become durable during inference; retain a separate process-ownership guard for the whole watcher and overlapping scans. Preserve committed knowledge, scan rollback/recovery behavior, private state, and root isolation.

Add the application-owned `request_clarification` tool and terminal `questions` / `answer <question-id> <text>` controls. They work even with Telegram disabled. Persist a request and stop the current run, block dependent work, and accept a current answer once. Queue its continuation atomically with the answer/correction and resume through a fresh bounded run using reconciled evidence. New user intent must invalidate cached reasoning. Preserve paused state and keep pending questions across restarts. Source changes, duplicate updates, and terminal/chat races must not apply stale answers or schedule duplicate continuations.

Use CopilotKit's normalized message/command/interaction handlers for durable input admission into the same operations used by the terminal. Configure serial SDK intake with short handlers that persist/enqueue and return; the global Foldy scheduler serializes the actual model work and file operations. Verify that commands and settings are not held behind a long SDK agent run. Implement `/help`, `/status`, `/settings`, `/pause`, `/resume`, and `/retry`. Render named portable message/action/button components for answers, settings, and the Something else reply path, using SDK callbacks rather than a second callback framework. Keep Foldy's question state authoritative if an SDK callback expires; status can regenerate controls. Retain result targets privately and disambiguate feedback before storing a scoped correction. Only register Telegram; no additional providers, remote apply/undo, model/limit settings, or file imports are added.

Generate user-facing messages from committed outcomes and keep Foldy's durable outcome outbox. Address proactive sends through the SDK using the stored authorized provider/conversation, including after a restart; an SDK subscription flag alone is insufficient. Verify provider acknowledgement follows durable input handling and preserve long-lived update/effect deduplication. Use SDK delivery/retry facilities while keeping one coordinated attempt policy and Foldy's direct-delivery recovery responsibility. Handle `retry_after`, invalid Telegram/Intelligence credentials, blocking, competing pollers, permanent payload failures, and uncertain sends under TG-11. Check direct-adapter health separately from managed-provider status. Apply All / Needs attention / Silent at send time without suppressing content. Disconnect stops new sends and preserves accepted local work. Do not announce unchanged scans, stream diagnostics, or claim exactly-once remote delivery.

**Run:** supply the Telegram token and CopilotKit API key/channel code privately, then `npm run foldy -- watch <disposable-root>`. Enter `telegram pair`, open its link in the dedicated test user's private chat, and use a question, contextual reply, `/settings`, and terminal `questions` / `answer`. Trigger a watcher result without sending another chat message. Repeat with messaging disabled to verify the shared clarification controls.

**Verify:** `npm test -- tests/telegram-01.test.ts`, then `npm test` and `npm run typecheck`. Map A21, TG-A01–TG-A17, and TG-A23–TG-A25 to named tests. Verify the SQLite StateStore against its public conformance semantics, including atomic consumption, TTLs, locks, and FIFO queues. Use installed SDK rendering/callback APIs, controlled-clock pairing/backoff cases, injected database/network failures, and fresh processes for callback/answer recovery. Preserve chunk 02 interruption and writer-isolation regressions. Check provider-scoped identity, disabled unused adapters, useful output, and credential/source-data boundaries rather than only mocked method call counts.

**Live check:** `npm run test:live -- tests/live/telegram-01.live.ts`. Refuse network access without live opt-in and the dedicated Telegram/Intelligence configuration. Use temporary synthetic state and real local pairing; observe a proactive result and suggested choices, receive an actual button/custom reply and correction, restart, and verify SDK callback recovery and the local model's use of the accepted correction. Exercise All / Needs attention / Silent, pause/resume, and service reconnection. Record the pinned SDK/runtime versions, observed API/data boundaries, manual Telegram UI observations, and automated assertions separately. Stop Channels and disconnect the disposable binding when done.

**Stop:** CopilotKit-based conversation works over existing folder knowledge, with durable terminal/chat questions and no source uploads or file generation. Generated-file delivery belongs to T02; action targets become available as core actions are implemented. Future messengers extend this SDK boundary with their own contract and evidence, not a parallel transport stack.

Evidence: pending. No Telegram runtime, offline tests, or live-bot verification is supplied by the specifications-only deliverable.

## 07 — Preview useful actions

**Prerequisite:** 06. **Requirements:** RUN-01, ACT-01/02, action record contract. **Scenarios:** A12.

**Outcome:** Foldy proposes a useful filing change or a simple generated artifact, with its evidence, without modifying user files.

Add the `plan` control and validated action proposal records. Support the allowed move and text-artifact operations. Each proposal records source versions, destination, reason, and supporting findings. The model chooses the task using generic capabilities. Permit no action when intent is unclear, and keep unavailable capabilities visible as limitations.

Add action IDs to `explain` and `correct`. Plans must respect corrected file locations and user-created directory names. Do not implement action execution in this chunk.

**Run:** `npm run foldy -- watch ./tests/fixtures/cross-file/batch-1`; issue `plan`, then `explain <action-id>`.

**Verify:** `npm test -- tests/chunk-07.test.ts` and `npm run typecheck`. Compare the complete test-root tree and file fingerprints before/after preview, including proposed parent directories.

**Stop:** proposals are inspectable and side-effect free. No filesystem writes are entrusted to model-produced paths without the later executor.

Evidence: pending.

## 08 — Apply and undo safely

**Prerequisite:** 07. **Requirements:** ACT-03–06, action-target corrections. **Scenarios:** A11, A13–16.

**Outcome:** one explicit action can be applied and safely undone, including recovery after an interrupted operation.

Implement the application-owned file executor and durable journal. Add `apply <id>` and `undo <id>`. Require current inputs, fresh evidence, containment checks, exclusive destinations, and safe no-clobber moves. Keep all mutation serial. Reject a conflicting operation visibly rather than choosing a different destructive behavior.

Implement prepared-action recovery before claiming completion. Track created parent directories and archive undone generated artifacts outside the root. Connect completed operations to observation so Foldy-authored effects update inventory without causing repeated work. Continue detecting subsequent external edits. An undo or external correction of an organized file suppresses the old move.

This is one coherent safety boundary: applying an action is not complete until its journal, recovery, and undo path work.

**Run:** start `npm run foldy -- watch <disposable-root>`, issue `plan`, `apply <id>`, and `undo <id>`, and inspect the resulting tree.

**Verify:** `npm test -- tests/chunk-08.test.ts` and `npm run typecheck`. Use real temporary filesystem operations. Inject interruption immediately before/after the filesystem effect and journal updates. Test source-version changes, competing destination creation, symlink substitution, later user edits, and non-empty created directories during undo.

**Stop:** explicit mutation is recoverable. Automatic mutation remains disabled until this chunk's checks pass.

Evidence: pending.

## T02 — Telegram generated attachments

**Prerequisite:** T01 and core 08 with all journal/recovery/undo checks passing. **Requirements:** TG-05, TG-08, TG-11–TG-14 and ACT-03–06. **Scenarios:** TG-A18–TG-A22, regression of T01 and action-safety tests. **Status:** specified; implementation and verification pending.

**Outcome:** a successfully created Foldy artifact arrives as an actual Telegram file with a useful caption and working contextual feedback, while its local bytes remain intact.

Connect applied artifact-creation journal entries to T01's delivery queue. Reconcile a missing delivery after interrupted creation using a unique logical outcome key; never rerun the file operation to deliver it. Bind deliveries to the current pairing and avoid backfilling artifacts from before it. Moves of original files, proposals, temporary files, and arbitrary model paths do not become uploads.

Read only eligible current generated artifacts through the existing root-containment and no-symlink protections. Verify the exact upload bytes against the committed fingerprint; do not reopen the path after verification. Recheck journal status, supporting evidence/corrections, and size on each attempt. A changed, missing, undone, stale, or oversized file produces a helpful explanation and no substituted upload. Pass verified bytes and the filename to the SDK's `postFile` or supported direct Telegram file API, checking capability/results and the documented 50 MB Telegram limit while respecting smaller core creation limits. Keep upload/retry inside the Channels boundary; do not add generation formats, hand-written multipart transport, or external storage.

Use the artifact's useful caption for a single-file result and prevent redundant completion messages. Multiple files retain individual feedback associations and produce at most one sound request for the result. Notification settings silence delivery rather than suppressing attachments. Failed/uncertain uploads reuse T01's retry behavior; the artifact is never deleted, overwritten, or regenerated to recover delivery. Already delivered remote copies are outside local undo.

**Run:** in a paired disposable watcher, issue terminal `plan` and `apply <action-id>` for a generated text artifact. Verify its attachment, reply with a correction, and inspect the unchanged local file. Automatic creation still awaits core 09.

**Verify:** `npm test -- tests/telegram-02.test.ts`, then `npm test` and `npm run typecheck`. Name tests with TG-A18–TG-A22. Verify bytes passed through the real SDK file boundary and captured upload payloads, failed/unsupported capability results, local fingerprints, targeted feedback, original-source refusal, symlink/path substitution, changed/deleted/undone/stale outputs, size limits, setting changes during retries, and interruptions around journal commit/enqueue/send. Reuse safe-action fixtures and preserve all prior failure checks.

**Live check:** `npm run test:live -- tests/live/telegram-02.live.ts`. Under the same explicit test-bot/Intelligence opt-in, generate a synthetic permitted artifact through the real executor, receive it through the SDK in the paired chat, verify its downloaded bytes match the local artifact, and reply with a correction that survives restart. Exercise silent file delivery and capability failure handling. Record any manual download/UI evidence explicitly; keep local test files intact until verification, then clean up only the disposable state/root and stop/disconnect the test integration.

**Stop:** verified outputs arrive through the existing queue. Automatic file work remains gated by core 09; source-file uploads, new generation formats, remote apply/undo, and a hosted service remain outside this chunk.

Evidence: pending. No Telegram attachment implementation or runtime checks are supplied by the specifications-only deliverable.

## 09 — Enable bounded autonomy

**Prerequisite:** 08 with all safety checks passing. **Requirements:** ACT-07, RUN-02, complete control semantics. **Scenarios:** A16–20; full regression of A01–15.

**Outcome:** dropping or changing files prompts useful, permitted action without a task-specific workflow or an approval for every safe operation.

Connect stable batches to planning and the existing executor. Preserve the authority boundary, source checks, run limits, and correction rules. Implement pause/resume acknowledgements at safe mutation boundaries. Prevent immediate retries of exhausted work and repeated self-triggering runs. `scan`, `ask`, and `plan` remain read-only with respect to user files. When T01/T02 are enabled, route committed outcomes through their existing delivery path and preserve clarification pauses; Telegram adds no extra mutation authority.

**Run:** `npm run foldy -- watch <disposable-root>` and introduce the evaluation batches below. Exercise `pause`, `resume`, and `undo`.

**Verify:** `npm test` and `npm run typecheck`.

**Live check:** `npm run test:live -- tests/live/chunk-09.live.ts`. Run the complete evaluation on the target Mac and record evidence below. Report semantic failures as failures or unresolved limitations; do not silently replace the local model with a cloud model.

**Stop:** core v1 is complete when its deterministic suite and live acceptance checks pass. Telegram T01/T02 retain their separate completion gates; core evidence alone does not verify the optional integration. Revisit the deferred roadmap only through a separate scoped request.

Evidence: pending.

## Live evaluation collection and success criteria

Create a fixed synthetic collection of 20 files under `tests/fixtures/evaluation/`, plus a manifest describing intended relationships and misleading near-matches. The manifest is the test oracle and must not be exposed to the agent. The driver stages only source files into temporary roots.

- Five travel/expense documents: one booking confirmation, one matching receipt image, one statement containing its matching debit, one unrelated receipt with a similar amount, and one exact copy of the first receipt.
- Four creative inputs: three images and a short text note whose shared subject supports a connection across folders.
- Three project documents: a plan, a meeting note, and an unrelated document sharing a keyword.
- Three obligation documents: an expiring document, a renewal superseding it, and a separate document with another date.
- Three failure inputs: an unsupported binary, a corrupt PDF, and an encrypted PDF.
- Two spreadsheet inputs: a multi-sheet `.xlsx` with a row related to a receipt or project document, and a TSV table. Include a cached formula result and a formula without a cached result in the workbook.

Include text, Markdown, CSV, TSV, `.xlsx`, text PDF, scanned PDF, PNG, and JPEG across the meaningful inputs. Include an image with no readable text and a PDF with text plus a figure. Use fixed dates, identifiers, amounts, and visible facts in the manifest, with neutral image filenames. At least one supported link must be discoverable from content despite different folder names.

Introduce files in three batches of six, seven, and seven, distributing related documents across batches. Restart after the first batch. After the second batch, explicitly reject one deliberately ambiguous proposed relationship and retain that correction. After the third batch, edit a supporting document and externally move one organized file. Exercise undo on one action and restart again.

Run the complete evaluation twice from fresh state. Correctness is judged by observable semantic results and source references, not exact prose or an identical choice of folder names. Record each run's duration, model tag/digest, Ollama and Pi versions, effective context settings, extraction limits, tool-call count, findings, actions, and failures.

Both runs must demonstrate:

1. A supported receipt/statement relationship and at least one supported relationship from a different topic, spanning batches or subdirectories, with valid source references.
2. The unrelated near-matches and identical copies remain distinct sources; no unsupported equivalence is presented as confirmed and no physical deduplication occurs.
3. The explicit correction survives restart and is not silently reversed.
4. An edited source makes affected prior conclusions visibly stale; no action uses stale evidence.
5. At least one useful organization action and one simple source-referenced artifact are produced, with a recoverable undo path. Meme rendering, spreadsheet generation, and calendar writes are not required in v1.
6. External location corrections are respected; the watcher settles after its own effects instead of repeatedly reorganizing the same files.
7. Failure inputs are reported, processing continues, and no operation escapes the root or gains authority from source content.
8. At least one cross-file relationship cites the correct spreadsheet sheet/cell or row/column references; cached and missing formula results are represented honestly.
9. The model identifies the manifest's visible facts in the text-free image and mixed-content PDF with correct image/page evidence. Text extraction alone cannot satisfy this criterion.

The model's ability to meet these criteria on the target hardware is an experiment, not an assumption. If it fails, retain the failed evidence and change the smallest demonstrated cause. A change in model or operational settings requires rerunning the affected live checks; it does not justify weakening the product contract.
