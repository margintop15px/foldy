# Foldy quality benchmark

Model: qwen3.5:9b. Base commit: 70783de66cf30ccb829ed4620d6cf19e812d0800; evaluated working-tree code is saved in source-snapshot.json.

Run finished: 3/3 scans. Reviewer: Codex assistant; explicit manual semantic review. Independent human calibration pending..

STRICT: every reviewed claim, including uncertainty, must be supported. Pass requires both staged scans to meet their oracle, no critical unsupported claims/false connections, valid sources, finished reasoning, unchanged source bytes, and a zero-network cache probe. Assistant grading is provisional until independently checked by a person.

| Case | Trial passes | Supported claims | Required facts | Required links | Uncertainty | Unsupported links | Repetitions | Usefulness (0–2) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Q04 Creative context without shared IDs | 0/1 | 7/8 (88%) | 4/5 (80%) | 1/1 (100%) | N/A | 1 | 0 | 2, 2 |

Times are seconds: median [min–max]. Stages are paired within trials; cached scans are not additional reasoning trials.

| Case | Stage 1 wall | Stage 2 wall | Cache wall | Model calls (live) | Tool calls (live) | Tool errors |
| --- | --- | --- | --- | --- | --- | --- |
| Q04 | 42.56 [42.56–42.56] | 99.02 [99.02–99.02] | 0.86 [0.86–0.86] | 8 | 8 | 0 |

Expected-status, finished-reasoning live scans: 2/2. Cache checks: 1/1.

Q06 deliberately contains an unsupported image placeholder: honest `incomplete` with no pending readable work is expected. It is not a vision test. Reported runtime status and semantic grades measure different things. Unsupported links include incomplete citations and unsupported inferences; they are not necessarily false entity matches. Precision counts reviewed atomic claim groups; poorly cited repeats are kept separate from supported occurrences.

## Failures and missing outcomes

- **Q04/1/2**: Missing: other-story FAILED: F3 has an uncited lighthouse attribution. Also the pilot finding omits the required fearless characterization; citing the word does not report it.

Raw reports and embedded fixtures/oracles: `results.json`. Atomic claim labels: `review.json` when present. Full inspection/review sheet: `review.md`. Per-scan `.jsonl` files contain tool inputs/results, not hidden reasoning.
