# Phase 03a text-quality experiments

Status: further text tuning is deferred at the user's request to finish PDF parsing promptly. The full text gate remains open. A targeted pass does not establish the six-case gate or phase 03 completion.

All runs use the existing six synthetic text cases, with Q01's oracle corrected to **prototype-review leader** rather than project leader (oracle revision 2; source bytes unchanged). Every final claim, including uncertainty, must have sufficient support in its own finding's citations. Reviews are explicit Codex judgments independent of the tested local Qwen model; human calibration remains pending. These are development regressions, not held-out measures of generalization.

| Run | Change | Observed result |
| --- | --- | --- |
| `run-01` | Analysis revision 9; replacement tool and stricter instructions | 54 attempts retained. Sandbox network access prevented Ollama requests; this is an environment failure, not a semantic evaluation. |
| `run-02` | Same revision with authorized local-server access | Stopped after a Q04 semantic failure; 14 scans retained. A correct separate connection did not repair an under-cited scene finding. All attempted execution checks passed, but the semantic gate failed. |
| `run-03-q04` | Revision 10; stronger source-specific identity guidance | Three scans. Under-cited scene identity remained and the pilot's required fearless trait was omitted. Strict gate failed. |
| `run-04-fresh-review` | Revision 11; review in a fresh Pi context, same model and original budget | Three scans. The reviewer reread evidence but left an under-cited scene finding and missed the complete joint connection. Strict gate failed. |
| `run-05-review-role` | Revision 12; explicit reviewer role and validated replacement of reviewed findings | Three scans. The complete joint connection was present, but an unsupported single-source summary remained current. Strict gate failed. |
| `run-06-consolidate` | Revision 13; consolidate a new contribution with its earlier context | Three scans; targeted Q04 strict review passed. The remaining separate scene summary is supported but redundant. This is one trial, not evidence of repeatability. |
| `run-07-full` | Freeze revision 13 for all six cases, three trials | Stopped after eight scans. Q01/Q02 first trials pass strict review; Q03 hit the five-minute deadline during redundant review work. Its later scan was interrupted by low-power sleep and also retained under-supported extras. The collection fails. |
| `run-08-review-changes` | Revision 14; leave supported findings unchanged during review | Cancelled at the user's change in priority after two scan attempts. The second scan preserves cancellation status; no cache stage or complete quality grade is claimed. |

Commands used `npm run bench -- --out <this-directory>/<run> --trials 3` for full attempts and `--case Q04 --trials 1` for targeted diagnosis. `npm run bench:score -- <run-directory> --strict` writes `scorecard-strict.md`; failed/unreviewed/unfinished collections exit 1. `review-draft.json` is work in progress until the final results hash is bound. No failed trial is replaced by a selected retry.

The successful targeted run took 132.732 seconds for the first scan, 190.343 seconds for the later batch and 0.726 seconds for the unchanged cache probe. Its model was local `qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, Ollama 0.34.0, 16,384-token context, low thinking, temperature 0, `max_tokens: 2048`, no retries, five minutes and 20 tool calls. Per-scan reports record actual configuration; these timings are not controlled inference-throughput measurements.

Production changes are generic role/modality/evidence instructions, an optional validated `replacesFindingId`, and one fresh-context review sharing the existing model and run limits. The application does not receive case IDs or oracle answers. Stronger prompting and model self-review do not prove entailment; the retained failures demonstrate their limits.

Power interruption in `run-07-full`: macOS `pmset -g log` records low-power sleep at **2026-09-12 12:25:10 +0200**, on battery at 1%, and wake on AC at **13:05:21** (40m11s). Q03/1/2 spans that interval and reports 2,555.579 seconds of wall time; do not interpret it as local-model inference latency. Q03/1/1 reached its five-minute deadline before sleep, so that separate timeout remains a valid failure. The raw results and statuses are unchanged. The full run's aggregate duration is unsuitable for speed comparison.
