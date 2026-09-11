# Foldy

A local folder-reading agent built with Pi and Ollama. Chunk 01 scans text files and prints findings with checked quotations, line references, and source fingerprints. The scanned folder stays unchanged.

## Run

Use Node.js 24 and a running local Ollama server on `127.0.0.1:11434`.

```sh
npm ci --ignore-scripts
ollama pull qwen3.5:9b
npm run foldy -- scan ./tests/fixtures/text
```

Replace the fixture path with the folder to inspect. The result is JSON containing the inventory, inspection coverage, findings, and errors. Exit codes: `0` for complete inspection, `2` for incomplete inspection, and `1` for a failed run. Run `scan` again to retry; nothing is persisted yet.

Select another installed local model with `FOLDY_MODEL=<model-tag>`. Cloud models and remote endpoints are refused. Foldy never downloads a model during a scan. The selected model must support structured tool calls; this chunk does not use vision.

Ollama must report an effective context of at least 8,192 tokens. Foldy reads the running model's context from `/api/ps` and gives that value to Pi. The evaluated Qwen setup uses 16,384 tokens. If a server uses a smaller context, configure an Ollama model with `PARAMETER num_ctx 16384` as described in [Ollama's context configuration](https://docs.ollama.com/api/openai-compatibility#setting-the-context-size).

## Check

```sh
npm test -- tests/chunk-01.test.ts
npm run typecheck
npm run test:live -- tests/live/chunk-01.live.ts
```

`npm test` runs all offline tests. They use synthetic temporary folders, replace model access, and reject network requests. The separate live command explicitly enables Ollama access and tests the same two synthetic source files. It does not use personal documents.

## Current limits

- UTF-8 `.txt`, `.md`, `.markdown`, and `.csv`; CSV is read as text. PDFs, images, and structured spreadsheets arrive in later chunks.
- At most 200 inventory entries, 32 directory levels, and 64 KiB per readable file. Larger or unsupported inputs remain visible with a reason. Each tool read returns up to 4,000 UTF-16 characters and can continue at the next offset.
- At most 20 requested tool calls and five minutes per scan, including model loading. Reaching a limit reports incomplete work.
- Findings describe the snapshots read during this scan. Reference checks establish where quotations came from; they cannot establish whether every model interpretation is correct.
- No persistence, watcher, process lock, file organization, or generated artifacts yet. macOS is the supported initial platform.

See the [behavioral specification](specs/foldy-v1.md), [implementation chunks and evidence](specs/implementation.md), and [design decisions](specs/README.md). KISS governs the next chunk too.
