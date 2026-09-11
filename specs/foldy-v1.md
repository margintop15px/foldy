# Foldy v1 behavioral specification

Status: v1 behavioral contract. Implemented chunks and passing checks are tracked in [the implementation guide](implementation.md); this document alone does not imply complete v1 support.

## 1. Scope and operating model

**V1-01 — One local workspace.** The user selects one existing local directory. Foldy resolves its canonical path and operates on that root and its descendants. v1 skips descendant symlinks, including links whose targets happen to be inside the root. Only one Foldy process may manage that root and update its internal state at a time; a second `scan` or `watch` process for the same root exits with a clear message. The user and other applications can still create, edit, move, and remove files normally. This rule prevents competing Foldy instances; it does not lock the folder against user edits.

**V1-02 — Local inference.** Use Pi as an embedded library with explicitly supplied tools, settings, and resource loading. Start with Ollama serving `qwen3.5:9b` on loopback. Keep model selection configurable through the existing integration. MiniCPM5-2B is a candidate for text/tool-use evaluation as described in the README; complete v1 acceptance requires both structured tool use and image understanding. A text-only configuration must visibly report unavailable vision rather than claim to have inspected image contents. Processing has no cloud fallback. Setup may download dependencies and model weights; document processing must not send content to remote services. An unavailable model produces a visible error and preserves pending work.

**V1-03 — Small execution model.** One foreground process observes and reasons, with at most one active agent run and serial file mutations. `scan` runs once and exits. `watch` observes continuously and accepts terminal controls. There is no desktop UI, background service installation, or general workflow engine in v1.

## 2. Observation

**OBS-01 — Inventory.** Discover existing regular files and directories. Capture relative paths, metadata, content fingerprints for readable files, and processing status. Initially understand UTF-8 text, Markdown, CSV, TSV, Excel `.xlsx`, PDF, PNG, and JPEG. File formats expose information for reasoning; they do not select a predefined task. Unsupported, unreadable, encrypted, or corrupt files remain visible in status with a reason.

**OBS-02 — Stable batches.** Use filesystem notifications as hints. Wait for writes and a burst of changes to settle before reading a batch. Initial defaults: two seconds of write stability, two seconds of batch quiet, and reconciliation every 60 seconds. Recheck a file's version after extraction; discard the extraction and requeue if it changed during the read. These are operational defaults, not evidence that a writer has closed the file.

**OBS-03 — Reconciliation.** Reconcile at startup, periodically, and before resuming automatic work. Recover persistent additions, changes, and removals missed by notifications. If the root is unavailable, pause processing and report the problem; do not interpret the missing root as deletion of every file.

**OBS-04 — Identity and provenance.** Keep file identity separate from content version. A Foldy move preserves identity. A replacement at the same path creates a new version of that source. An external rename may preserve identity only when the old and new entries match unambiguously; otherwise record removal/addition without merging unrelated sources. Identical content in two paths still represents two files.

Record changes as Foldy-authored when matched to an operation's expected before/after state. Other changes are external or unknown; do not claim they were necessarily made by a human. Later external edits to a Foldy-created file must still be observed.

**OBS-05 — Honest limits.** v1 tracks observed settled versions and recovers the current state after downtime. It does not capture every intermediate edit, provide general file backup, or identify the author of arbitrary filesystem events. Partial document inspection must be labelled partial and must not support claims about unseen content.

**OBS-06 — PDF and image understanding.** Read PDF text where available and render pages for visual inspection of scans, figures, tables, or diagrams. A text layer does not imply that all meaningful page content has been inspected. Understand relevant objects, scenes, layout, and visual relationships in PNG/JPEG images, including images with no readable text. Extracted text alone cannot satisfy a visual-content question. Record which pages/images were actually inspected and identify uncertain interpretations.

**OBS-07 — Spreadsheet reading.** Read `.xlsx` sheet names and tabular cell data, preserving coordinates, types, number formats, and relevant headers. Include hidden sheets with their visibility recorded. Preserve merged-cell ranges so values are not mistaken for repeated independent cells. Read CSV/TSV as tables with row/column references, preserving original strings, quoting, empty cells, and leading zeros.

Preserve formulas and any stored results separately. Mark stored formula results as cached and unverified; missing results or error cells must not become invented values or zero. Do not evaluate formulas, execute spreadsheet code, refresh data connections, or follow external links. Workbook charts and embedded drawings are outside this first reader's coverage and must not be claimed inspected. Legacy `.xls`, `.xlsm`, `.ods`, and spreadsheet creation remain deferred.

## 3. Shared understanding

**CTX-01 — Source-backed findings.** Persist document-derived observations and inferred relationships with references to supporting file versions. A reference identifies the relevant text excerpt, PDF page, image, or spreadsheet sheet and cell/range; CSV/TSV references use row/column positions. Validate that references identify inspected sources and real locations; validate quotations and cited cell values against the extracted data. Structural validation does not prove that an image interpretation or inferred relationship is correct.

**CTX-02 — Cross-file context.** A run can retrieve relevant information from the whole root, including files inspected in earlier runs and other subdirectories. Supply a compact overview and retrieve original evidence as needed. Start with simple SQLite records and text search. The reasoning context must not grow by continually appending the entire folder or an unbounded conversation.

**CTX-03 — Uncertainty.** Distinguish observed information, inferred relationships, and explicit user confirmations. Retain conflicting evidence. An inference such as two documents describing one expense must identify its evidence and uncertainty. Similar amounts, dates, or filenames alone must not silently merge records or authorize physical deletion.

**CTX-04 — Invalidation.** When a source version changes or disappears, mark findings depending on that version stale, including conclusions that depend on those findings. Stale information remains available for historical explanations but is excluded from current conclusions and action preconditions until re-evaluated. Mark generated artifacts that depended on it stale in the journal; do not silently overwrite them.

**CTX-05 — Corrections.** The user can correct or reject a finding, confirm a relationship, or correct an action. Persist the correction with its target and explanation. It takes precedence over conflicting model inference in later runs. A correction tied to an old file version remains historical context; after that source changes, re-evaluate the fact rather than presenting the old value as current. Explicit ongoing instructions such as keeping a particular file in place continue to apply until revoked.

Broader preferences inferred from a correction stay tentative. An external move of a previously organized file is conservatively treated as a location preference for that file; Foldy must not move it back automatically. Do not generalize that event into a global filing rule.

## 4. Reasoning and actions

**RUN-01 — Generic reasoning.** Trigger reasoning from a stable change batch or explicit user request. Tools provide text/document/spreadsheet reading, image inspection, searching, evidence retrieval, finding recording, and controlled action requests. The model chooses useful work and may choose no action or request clarification. Folder names are context, not hardcoded workflow selectors.

**RUN-02 — Bounded execution.** Initial limits are 20 model-requested tool calls and five minutes per run, whichever is reached first. Cancel model work and stop at a safe operation boundary when a limit is reached. Record incomplete work visibly. Do not immediately retry the same exhausted run without new input or an explicit retry. Use Pi's existing context management and record the model server's effective context settings during evaluation.

**ACT-01 — Preview.** An action proposal names its operation, sources, explanation, and preconditions. Previewing changes no user files. An explanation is a short account of evidence and intended benefit; it is not a dump of hidden reasoning.

**ACT-02 — Allowed effects.** v1 can move or rename individual regular files within the root, create necessary subdirectories, and create new UTF-8 Markdown, text, or JSON artifacts. JSON outputs must parse. Preserve user-created directory names. Destination paths must not already exist. A revised report is a new artifact with a new path; internal state identifies the current result.

Overwriting existing files, deleting user files, renaming user-created directories, and acting in external applications are outside v1's automatic authority. v1 exposes no tools that perform those operations. Future support requires explicit authorization and a separate specification.

**ACT-03 — Preconditions.** Before each mutation, validate the current source version, source location, source evidence freshness, destination, path containment, and applicable corrections. Resolve paths safely and reject traversal through symlinks. Use exclusive creation and a no-clobber move operation; an overwrite-capable rename by itself is insufficient. If a safe operation is unavailable, refuse it rather than substituting an unsafe copy/delete sequence.

**ACT-04 — Journal and recovery.** Write a durable prepared journal entry before mutating files. Record the observed result afterward. An action is one move or one artifact creation, including any parent directories it created. Multiple actions are not presented as an atomic transaction.

On restart, reconcile prepared actions against their recorded before/after state. Mark an observed completed operation applied; leave a clearly unperformed operation unperformed. An ambiguous state becomes a visible conflict and causes no further mutation. Never blindly replay an interrupted operation.

**ACT-05 — Undo.** An explicit undo reverses one applied action only if its recorded postconditions still match. A moved file returns to its original path only if that path is free and its content has not changed. An unchanged generated artifact is moved into the internal undo archive. Remove only empty directories created by that action. Conflicts leave user files untouched and remain visible. Undoing organization suppresses automatic repetition of that same move unless the user explicitly requests it again.

**ACT-06 — No feedback loop.** Match Foldy's own writes to journal entries and update the inventory without scheduling the same work again. Do not ignore generated files wholesale: external changes to them are new input. Reconsider an old action only when relevant evidence or explicit user intent changes.

**ACT-07 — Autonomy.** Until chunk 09, mutations require explicit `apply` commands. After chunk 08's safety checks pass, `watch` may automatically execute permitted actions. Default automatic authority remains confined to organizing and creating within the root.

## 5. User controls

Run the application during development through `npm run foldy -- <command>`.

| Entry point | Behavior |
| --- | --- |
| `scan <root>` | Inspect once, update internal knowledge when persistence exists, print findings/status, and exit. Never organize or create artifacts in the root. |
| `watch <root>` | Observe continuously and accept the controls below on standard input. Automatic mutation is enabled only in chunk 09. |

The foreground watcher accepts:

| Control | Behavior |
| --- | --- |
| `status` | Show observation, pending/running work, errors, stale findings/artifacts, and conflicts. |
| `ask <text>` | Answer using current shared context and source references. This is read-only with respect to user files. |
| `explain <finding-or-action-id>` | Show the claim/action, supporting evidence, freshness, and applicable corrections. |
| `correct <finding-or-action-id\|folder> <text>` | Record a targeted correction or an explicit folder instruction and re-evaluate affected conclusions. Use `folder` to answer a clarification that has no finding/action target. |
| `plan` | Produce or refresh action proposals without applying them. |
| `apply <action-id>` | Explicitly apply one permitted proposal after rechecking preconditions. |
| `undo <action-id>` | Attempt the safe reversal defined by ACT-05. |
| `pause` | Stop automatic reasoning and new file mutations; continue observation. Acknowledge once any current mutation reaches a durable safe boundary. |
| `resume` | Reconcile, then resume pending automatic work. |
| `retry` | Re-attempt incomplete work against current source versions. |
| `quit` | Stop accepting work, cancel model work, settle any current journaled operation, and exit. |

Read-only questions and explanations remain available while paused. File mutations, including explicit `apply` and `undo`, require resuming first. Queue conflicting commands instead of creating concurrent writer loops. v1 does not require another process, an IPC server, or a web service for these controls.

## 6. Records and trust boundaries

These are minimum data contracts, not a demand for a framework, class hierarchy, or a generic graph engine.

| Record | Required information |
| --- | --- |
| File/version | Stable source ID, root-relative path, content fingerprint, observation time, processing status, extracted content or inspection summary |
| Evidence reference | Source ID, content version, text/page/image or sheet/cell/range locator, and relevant excerpt or cell data when available |
| Finding | ID, claim, observed/inferred kind, evidence references, supporting finding IDs when applicable, current/stale/rejected status, user confirmation if present |
| Correction | ID, target, user-authored text, time, and explicit scope; retained independently of model session compaction |
| Action | ID, operation, paths, inputs and expected versions, reason, preconditions, proposed/prepared/applied/conflict/failed/undone status, and undo information |

Store runtime state beneath `~/Library/Application Support/Foldy/<root-id>/`, where `root-id` is derived from the canonical root path. Use one SQLite database plus files needed for staging and undo. Treat a root path change as a new root in v1; do not silently attach old state to a different folder. General backup and retention management are deferred.

Source documents, generated documents, and their extracted text are untrusted data. Disable automatic discovery of Pi project/global instructions, extensions, skills, and settings for this application; supply only the application-owned resources required by the SDK. A dropped `AGENTS.md`, `.pi` directory, script, or URL cannot register a tool, change authority, access credentials, or enable remote inference. Ordinary files with these names may be inspected as data.

The model cannot write application configuration, the database, or the journal directly. Validated application tools own those operations. v1 exposes no unrestricted shell, arbitrary code execution, package installation, or external-app tools. Trusted document extraction helpers are fixed application code, not model-authored programs.

## 7. Acceptance scenarios

Each scenario ID must appear in the corresponding automated test name or live-evaluation record. Use synthetic data rather than personal documents.

| ID | Given / When / Then |
| --- | --- |
| A01 | Given a root, an outside file, an escaping symlink, and dropped instructions, when inspection/tool requests occur, then outside reads and authority changes are refused and user-file bytes remain unchanged. |
| A02 | Given local Ollama, when scanning two text files, then Pi produces source-referenced findings; with Ollama unavailable, the run reports failure without cloud fallback or false completion. |
| A03 | Given related files in different directories and different scan sessions, when the process restarts and a further file arrives, then relevant earlier evidence remains retrievable and a supported relationship can be recorded. |
| A04 | Given identical file copies and similar but unrelated transactions, when relationships are considered, then file identities remain distinct, unrelated records are not asserted equivalent, and no physical deletion occurs. |
| A05 | Given text PDFs, scanned PDFs, PNG/JPEG images, and text/Markdown/CSV sources, when inspected, then findings cite the correct inspected source and page/excerpt where applicable. |
| A06 | Given corrupt, encrypted, unsupported, unreadable, or partially inspected files, when a batch runs, then limitations are visible and other files continue; unseen content is not presented as inspected. |
| A07 | Given a slow copy, atomic save, and duplicate notifications, when writes settle, then only a consistent version supports current findings and repeated notifications do not duplicate work. |
| A08 | Given persistent changes made while stopped, when restarted, then reconciliation discovers current state; an unavailable root pauses work without marking everything deleted. A second Foldy instance for the same root is refused, while edits from an ordinary editor still succeed and are observed. |
| A09 | Given a relationship and artifact supported by a source, when that source changes or disappears, then dependent conclusions/artifacts become stale and cannot authorize another action until re-evaluated. |
| A10 | Given an explicit correction, when the process restarts and reasons again, then it respects the correction and explains its scope; changed source content is not concealed by an obsolete correction. |
| A11 | Given an external move or explicit undo of organization, when the next batch runs, then Foldy respects that file's location and does not move it back automatically. |
| A12 | Given an inferred useful task, when `plan` runs, then it emits explained proposals without filesystem mutation; changing superficial folder labels does not activate a hardcoded scenario. |
| A13 | Given a permitted move or artifact creation, when applied and then undone, then the original user-file state is recovered and generated artifacts are recoverable in the undo archive. |
| A14 | Given stale source versions, destination collisions, symlink substitution, or later user edits, when apply/undo runs, then the conflicting operation is refused without clobbering data. |
| A15 | Given termination before and after a journaled filesystem operation, when restarted, then the journal matches observed state without repeated effects; ambiguous state is reported as conflict. |
| A16 | Given Foldy-created/moved files, when the watcher sees those operations, then it settles without repeating them; a subsequent external edit is still processed. |
| A17 | Given active automatic work, when paused or a run budget expires, then no further mutation starts; resume/retry uses current input and preserves pending work. |
| A18 | Given the documented 15–20-file evaluation collection, when introduced across sessions and corrected/edited, then live local-model results satisfy the semantic checks in the implementation guide. |
| A19 | Given a multi-sheet `.xlsx` and CSV/TSV fixtures, when read, then values, sheet/cell or row/column references, hidden-sheet labels, merged ranges, and formula/cache distinctions are preserved. Missing formula results are explicit, input bytes remain unchanged, and external links or code are not executed. Relevant cells can support relationships to other files. |
| A20 | Given neutral filenames, an image without text, and a PDF containing both text and a meaningful figure, when visually inspected, then the local model identifies the manifest's visible facts and cites the correct image/page. OCR-only output or filename inference does not pass; a text-only model reports unavailable vision. |

Deterministic tests establish boundary enforcement, state transitions, persistence, and recovery. They do not establish the model's semantic quality. Live-model results must record the actual model/runtime configuration and observed failures or limitations.
