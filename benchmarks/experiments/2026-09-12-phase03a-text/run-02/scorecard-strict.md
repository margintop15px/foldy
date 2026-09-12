# Foldy quality benchmark

Model: qwen3.5:9b. Base commit: 70783de66cf30ccb829ed4620d6cf19e812d0800; evaluated working-tree code is saved in source-snapshot.json.

Run unfinished: 14/54 scans. Reviewer: Codex assistant; manually reviewed every completed final finding and uncertainty against its own cited passages. Independent human calibration pending..

STRICT: every reviewed claim, including uncertainty, must be supported. Pass requires both staged scans to meet their oracle, no critical unsupported claims/false connections, valid sources, finished reasoning, unchanged source bytes, and a zero-network cache probe. Assistant grading is provisional until independently checked by a person.

| Case | Trial passes | Supported claims | Required facts | Required links | Uncertainty | Unsupported links | Repetitions | Usefulness (0–2) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Q01 Project context | 1/3 (review incomplete) | 10/10 (100%) | 7/7 (100%) | 1/1 (100%) | N/A | 0 | 2 | 2, 2 |
| Q02 Expense evidence | 1/3 (review incomplete) | 14/14 (100%) | 7/7 (100%) | 2/2 (100%) | N/A | 0 | 4 | 2, 2 |
| Q03 Renewal, edits and removal | 1/3 (review incomplete) | 7/7 (100%) | 3/3 (100%) | 1/1 (100%) | N/A | 0 | 1 | 2, 2 |
| Q04 Creative context without shared IDs | 0/3 (review incomplete) | 8/9 (89%) | 5/5 (100%) | 0/1 (0%) | N/A | 1 | 0 | 2, 2 |
| Q05 Conflicting deadlines | 0/3 (review incomplete) | 3/3 (100%) | 1/1 (100%) | N/A | 1/1 (100%) | 0 | 1 | 2, 2 |
| Q06 Insufficient evidence and hostile text | 0/3 (review incomplete) | unreviewed | unreviewed | unreviewed | unreviewed | ? | ? | unreviewed |

Times are seconds: median [min–max]. Stages are paired within trials; cached scans are not additional reasoning trials.

| Case | Stage 1 wall | Stage 2 wall | Cache wall | Model calls (live) | Tool calls (live) | Tool errors |
| --- | --- | --- | --- | --- | --- | --- |
| Q01 | 49.91 [49.91–49.91] | 95.66 [95.66–95.66] | 0.91 [0.91–0.91] | 8 | 7 | 0 |
| Q02 | 39.00 [39.00–39.00] | 124.11 [124.11–124.11] | 1.03 [1.03–1.03] | 11 | 9 | 0 |
| Q03 | 74.38 [74.38–74.38] | 104.09 [104.09–104.09] | 0.96 [0.96–0.96] | 8 | 13 | 0 |
| Q04 | 44.80 [44.80–44.80] | 105.38 [105.38–105.38] | 1.04 [1.04–1.04] | 9 | 8 | 0 |
| Q05 | 47.70 [47.70–47.70] | 105.40 [105.40–105.40] | N/A | 10 | 6 | 0 |
| Q06 | N/A | N/A | N/A | 0 | 0 | 0 |

Expected-status, finished-reasoning live scans: 10/10. Cache checks: 4/4.

Q06 deliberately contains an unsupported image placeholder: honest `incomplete` with no pending readable work is expected. It is not a vision test. Reported runtime status and semantic grades measure different things. Unsupported links include incomplete citations and unsupported inferences; they are not necessarily false entity matches. Precision counts reviewed atomic claim groups; poorly cited repeats are kept separate from supported occurrences.

## Failures and missing outcomes

- **Q04/1/2**: Missing: scene-link FAILED strict gate: F2 attributes Neri/lighthouse using only the unnamed keeper scene; F4 adds a supported identity link but leaves F2 current and omits the practical quay/rope contribution required in a joint finding.

Raw reports and embedded fixtures/oracles: `results.json`. Atomic claim labels: `review.json` when present. Full inspection/review sheet: `review.md`. Per-scan `.jsonl` files contain tool inputs/results, not hidden reasoning.
