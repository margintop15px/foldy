# Foldy v1 implementation chunks

Status: chunk 01 is implemented and verified. Chunks 02–09 remain unimplemented; their commands are target development interfaces.

Read [the behavioral specification](foldy-v1.md) before executing a chunk. [README](README.md) holds accepted decisions and progress.

## Working agreement

Work on one chunk at a time. Each chunk has one primary runnable outcome, its own test file, and a stopping point. Later chunks extend earlier behavior without weakening its tests. Stop a completed chunk with a concise handoff; do not pull deferred capabilities into it.

Use TypeScript on Node.js 24 and Node's built-in test runner. Introduce `npm run foldy`, `npm test`, and `npm run typecheck` in chunk 01. The test script must accept explicit test paths so a chunk can be checked without a custom test harness. Keep model access replaceable by a simple test function; do not build a provider framework.

Model tests are explicitly opt-in. Offline tests must never contact Ollama, download a model, or rely on personal documents. Name live tests `tests/live/chunk-NN.live.ts` and exclude them from ordinary test discovery. Introduce `npm run test:live -- <test-file>` as `FOLDY_LIVE=1 node --test --test-concurrency=1`; live tests must refuse model access without that flag. Use temporary test roots/state directories and clean up only data created by that test.

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

- Paths: `src/{cli,inventory,model,scan}.ts`, `tests/chunk-01.test.ts`, `tests/live/chunk-01.live.ts`, `tests/fixtures/text/{project.md,notes.txt}`, root `README.md`, `package.json`, `package-lock.json`, `tsconfig.json`, and `.gitignore`. No implementation commit has been created.
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

**Prerequisite:** 01. **Requirements:** OBS-04, CTX-01–03, records/state storage. **Scenarios:** A03, A04.

**Outcome:** a new scan connects a new file to relevant evidence from an earlier process run.

Add one SQLite database per root for file versions, inspected content, findings, and evidence. Use simple SQL and text search. Give the model a compact folder overview and tools to retrieve relevant records or original sources. Preserve distinct source IDs for duplicate copies. Persist findings independently of Pi's conversation history so a fresh model session can recover context.

Create `tests/fixtures/cross-file/batch-1` and `batch-2`. The fixture test driver copies these into the same temporary root in order and invokes fresh scan processes; the two batch directories are not separate workspaces.

**Run:** `npm run foldy -- scan ./tests/fixtures/text` twice; the second run reuses internal state without duplicating unchanged source versions.

**Verify:** `npm test -- tests/chunk-02.test.ts` and `npm run typecheck`.

**Live check:** `npm run test:live -- tests/live/chunk-02.live.ts`. The driver adds the staged cross-file fixtures and demonstrates a supported relationship across process restarts. Include an unrelated near-match that must not become a confirmed relationship.

**Stop:** cross-file understanding persists. There is no separate vector store, graph service, or memory-provider framework.

Evidence: pending.

## 03 — Understand images and PDFs

**Prerequisite:** 02. **Requirements:** OBS-01/02/05/06, CTX-01/03. **Scenarios:** A05, A06, A20.

**Outcome:** the existing scan handles images, text PDFs, and scanned PDFs with traceable evidence.

Add trusted extraction code: extract PDF text where present and render pages when visual content needs inspection, including pages that already have a text layer. Pass image pixels through the local model's vision input to understand objects, scenes, and relationships as well as text. Reuse extracted content by source version. Record page/excerpt/image locations and actual inspection coverage. Fail individual documents clearly while continuing the batch. A text-only model must report unavailable vision.

Use established parsing/rendering libraries; keep their use behind simple functions. Before accepting a dependency, verify its license permits the intended distribution and that its local path does not call a hosted service. Add configurable operational bounds only where the chosen extractor needs them to prevent resource exhaustion, with the actual values recorded in live-check evidence.

**Run:** `npm run foldy -- scan ./tests/fixtures/documents`

**Verify:** `npm test -- tests/chunk-03.test.ts` and `npm run typecheck`.

**Live check:** `npm run test:live -- tests/live/chunk-03.live.ts`. Inspect a text PDF, a scanned receipt, an image with no readable text, and a PDF page containing text plus a meaningful figure. Use neutral filenames and fixed visible facts in a test-only manifest so success requires pixel inspection. Verify correct image/page evidence and visible facts. OCR alone, a vision-capable model tag, or a filename-based guess does not pass.

**Stop:** these formats use the existing knowledge path. Spreadsheet output, image generation, and arbitrary script execution remain deferred.

Evidence: pending.

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

Add `watch <root>`, Chokidar, write settling, batch debounce, periodic/startup reconciliation, and the guard against a second Foldy process managing the same root. The guard must not prevent normal editor saves or other user file operations. Reuse the scan/inspection path. Queue new changes while a run is active. Reject extraction from a source that changed during reading. Mark obsolete findings and their dependent conclusions stale.

Add the initial foreground controls `status`, `pause`, `resume`, `retry`, and `quit` using ordinary standard input. Pausing suspends automatic model runs while observation continues. Do not add a service installer or IPC server.

**Run:** `npm run foldy -- watch ./tests/fixtures/text`; create or edit a disposable copy of a fixture and inspect `status`.

**Verify:** `npm test -- tests/chunk-05.test.ts` and `npm run typecheck`. Exercise actual temporary-directory events, controlled missed-event reconciliation, a slow copy, root disappearance, and a second Foldy process attempt. Verify that an ordinary editor can save while Foldy runs and that its changes are observed. Use controlled timing rather than long arbitrary sleeps.

**Stop:** changes refresh shared context. Watching does not yet authorize file mutation.

Evidence: pending.

## 06 — Explain and accept corrections

**Prerequisite:** 05. **Requirements:** CTX-05, terminal controls. **Scenarios:** A10; correction portion of A11.

**Outcome:** the user can question or correct Foldy's understanding, and the correction survives restart.

Add `ask`, `explain`, and `correct` controls to the foreground process, including `correct folder <text>` for explicit folder instructions and clarification answers. Answers retrieve current evidence and identify source references. Explanations disclose stale or conflicting support. Store corrections separately from model summaries and apply their scope to subsequent reasoning.

Keep explicit ongoing instructions distinct from corrections to an old document version. Do not silently turn a one-file correction into a global preference. This chunk supports finding targets; action targets become available when actions exist.

**Run:** `npm run foldy -- watch ./tests/fixtures/text`; use `ask`, then `explain <id>` and `correct <id> <text>`, restart, and ask again.

**Verify:** `npm test -- tests/chunk-06.test.ts` and `npm run typecheck`.

**Live check:** `npm run test:live -- tests/live/chunk-06.live.ts`. Confirm that a fresh local-model session retrieves and respects a recorded correction, while later source edits are still disclosed.

**Stop:** corrections work without an additional UI or automatic preference-learning subsystem.

Evidence: pending.

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

## 09 — Enable bounded autonomy

**Prerequisite:** 08 with all safety checks passing. **Requirements:** ACT-07, RUN-02, complete control semantics. **Scenarios:** A16–20; full regression of A01–15.

**Outcome:** dropping or changing files prompts useful, permitted action without a task-specific workflow or an approval for every safe operation.

Connect stable batches to planning and the existing executor. Preserve the authority boundary, source checks, run limits, and correction rules. Implement pause/resume acknowledgements at safe mutation boundaries. Prevent immediate retries of exhausted work and repeated self-triggering runs. `scan`, `ask`, and `plan` remain read-only with respect to user files.

**Run:** `npm run foldy -- watch <disposable-root>` and introduce the evaluation batches below. Exercise `pause`, `resume`, and `undo`.

**Verify:** `npm test` and `npm run typecheck`.

**Live check:** `npm run test:live -- tests/live/chunk-09.live.ts`. Run the complete evaluation on the target Mac and record evidence below. Report semantic failures as failures or unresolved limitations; do not silently replace the local model with a cloud model.

**Stop:** v1 is complete when the deterministic suite and live acceptance checks pass. Revisit the deferred roadmap only through a separate scoped request.

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
