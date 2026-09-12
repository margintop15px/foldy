# Foldy

A local folder-reading agent built with Pi and Ollama. Foldy reads text, PNG/JPEG images and PDF pages, remembers source-backed findings across scans, and connects new inputs to earlier evidence. Quotations and visual references carry stable source IDs. The scanned folder stays unchanged.

Document reading is implemented. The broader phase 03 semantic quality gate remains open; see the [validation record](specs/implementation.md#03--understand-images-and-pdfs).

## Run

Use Node.js 24 and a running local Ollama server on `127.0.0.1:11434`.

```sh
npm ci --ignore-scripts
ollama pull qwen3.5:9b
npm run foldy -- scan ./tests/fixtures/text
```

Replace the fixture path with the folder to inspect. The result is JSON containing the inventory, inspection coverage, current findings, and errors. Exit codes: `0` for complete inspection, `2` for incomplete inspection, and `1` for a failed run.

Run the same command again: unchanged, completed work returns `cached: true` with zero model and tool calls, without contacting the model provider. New or changed inputs, removed or unverifiable evidence, a different provider, model tag or analysis revision, or unfinished reasoning trigger another run. `reasoningPending` distinguishes unfinished reasoning from unsupported files, which stay visible without repeatedly triggering inference. Stable corrupt or encrypted documents stay visible without repeated inference. A root with no eligible readable inputs makes no model requests.

`findingWrites` counts accepted and rejected finding writes in this run. If finding attempts were rejected and none succeeded, the scan stays `incomplete` with `reasoningPending: true`, even when all text was inspected or older findings exist. Tool errors remain visible after a later successful write. Runtime completion alone does not establish semantic quality; the benchmark checks required outcomes and supporting evidence separately.

State lives in `~/Library/Application Support/Foldy/<sha256-of-canonical-root>/foldy.sqlite`. Set `FOLDY_STATE_DIR=/path/to/private-state` to replace the base directory; the library also accepts `scan(root, { stateDir })`. Each root still gets its own hash-named subdirectory. State must be outside the scanned root. Use the same state base across processes to share knowledge and the SQLite writer guard. Overlapping scans using that database are refused; ordinary editor saves remain possible.

Changed, missing, or unverifiable evidence is excluded from current findings and search. Older versions and findings remain in SQLite as history. External renames are recorded as removal/addition for now. Database errors are reported without automatically resetting existing knowledge.

When Foldy's evidence rules change, `rebuildingKnowledge: true` reports a re-evaluation. Earlier conclusions stay historical until validated again; exact repeated findings keep their IDs. The database schema is upgraded transactionally without dropping sources or history.

Ollama is the default provider. Select another installed local model with `FOLDY_MODEL=<model-tag>`. Ollama mode refuses cloud aliases and remote endpoints; it never downloads a model during a scan. The selected model must support structured tool calls. Pi image input is enabled only when the selected model supports vision, using Ollama's advertised capabilities or Pi's bundled OpenAI catalog. A text-only model continues text/PDF-text work and reports unavailable visual inspection.

Foldy requests low reasoning effort when the installed model advertises thinking support. The selected mode is recorded in each report. Models without that capability use no thinking.

Each model response can generate up to 8,192 tokens, capped at half the effective context (4,096 with an 8,192-token context). This applies to text and document scans. The limit bounds generation time and context use; it is not a billing limit. Pi reserves that output space before compaction and can further reduce a request for remaining context or a shorter summary. The scan's five-minute text / 15-minute document deadline still applies.

Ollama must report an effective context of at least 8,192 tokens. Foldy reads the running model's context from `/api/ps` and gives that value to Pi. The evaluated Qwen setup uses 16,384 tokens. If a server uses a smaller context, configure an Ollama model with `PARAMETER num_ctx 16384` as described in [Ollama's context configuration](https://docs.ollama.com/api/openai-compatibility#setting-the-context-size).

## Check

For temporary OpenAI testing, set `OPENAI_API_KEY` in your shell and explicitly select the provider. On macOS's default zsh, this prompts for the key without echoing it or putting the value into command history:

```sh
read -rs "OPENAI_API_KEY?OpenAI API key: "
export OPENAI_API_KEY
FOLDY_PROVIDER=openai npm run foldy -- scan ./tests/fixtures/text
```

The OpenAI default is `gpt-4.1-mini`, selected for [low latency, tool calling and image input](https://developers.openai.com/api/docs/models/gpt-4.1-mini). Override it with `FOLDY_MODEL`; names must exist in Pi's bundled OpenAI Responses catalog. The same tools, local extraction, evidence validation and SQLite state are used. OpenAI mode sends inspected text, image/page previews and retrieved folder context to `https://api.openai.com/v1/responses`, with `store: false`, and incurs API charges. Use synthetic fixtures for benchmarks. No `.env` files are loaded, and documents cannot change the provider or access credentials.

Provider selection applies only to the prefixed command. To explicitly return to local inference, use `FOLDY_PROVIDER=ollama FOLDY_MODEL=qwen3.5:9b`. There is no automatic provider fallback. Completed cached scans do not need an API key. Library callers select explicitly with `scan(root, { provider: "openai", model: "gpt-4.1-mini", stateDir })`.

If an OpenAI request fails, rerun the same command to retry pending reasoning using the saved state. Requests are not automatically retried. `modelResponses` records each received OpenAI response's model-call number, HTTP status and request ID for [troubleshooting](https://developers.openai.com/api/reference/overview#debugging-requests); it does not log credentials, request bodies or other headers. HTTP 200 only means the response started successfully: a streamed generation can still fail. Use the report's `status`, `errors` and `reasoningPending` to judge completion. Full inspection coverage alone does not mean reasoning completed.

One document case, with two input stages and a final cache check:

```sh
FOLDY_PROVIDER=openai npm run bench -- --suite documents --case D03 --trials 1 --out benchmarks/runs/openai-d03-01
```

Each output directory must be new. OpenAI results are separate from the local-Qwen baseline; passing them does not establish local-model quality.

```sh
npm test
npm run typecheck
npm run test:live -- tests/live/chunk-01.live.ts
npm run test:live -- tests/live/chunk-02.live.ts
npm run test:live -- tests/live/chunk-03.live.ts
```

`npm test` runs all offline tests. They use synthetic temporary folders and isolated state, replace model access, and reject network requests. Live commands use Ollama by default and accept the explicit OpenAI environment selection above. Chunk 02 stages a plan, related notes, and an unrelated near-match across fresh processes, then checks a cached third scan. Chunk 03 connects an image receipt to a later PDF statement. No test uses personal documents.

For text and document quality, run `npm run bench -- --suite all --out benchmarks/runs/my-change --trials 3`, then independently review the retained claims and run `npm run bench:score -- benchmarks/runs/my-change --strict`. The full gate is 30 trials and 90 scans; `--suite text` (the default) and `--suite documents` run subsets. The [benchmark guide](benchmarks/README.md) explains saved outputs, explicit claim grading, and comparisons. Successful execution alone remains semantically unreviewed.

## Current limits

- UTF-8 `.txt`, `.md`, `.markdown`, and `.csv` (CSV as text), PNG/JPEG, and PDF. Spreadsheets remain deferred. PDF reads always present page pixels when vision is available, including pages with a text layer.
- At most 200 inventory entries and 32 directory levels. Text inputs: 64 KiB. Images: 20 MiB and 64 million pixels. PDFs: 50 MiB. Page text: 64 KiB, explicitly partial when capped. Text reads return 4,000 UTF-16 characters with continuation offsets; PDF pages are one-based.
- Previews preserve aspect ratio, have a longest edge of at most 2,000 pixels and an encoded payload of at most 4.5 MiB. Reductions and extraction warnings are reported. Original binary bytes and derived previews/text are cached in SQLite, while inspection coverage stays separate for each source.
- One fixed helper processes one file/page at a time, with a 30-second deadline. Cancellation kills and reaps it. The helper uses buffers and package-local PDF resources, without document URLs, attachments or embedded scripts. Process isolation is not an OS security sandbox or a hard native-memory limit.
- Text-only scans have 20 requested tool calls and five minutes; document scans have 80 calls and 15 minutes. This includes loading and one review pass in a fresh Pi context. Both passes share the original counters/deadline. Reaching a limit leaves work pending. A successful unchanged cache hit performs no model, extraction or rendering work.
- New text findings can cite a `textRef` returned by `read_file`: Foldy attaches the exact original excerpt, up to the 4,000-character read size, with its source version and location. The model can still copy a shorter exact `quote` of at most 2,000 characters. Image observations need a visual reference whose pixels reached a successful model turn. PDF citations identify their page; image-read text remains a visual interpretation. Successful compaction and the fresh review context clear text and visual references. `replacesFindingId` can retire a model finding after validating its complete replacement; history stays in SQLite. The model overview labels earlier coverage `previousInspection` and gives saved summaries `readBeforeCiting` locations. Persisted inspection alone does not authorize a new citation. Reference checks establish where quotations came from; they cannot establish whether every model interpretation is correct.
- `agentUsage` reports token counts for ordinary agent turns and the largest response. `inputTokens` excludes separately reported prompt-cache reads/writes. The counters exclude separate Pi compaction and Ollama preflight calls; `durationMs` covers the whole scan.
- Shared context uses a bounded overview and literal SQLite text search, with ten-result pages and 240-character snippets. Search does not count as inspection. There is no vector index or accumulated Pi conversation.
- Cache invalidation uses the selected provider, model tag and Foldy's analysis revision. Changing the weights behind an unchanged model tag is not detected by a cached scan. Historical state has no retention policy or user-facing history command yet.
- No watcher, user corrections, file organization, or generated artifacts yet. macOS is the supported initial platform.

See the [behavioral specification](specs/foldy-v1.md), [implementation chunks and evidence](specs/implementation.md), and [design decisions](specs/README.md). KISS governs the next chunk too.
