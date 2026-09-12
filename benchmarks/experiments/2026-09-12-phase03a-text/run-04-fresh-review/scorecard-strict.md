# Foldy quality benchmark

Model: qwen3.5:9b. Base commit: 70783de66cf30ccb829ed4620d6cf19e812d0800; evaluated working-tree code is saved in source-snapshot.json.

Run finished: 3/3 scans. Reviewer: Codex assistant; manual review of claims and uncertainty against their own citations. Human calibration pending..

STRICT: every reviewed claim, including uncertainty, must be supported. Pass requires both staged scans to meet their oracle, no critical unsupported claims/false connections, valid sources, finished reasoning, unchanged source bytes, and a zero-network cache probe. Assistant grading is provisional until independently checked by a person.

| Case | Trial passes | Supported claims | Required facts | Required links | Uncertainty | Unsupported links | Repetitions | Usefulness (0–2) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Q04 Creative context without shared IDs | 0/1 | 6/7 (86%) | 5/5 (100%) | 0/1 (0%) | N/A | 1 | 0 | 2, 2 |

Times are seconds: median [min–max]. Stages are paired within trials; cached scans are not additional reasoning trials.

| Case | Stage 1 wall | Stage 2 wall | Cache wall | Model calls (live) | Tool calls (live) | Tool errors |
| --- | --- | --- | --- | --- | --- | --- |
| Q04 | 47.01 [47.01–47.01] | 103.08 [103.08–103.08] | 0.83 [0.83–0.83] | 10 | 11 | 0 |

Expected-status, finished-reasoning live scans: 2/2. Cache checks: 1/1.

Q06 deliberately contains an unsupported image placeholder: honest `incomplete` with no pending readable work is expected. It is not a vision test. Reported runtime status and semantic grades measure different things. Unsupported links include incomplete citations and unsupported inferences; they are not necessarily false entity matches. Precision counts reviewed atomic claim groups; poorly cited repeats are kept separate from supported occurrences.

## Failures and missing outcomes

- **Q04/1/2**: Missing: scene-link FAILED: F3 attributes Neri and lighthouse from uncited character information. The reviewer reread all three sources but did not repair or jointly cite this finding.

Raw reports and embedded fixtures/oracles: `results.json`. Atomic claim labels: `review.json` when present. Full inspection/review sheet: `review.md`. Per-scan `.jsonl` files contain tool inputs/results, not hidden reasoning.
