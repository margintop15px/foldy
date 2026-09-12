# Foldy benchmark

The [first local-Qwen baseline](baselines/2026-09-12-qwen3.5-9b/scorecard.md) completed 54 scans. All execution/cache checks passed; **6/18 trials** met every quality requirement under the recorded assistant review. Its failures and both smoke-test logs are retained.

The [corrected-configuration comparison](baselines/2026-09-12-quality-fixes/scorecard.md) also completed 54 scans: **15/18 trials** pass the same requirements, with **2.8 times** the aggregate reasoning wall time. Median initial/later scans took **50.50/124.19 seconds**; the slowest took **196.37 seconds**. No deadline was hit, so the five-minute limit remains. The gate is still red; see the [review](baselines/2026-09-12-quality-fixes/review.md) and [timing data](baselines/2026-09-12-quality-fixes/timing.json).

The subsequent [citation guidance experiment](experiments/2026-09-12-citation-guidance/README.md) passed the unchanged strict cross-file smoke plus one Q05 and one Q06 trial with zero tool errors. A request-versus-completion meaning error remains in the smoke output. This targeted check does not replace the full comparison or make its quality gate green.

Configuration erratum: the first baseline configured a 2,048-token response limit, but the SDK sent `max_completion_tokens` rather than the `max_tokens` field read by Ollama 0.34.0. The intended client cap was not applied through the supported field. Original records are preserved; the current adapter and request-level regression test use `max_tokens`. Compare the actual adapter configuration as well as the recorded timing and quality results.

Run the real local model on the full ten-case phase 03 suite, three independent trials each:

```sh
npm run bench -- --suite all --out benchmarks/runs/my-change --trials 3
npm run bench:score -- benchmarks/runs/my-change --strict
```

For a temporary OpenAI check, set `OPENAI_API_KEY` in your shell, then run one synthetic document case:

```sh
FOLDY_PROVIDER=openai npm run bench -- --suite documents --case D03 --trials 1 --out benchmarks/runs/openai-d03-01
```

`FOLDY_MODEL` selects an OpenAI model from Pi's bundled catalog; the default is `gpt-4.1-mini`. OpenAI receives the inspected fixture text, exact image/page previews and retrieved context. API use is billable. The runner checks for a key before starting a new collection. `FOLDY_PROVIDER=ollama` returns to local testing; neither provider falls back to the other. No extraction, tools, prompts or grading rules change with the provider.

Manifests and scorecards identify the provider and model. Every trial still uses fresh state, and the final cache scan denies all network requests. Keep OpenAI and Ollama collections in separate output directories, compare the actual configuration and latency, and retain local regression runs: OpenAI success does not establish Qwen's semantic quality. Historical collections without a provider field are Ollama runs.

`--suite text` remains the default six-case suite. `--suite documents` selects D01–D04; `--suite all` is 30 trials / 90 scans. The output directory must be new. Set `FOLDY_MODEL` to compare another installed local model. `--case Q02 --trials 1` is available for diagnosis; a subset is not the full benchmark. Run serially without other model workloads for useful latency comparisons. First-load state is recorded in the manifest; each report includes its actual model digest/context/runtime.

Each trial has a fresh temporary root and SQLite state outside it. Two batches run in fresh processes using the same `scan` API as the CLI. The third process scans unchanged inputs with network access denied: it must return the same findings with zero model/tool calls. Q03 also replaces a source and removes another. Q06 needs read continuation and contains an intentionally invalid PNG. Before phase 03 it was unsupported; now it must be reported corrupt with readable reasoning finished. This versioned status correction does not turn it into a vision test. Historical reports and scores stay unchanged.

Text expectations are in `tests/quality/cases.ts`; document expectations are in `tests/quality/documents.ts`. The frozen binary originals, builder, expected visible facts and SHA-256 manifest are under `tests/fixtures/documents/`. Oracles stay outside the scanned inputs. Only its file contents enter Foldy's root. Oracles are frozen before a run, include required facts/connections, and forbid plausible mistakes. No benchmark-specific prompt is sent to Foldy.

The runner saves every attempted scan and checkpoints after each one. Nonzero exits, timeouts, invalid quotations, incomplete reasoning and cache failures remain in the results. It does not retry to manufacture a passing result. Existing tests cover cancellation, SQLite rollback, collisions and other deterministic boundaries; this suite adds real-model semantic evidence.

Artifacts in each run:

- `results.json`: reports, source identities/versions/coverage, errors, timings, model configuration, and the complete input/oracle snapshot.
- `source-snapshot.json` and `working-tree.patch`: exact evaluated code, dependency lockfile, code fingerprints, commit and uncommitted change identity. A benchmark from an uncommitted tree remains attributable.
- `Q01-1-1.jsonl` and peers: tool inputs/results for diagnosis. No model reasoning transcript is collected.
- `assets/` and `previews/`: the exact frozen input binaries and exact pixels returned by `read_file`. The scorer checks their hashes before accepting a review.
- `review.md`: sources, required outcomes, numbered findings, exact quotations and displayed image/page previews, with review labels when available.
- `review.json`: an explicit semantic assessment, bound to the results/report hashes.
- `scorer-source.txt` when present: the exact grading code identified in that review, separate from the code captured before inference began.
- `scorecard.md` and `scorecard-strict.md`: per-case quality, reliability, recovered tool errors, repetition, latency, token counts, extraction time and coverage. Strict scoring creates a separate file and preserves the historical grading contract. Cached scans are excluded from reasoning-quality totals.
- `timing.json` when present: timing distributions, token/call counts, instrumented tool durations and a check that evaluated code stayed unchanged during collection. Input-token counts exclude separately reported prompt-cache reads/writes; all token counters exclude separate compaction and preflight calls.
- `diagnostics.md` when present: prior diagnostic attempts and their limitations, kept separate from the full comparison.

The runner's exit code covers execution checks only. **An unreviewed result never passes the semantic scorer.** Phase 03 requires `--strict`: every required outcome and every reviewed final claim, including uncertainty, must be supported. A harmless-looking unsupported extra still fails. Altered source/preview bytes or runtime changes during collection also invalidate the run. `bench:score` exits 1 for unreviewed/failed/incomplete results and 0 only when every staged result and cache check passes. It refuses stale reviews and like-for-like comparisons with changed fixture/oracle hashes or trial counts.

## Review the claims

Read `review.md`, compare each claim and its uncertainty with its cited evidence, and record the assessment in `review.json`. A short version of its format:

```json
{
  "reviewer": "Name, human or assistant; calibration limitations",
  "resultsHash": "SHA256 of JSON.stringify(parsed results.json)",
  "stages": {
    "Q01/1/1": {
      "reportHash": "SHA256 of JSON.stringify(this scan's report)",
      "usefulness": 2,
      "notes": "Why this result is useful, or what it missed.",
      "claims": [{
        "text": "One atomic claim, preserving qualifications.",
        "findings": [1],
        "label": "supported",
        "kind": "fact",
        "covers": ["owner"],
        "reason": "Why these quoted sources support this specific fact."
      }]
    }
  }
}
```

Labels are `supported`, `contradicted`, or `insufficient`; kinds are `fact`, `relationship`, or `uncertainty`. Mark wrong dates, amounts, entities and invented approvals `critical: true`; mark a false relationship `falseConnection: true`. `findings` contains one-based numbers in the report, not UUIDs. Split independent owner/date/amount claims. Merge equivalent repeated claims with the same support judgment and list their finding numbers together. Keep an insufficiently cited repeat separate from a supported occurrence, so deduplication cannot conceal bad citations; precision counts these separately assessed claim groups. Cover all findings, including retained findings from stage 1. Read uncertainty text too: speculation there can still be an unsupported factual claim.

Give `covers` credit only when the full named obligation is satisfied with its required evidence. A quoted fact absent from the finding is not automatically a reported fact. Historical dates explicitly labelled original/superseded are valid; an old current-date claim is not repaired merely by adding a conflicting newer finding. Additional supported observations are welcome. Empty output has N/A precision and zero positive coverage.

For a required relationship, one finding must cite all required sources. Document requirements may additionally demand a page or a visual reference: D03 chart values need pixels; D04 dates and room status need page 12. Inspect the retained preview itself, not just the extracted text or the original at a different resolution. Do not synthesize a connection by combining independent findings during review. Required outcomes are whole frozen obligations: for example, Q01's review connection includes the newly requested room. The relationship-coverage column is not a count of every valid connection the model may have made.

Grounding is checked against the cited, inspected source versions, using excerpts in their document context. A source that merely says someone confirmed a meeting does not establish that they lead it. Correct facts elsewhere in the folder cannot repair a finding that omits their source. Unsupported connection counts include insufficient citations; they do not necessarily mean the connected records are actually unrelated.

Usefulness: 0 misleading/unhelpful, 1 correct but incomplete/repetitive, 2 concise and covers the main point. Three trials are a regression signal, not a production reliability estimate. Review every new output; do not use keyword matches, the evaluated model's self-assessment, or a remembered score to declare success. Assistant evidence reviews are clearly identified and need independent human calibration before being treated as ground truth.

The scorer checks review completeness and source references; it does **not** interpret natural language. Its counterexample tests verify that unreviewed wrong amounts/negations stay unreviewed and explicitly negative labels fail. They do not claim an automatic semantic judge exists.

For future changes, rerun unchanged cases, review the new outputs, then compare both scorecards. Keep performance and semantic differences separate. Once a case informs prompt tuning it is a development regression; add independent confirmation cases before claiming general improvement.

## Phase 03 document cases

| Case | Evidence that must be understood |
| --- | --- |
| D01 | Neutral PNG/JPEG shapes, exact counts/colors/layout, EXIF orientation, and an edited image whose changed pixels replace the earlier claim |
| D02 | Scanned receipt fields, later statement match by payment reference and date difference, separate near-match |
| D03 | PDF text plus raster chart values absent from the text layer; a later inspection request stays a request |
| D04 | All 12 pages, useful facts on page 12, unconfirmed room request followed by a later confirmation |

Each document case uses the same generic scan prompt and three tools as the text cases. Preview hashes and text/visual coverage are separate from source fingerprints. Document scans have 15 minutes / 80 calls; text-only scans retain five minutes / 20. All limits and effective model/runtime settings are recorded per scan. A completed unchanged cache probe must do zero model calls, network requests, extraction jobs and rendering.
