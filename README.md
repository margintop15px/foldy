# Foldy

A local folder-reading agent built with Pi and Ollama. Foldy remembers text files and source-backed findings across scans, connects new inputs to earlier evidence, and prints checked quotations with stable source IDs. The scanned folder stays unchanged.

## Run

Use Node.js 24 and a running local Ollama server on `127.0.0.1:11434`.

```sh
npm ci --ignore-scripts
ollama pull qwen3.5:9b
npm run foldy -- scan ./tests/fixtures/text
```

Replace the fixture path with the folder to inspect. The result is JSON containing the inventory, inspection coverage, current findings, and errors. Exit codes: `0` for complete inspection, `2` for incomplete inspection, and `1` for a failed run.

Run the same command again: unchanged, completed work returns `cached: true` with zero model and tool calls, without contacting Ollama. New or changed inputs, removed or unverifiable evidence, a different model tag or analysis revision, or unfinished reasoning trigger another run. `reasoningPending` distinguishes unfinished reasoning from unsupported files, which stay visible without repeatedly triggering inference. A root with no readable text makes no model requests.

State lives in `~/Library/Application Support/Foldy/<sha256-of-canonical-root>/foldy.sqlite`. Set `FOLDY_STATE_DIR=/path/to/private-state` to replace the base directory; the library also accepts `scan(root, { stateDir })`. Each root still gets its own hash-named subdirectory. State must be outside the scanned root. Use the same state base across processes to share knowledge and the SQLite writer guard. Overlapping scans using that database are refused; ordinary editor saves remain possible.

Changed, missing, or unverifiable evidence is excluded from current findings and search. Older versions and findings remain in SQLite as history. External renames are recorded as removal/addition for now. Database errors are reported without automatically resetting existing knowledge.

When Foldy's evidence rules change, `rebuildingKnowledge: true` reports a re-evaluation. Earlier conclusions stay historical until validated again; exact repeated findings keep their IDs. The database schema is upgraded transactionally without dropping sources or history.

Select another installed local model with `FOLDY_MODEL=<model-tag>`. Cloud models and remote endpoints are refused. Foldy never downloads a model during a scan. The selected model must support structured tool calls; this chunk does not use vision.

Foldy requests low reasoning effort when the installed model advertises thinking support. The selected mode is recorded in each report. Models without that capability use no thinking.

Ollama must report an effective context of at least 8,192 tokens. Foldy reads the running model's context from `/api/ps` and gives that value to Pi. The evaluated Qwen setup uses 16,384 tokens. If a server uses a smaller context, configure an Ollama model with `PARAMETER num_ctx 16384` as described in [Ollama's context configuration](https://docs.ollama.com/api/openai-compatibility#setting-the-context-size).

## Check

```sh
npm test
npm run typecheck
npm run test:live -- tests/live/chunk-01.live.ts
npm run test:live -- tests/live/chunk-02.live.ts
```

`npm test` runs all offline tests. They use synthetic temporary folders and isolated state, replace model access, and reject network requests. The live commands explicitly enable local Ollama access. Chunk 02 stages a plan, related notes, and an unrelated near-match across fresh processes, then checks a cached third scan. No test uses personal documents.

For output quality across projects, expenses, renewals, creative notes, conflicts, and hostile text, run `npm run bench -- --out benchmarks/runs/my-change --trials 3`. The [benchmark guide](benchmarks/README.md) explains saved outputs, explicit claim grading, and comparisons. Successful execution alone remains semantically unreviewed.

## Current limits

- UTF-8 `.txt`, `.md`, `.markdown`, and `.csv`; CSV is read as text. PDFs, images, and structured spreadsheets arrive in later chunks.
- At most 200 inventory entries, 32 directory levels, and 64 KiB per readable file. Larger or unsupported inputs remain visible with a reason. Each tool read returns up to 4,000 UTF-16 characters and can continue at the next offset.
- At most 20 requested tool calls and five minutes per scan, including model loading and one completeness check. Both passes share the same limits. Reaching a limit reports incomplete work.
- New findings must quote excerpts read in the current session. The model overview labels earlier coverage `previousInspection` and gives saved summaries `readBeforeCiting` locations. Persisted inspection alone does not authorize a new citation. Separated passages need separate exact quotes. Reference checks establish where quotations came from; they cannot establish whether every model interpretation is correct.
- `agentUsage` reports token counts for ordinary agent turns and the largest response. `inputTokens` excludes separately reported prompt-cache reads/writes. The counters exclude separate Pi compaction and Ollama preflight calls; `durationMs` covers the whole scan.
- Shared context uses a bounded overview and literal SQLite text search, with ten-result pages and 240-character snippets. Search does not count as inspection. There is no vector index or accumulated Pi conversation.
- Cache invalidation uses the selected model tag and Foldy's analysis revision; replacing weights under the same tag is not detected without contacting Ollama. Historical state has no retention policy or user-facing history command yet.
- No watcher, new document formats, corrections, file organization, or generated artifacts yet. macOS is the supported initial platform.

See the [behavioral specification](specs/foldy-v1.md), [implementation chunks and evidence](specs/implementation.md), and [design decisions](specs/README.md). KISS governs the next chunk too.
