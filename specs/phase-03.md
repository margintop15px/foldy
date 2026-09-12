# Phase 03 — Images, PDFs, and a fully green quality gate

Status: implementation in progress. A passing runtime check is not a semantic quality pass.

Scope update (2026-09-12): the user asked to finish PDF parsing promptly and stop spending time on making every quality check green. Deliver the document reader with focused validation; defer further text-prompt tuning and the full 30-trial quality gate. The gate below remains the broader phase target, not a claimed passing result or a blocker for this reader delivery.

This records the approved phase. KISS: one local model, one SQLite database, three model tools, plain functions, sequential extraction. Watching, spreadsheets, generated user files, corrections and external actions remain in later slices.

## Sequential slices

| Slice | Outcome | Exit gate |
| --- | --- | --- |
| 03a | Correct text findings, explicit replacement with retained history, strict semantic grading | Six text cases, three trials each; all required outcomes and every final claim supported |
| 03b | PNG/JPEG inspection, orientation, bounded previews, source-backed visual evidence | Offline transport/evidence/persistence tests and live image evaluation |
| 03c | Text, scanned and mixed PDFs through page reading | Correct page citations, text/visual coverage, continued processing after failures |
| 03d | Persistent cross-format understanding | All offline tests, live smoke tests and ten-case benchmark green |

## Contracts

- Text runs retain five minutes and 20 tool calls. Runs with readable image/PDF inputs receive 15 minutes and 80 calls. Tests may shorten deadlines. Reports identify effective limits, coverage, processing counts and timings.
- Pin `pdfjs-dist@6.3.289`, `@napi-rs/canvas@1.0.9`, and `sharp@0.35.4`. Use one fixed extraction helper process, one active job, and a 30-second per-job deadline within the scan deadline. Cancel/kill the helper on timeout or cancellation.
- Input limits: 20 MiB / 64 million pixels for images; 50 MiB for PDFs. Preview longest edge at most 2,000 pixels and base64 payload at most 4.5 MiB. Report reductions. PDF page text at most 64 KiB; truncation is explicitly partial.
- `read_file(path, offset?, page?)` preserves text reads of 4,000 UTF-16 characters. Image reads return pixels and metadata. PDF reads return one page's pixels and bounded text, one-based `page`, `pageCount`, `nextPage`, and `nextOffset`.
- PDF text and visual coverage are independent. Rendering or extracting alone is not model inspection. Never claim omitted, corrupt, encrypted or unread content inspected.
- Evidence is an exact current-session quotation (plus page for PDF text) or a session-local visual reference. Visual references become eligible only after delivery to a successful model turn. Successful Pi compaction clears current citation eligibility; rereading restores it.
- Persist visual references as original source ID/version, image/page, preview fingerprint and dimensions. Model-interpreted image text is visual evidence, not verified extraction.
- `record_finding(..., replacesFindingId?)` validates a complete replacement before retiring a current model finding. Retain its history. A separate contradictory finding does not fix a current mistake.
- Enable Pi image transport only for models advertising vision. Text-only models continue eligible text work and report unavailable visual inspection.
- Migrate databases transactionally, preserving source/finding identities and history. Snapshot binary bytes one file at a time into SQLite; share extraction caches by original fingerprint, extractor revision and page while keeping inspection source-specific.
- Fingerprint each scan, recheck source versions after extraction, invalidate stale conclusions. Search current indexed PDF text and visual findings with literal text search; disclose incomplete coverage.
- Unchanged completed scans do zero model calls and zero extraction/rendering. Cancellation preserves valid progress and pending status. Stable corrupt/encrypted inputs do not cause inference retries by themselves.
- Use in-memory PDF bytes and package-local resources. Never follow document URLs, run embedded scripts or extract attachments. The helper is fault isolation, not an OS security sandbox.

## Quality protocol

Freeze original assets, source hashes and expected answers before model tuning. Preserve exact model previews. Fresh root/state per trial, fresh process per stage, two staged inputs and one zero-network cache probe. Serial execution; no selective retries. New fixes use a new named run, retaining failures.

`--strict` requires every required outcome and zero unsupported/contradicted final claims, including uncertainty. Review all final findings against their own evidence. Missing findings cannot earn a pass. Keep recovered tool errors, repetitions, latency, token use and coverage as separate metrics. Assistant-authored review must identify itself; independent human calibration remains a limitation.

| Case | Required evidence |
| --- | --- |
| D01 | PNG/JPEG objects, counts, colors and spatial relationships; orientation and changed-pixel variants with neutral filenames |
| D02 | Scanned receipt fields; connection to later statement; separation from similar unrelated debit |
| D03 | Mixed PDF text facts plus a meaningful figure absent from its text layer |
| D04 | 12-page document, useful final page, request/completion distinction, later related file |

The text oracle is versioned: revision 2 corrects Q01's role from project leader to prototype-review leader without changing source bytes. When image reading lands, Q06's deliberately invalid PNG must be reported corrupt rather than unsupported. Historical fixtures/results/grades are not rewritten.

## Required validation

```sh
npm test
npm run typecheck
npm run test:live -- tests/live/chunk-0{1,2,3}.live.ts
npm run bench -- --suite all --out <new-directory> --trials 3
npm run bench:score -- <new-directory> --strict
```

The final benchmark has 30 trials and 90 scans. Any required red check leaves phase 03 incomplete. Record actual commands, model/runtime configuration, results and limitations in the implementation and quality guides.
