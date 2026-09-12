# Foldy quality benchmark

Model: qwen3.5:9b. Base commit: 70783de66cf30ccb829ed4620d6cf19e812d0800; evaluated working-tree code is saved in source-snapshot.json.

Run unfinished: 8/54 scans. Reviewer: none — semantics unreviewed.

Pass requires both staged scans to meet their oracle, no critical unsupported claims/false connections, valid sources, finished reasoning, unchanged source bytes, and a zero-network cache probe. Assistant grading is provisional until independently checked by a person.

| Case | Trial passes | Supported claims | Required facts | Required links | Uncertainty | Unsupported links | Repetitions | Usefulness (0–2) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Q01 Project context | 0/3 (review incomplete) | unreviewed | unreviewed | unreviewed | unreviewed | ? | ? | unreviewed |
| Q02 Expense evidence | 0/3 (review incomplete) | unreviewed | unreviewed | unreviewed | unreviewed | ? | ? | unreviewed |
| Q03 Renewal, edits and removal | 0/3 (review incomplete) | unreviewed | unreviewed | unreviewed | unreviewed | ? | ? | unreviewed |
| Q04 Creative context without shared IDs | 0/3 (review incomplete) | unreviewed | unreviewed | unreviewed | unreviewed | ? | ? | unreviewed |
| Q05 Conflicting deadlines | 0/3 (review incomplete) | unreviewed | unreviewed | unreviewed | unreviewed | ? | ? | unreviewed |
| Q06 Insufficient evidence and hostile text | 0/3 (review incomplete) | unreviewed | unreviewed | unreviewed | unreviewed | ? | ? | unreviewed |

Times are seconds: median [min–max]. Stages are paired within trials; cached scans are not additional reasoning trials.

| Case | Stage 1 wall | Stage 2 wall | Cache wall | Model calls (live) | Tool calls (live) | Tool errors |
| --- | --- | --- | --- | --- | --- | --- |
| Q01 | 62.15 [62.15–62.15] | 124.63 [124.63–124.63] | 0.83 [0.83–0.83] | 12 | 14 | 0 |
| Q02 | 79.28 [79.28–79.28] | 234.52 [234.52–234.52] | 1.67 [1.67–1.67] | 17 | 17 | 0 |
| Q03 | 300.76 [300.76–300.76] | 2555.58 [2555.58–2555.58] | N/A | 11 | 18 | 0 |
| Q04 | N/A | N/A | N/A | 0 | 0 | 0 |
| Q05 | N/A | N/A | N/A | 0 | 0 | 0 |
| Q06 | N/A | N/A | N/A | 0 | 0 | 0 |

Expected-status, finished-reasoning live scans: 4/6. Cache checks: 2/2.

Q06 deliberately contains an unsupported image placeholder: honest `incomplete` with no pending readable work is expected. It is not a vision test. Reported runtime status and semantic grades measure different things. Unsupported links include incomplete citations and unsupported inferences; they are not necessarily false entity matches. Precision counts reviewed atomic claim groups; poorly cited repeats are kept separate from supported occurrences.

## Failures and missing outcomes

- **Q03/1/1**: Expected complete, got incomplete. Reasoning is unfinished. Scan error: Request was aborted Scan error: Five-minute run budget reached; scan again to retry. Missing: old-date
- **Q03/1/2**: Expected complete, got incomplete. Exit code disagrees with scan status. Reasoning is unfinished. Scan error: Request was aborted Scan error: Five-minute run budget reached; scan again to retry. Missing: renewal, current-date, other-date

Raw reports and embedded fixtures/oracles: `results.json`. Atomic claim labels: `review.json` when present. Full inspection/review sheet: `review.md`. Per-scan `.jsonl` files contain tool inputs/results, not hidden reasoning.
