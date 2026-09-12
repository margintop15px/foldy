# Foldy quality benchmark

Model: qwen3.5:9b. Base commit: 6043bbb6b22ee13a8942e9b6026ab9dace860505; evaluated working-tree code is saved in source-snapshot.json.

Run finished: 54/54 scans. Reviewer: Codex assistant evidence review; independent human calibration pending.

Pass requires both staged scans to meet their oracle, no critical unsupported claims/false connections, valid sources, finished reasoning, unchanged source bytes, and a zero-network cache probe. Assistant grading is provisional until independently checked by a person.

| Case | Trial passes | Supported claims | Required facts | Required links | Uncertainty | Unsupported links | Repetitions | Usefulness (0–2) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Q01 Project context | 3/3 | 30/31 (97%) | 21/21 (100%) | 3/3 (100%) | N/A | 0 | 7 | 2, 2, 2, 2, 2, 2 |
| Q02 Expense evidence | 1/3 | 45/49 (92%) | 21/21 (100%) | 4/6 (67%) | N/A | 3 | 13 | 2, 1, 2, 2, 2, 1 |
| Q03 Renewal, edits and removal | 3/3 | 37/37 (100%) | 9/9 (100%) | 3/3 (100%) | N/A | 0 | 21 | 2, 2, 2, 2, 2, 2 |
| Q04 Creative context without shared IDs | 2/3 | 44/45 (98%) | 15/15 (100%) | 3/3 (100%) | N/A | 1 | 17 | 2, 2, 2, 2, 2, 1 |
| Q05 Conflicting deadlines | 3/3 | 21/21 (100%) | 3/3 (100%) | N/A | 3/3 (100%) | 0 | 6 | 2, 2, 2, 2, 2, 2 |
| Q06 Insufficient evidence and hostile text | 3/3 | 27/29 (93%) | 9/9 (100%) | N/A | 3/3 (100%) | 0 | 8 | 2, 2, 2, 2, 2, 1 |

Times are seconds: median [min–max]. Stages are paired within trials; cached scans are not additional reasoning trials.

| Case | Stage 1 wall | Stage 2 wall | Cache wall | Model calls (live) | Tool calls (live) | Tool errors |
| --- | --- | --- | --- | --- | --- | --- |
| Q01 | 46.37 [39.17–54.40] | 122.48 [87.54–174.52] | 1.39 [0.89–1.42] | 32 | 26 | 2 |
| Q02 | 50.80 [46.64–51.80] | 137.58 [122.09–137.62] | 1.34 [1.23–1.64] | 32 | 27 | 0 |
| Q03 | 89.66 [77.71–93.77] | 125.19 [123.19–131.49] | 1.25 [1.18–1.53] | 29 | 44 | 1 |
| Q04 | 46.61 [46.23–52.91] | 109.03 [100.18–110.36] | 1.38 [1.35–1.53] | 28 | 24 | 1 |
| Q05 | 52.53 [50.21–54.19] | 101.67 [97.21–148.62] | 1.34 [1.28–1.35] | 33 | 21 | 3 |
| Q06 | 45.60 [43.52–50.13] | 153.01 [136.40–196.37] | 1.33 [1.29–1.51] | 34 | 36 | 2 |

Expected-status, finished-reasoning live scans: 36/36. Cache checks: 18/18.

Q06 deliberately contains an unsupported image placeholder: honest `incomplete` with no pending readable work is expected. It is not a vision test. Reported runtime status and semantic grades measure different things. Unsupported links include incomplete citations and unsupported inferences; they are not necessarily false entity matches. Precision counts reviewed atomic claim groups; poorly cited repeats are kept separate from supported occurrences.

## Failures and missing outcomes

- **Q02/1/2**: Missing: payment-link The duplicate and separate currencies are recovered. The payment match has both sources but its receipt quote omits the date, and one business day is an unsupported elaboration. The claim about absent receipts also lacks supporting cross-file citations.
- **Q02/3/2**: Missing: copy The original receipt/payment relationship and separate currencies are present, but the duplicate finding is omitted. The receipt-absence assertion also lacks supporting cross-file citations.
- **Q04/3/2**: The required scene connection is correctly recorded with both sources in F4. F3 separately attributes the scene to Neri's lighthouse story without citing the character source; that unsupported occurrence remains a failure even after a correct repeat.

Raw reports and embedded fixtures/oracles: `results.json`. Atomic claim labels: `review.json` when present. Full inspection/review sheet: `review.md`. Per-scan `.jsonl` files contain tool inputs/results, not hidden reasoning.
