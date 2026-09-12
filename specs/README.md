# Foldy

Status: chunks 01–02 are implemented. Phase 03 is in progress; its strict semantic quality gate is not yet complete. Chunks 04–09 remain unimplemented. Telegram T01–T02 are specified but unimplemented. See [setup and run commands](../README.md).

## Purpose

Foldy is a locally installed agent that watches one folder, understands its contents, connects information across files, and does useful work inside that folder. Folder names, file contents, and the user's corrections provide context. The model chooses the work and the sequence of tools; the application enforces permissions and preserves recoverability.

The first useful result is shared understanding: a receipt, statement entry, and booking confirmation can describe one expense and one trip even when they arrive in different folders, weeks apart.

## KISS is the governing rule

KISS is our philosophy, mantra, and default answer to implementation choices.

1. Build the smallest thing that satisfies the current chunk and its acceptance tests.
2. Use one foreground Foldy process, one folder, one active model, and one SQLite database per watched root. Ollama is the default; explicit OpenAI scans are available for development testing. The user can keep editing the folder in other applications.
3. Reuse Pi and standard-library capabilities before writing replacements. Add a dependency only for a concrete requirement in the current chunk.
4. Prefer plain functions and simple records. Introduce an abstraction when existing code demonstrates the need for it.
5. Keep source-backed findings in SQLite. Add retrieval infrastructure only after a reproducible limitation appears.
6. Finish and verify one chunk before expanding scope. A chunk must leave a runnable result and a clear handoff.
7. Put future ideas in deferred work. Do not scaffold them into the current implementation.
8. Preserve checks that prevent data loss, unauthorized access, and misleading results. KISS does not excuse an unsafe shortcut.

For a proposed addition, ask: which current requirement or failing test needs this? If neither does, defer it. Record a deliberate limitation beside the affected implementation when it has a real consequence; explain the condition that would justify changing it.

## Read and execute

- [Behavioral specification](foldy-v1.md): authoritative v1 behavior, boundaries, interfaces, and acceptance scenarios.
- [Messaging specification — Telegram first](telegram-v1.md): CopilotKit Channels foundation, personal-chat results, generated attachments, clarification choices, feedback, settings, and acceptance scenarios.
- [Implementation chunks](implementation.md): ordered, independently verifiable work with run commands and completion evidence.
- [Output quality evaluation](quality-evaluation.md): text/document benchmarks, strict scoring rules, and historical baselines; phase 03 requires 30 trials / 90 scans with every required outcome and every reviewed claim supported.

Here, **executable specification** means an engineer or agent can implement a chunk and check its result against explicit scenarios. Markdown is the source of intent. The implementation supplies the runnable commands and tests; there is no custom specification parser or test DSL.

Behavioral requirements take precedence over implementation suggestions. A change to product behavior must update the relevant requirement and acceptance scenario together. A test may not be weakened merely to make an implementation pass.

## Accepted decisions

| Decision | Choice |
| --- | --- |
| First user and platform | One user on macOS; initial evaluation on an M4 Pro with 24 GB memory |
| First release | Folder intelligence, cross-file context, persistent corrections, reversible organization, and simple generated files |
| Input formats | Text/Markdown, CSV/TSV, Excel `.xlsx`, text and scanned PDFs, PNG/JPEG images |
| Interaction | Terminal commands and a foreground watcher; CopilotKit Channels handles messaging, with one paired private Telegram user chat per root initially |
| Messaging foundation | CopilotKit Channels, its direct Telegram adapter, CopilotRuntime, and the required Intelligence service connection; pin compatible packages when T01 is implemented |
| Later messengers | Add provider integrations through the same Channels boundary and Foldy operations after Telegram; only Telegram is registered initially |
| Messaging data | Pi/Ollama inference and authoritative state remain local. Required Intelligence coordination and user-facing messaging/UI data are allowed; optional remote Memory/transcript export is disabled |
| Autonomy | Automatically organize and create within the selected folder; Telegram does not expose apply/undo or expand file authority. Overwrites, deletions, and other external actions remain outside automatic authority |
| Telegram content | Useful result messages and questions; generated files delivered as attachments after verified creation. Original source attachments stay local; internal IDs and diagnostics stay out of chat |
| Telegram feedback | Native single-select clarification choices and custom replies; contextual feedback becomes a targeted persistent correction |
| Telegram settings | Pause/resume, All / Needs attention / Silent notification sound, connection status, and disconnect. Muting sound preserves message and attachment delivery |
| Telegram delivery order | T01 after chunk 06 for chat and shared clarification; T02 after chunk 08 for safe generated-file delivery. First deliverable is specifications only |
| Foundation | TypeScript, Node.js 24, Pi SDK, Ollama, Chokidar, SQLite |
| Initial model | Local `qwen3.5:9b` as the vision-capable baseline; validate quality and record effective context settings on the target machine |
| Model candidate | Evaluate MiniCPM5-2B for text reasoning and tool use; its text-only checkpoint cannot satisfy v1's image requirements alone |
| Learning in v1 | Persistent findings and explicit user corrections; broader inferred preferences remain tentative |
| Generated code | Deferred; v1 does not execute model-authored scripts or extensions |

### MiniCPM5-2B evaluation

The [MiniCPM5-2B model card](https://huggingface.co/openbmb/MiniCPM5-2B) describes a compact text language model with tool use, a 131,072-token native context, and GGUF/MLX releases. It recommends SGLang's `minicpm5` parser for its XML-style tool calls. These are upstream capabilities; local compatibility results are recorded below.

The chunk 01 experiment loaded its official Q4_K_M GGUF through Ollama 0.34.0, but the first tool-bearing request failed with `Failed to initialize samplers: failed to parse grammar`. No findings were produced. Qwen passed the same check; it remains the baseline. See [chunk 01 evidence](implementation.md#01--read-a-folder) for timing and memory measurements.

Keep one model per run. A text-only candidate is eligible for text experiments; complete v1 acceptance still requires visual understanding. A second model or a new inference backend needs demonstrated benefit before expanding the architecture.

## Progress

Commands for chunks 01–03 are runnable. Later commands remain target interfaces until their owning chunk is implemented.

| Chunk | Outcome | Status |
| --- | --- | --- |
| 01 | Read a folder | Complete; offline checks and live Qwen check pass |
| 02 | Remember and connect | Complete; persistence, offline checks, and live cross-session Qwen check pass |
| 03 | Understand images and PDFs | Reader implemented; broader semantic quality gate deferred at user request |
| 04 | Read spreadsheets | Not started |
| 05 | React to changes | Not started |
| 06 | Explain and accept corrections | Not started |
| T01 | CopilotKit foundation and Telegram conversation | Specified; not started; follows 06 |
| 07 | Preview useful actions | Not started |
| 08 | Apply and undo safely | Not started |
| T02 | Telegram generated attachments | Specified; not started; requires T01 and 08 |
| 09 | Enable bounded autonomy | Not started |

Messaging is optional: core operation continues without integration credentials or pairing. T01 and T02 have their own offline and explicitly enabled live-bot evidence gates, including CopilotKit lifecycle, persistence, proactive delivery, and service-data checks. Their planned commands are not available in the current scanner.

## Deferred work

The longer-term direction remains an agent that improves through reusable skills and small tools while a stable application core enforces its authority. After Telegram, further messenger integrations use CopilotKit Channels with separate provider requirements and verification; those adapters are not enabled in T01/T02. Later work may also add sandboxed generated scripts, creation of expense workbooks and charts, meme composition or image generation, expiry reminders and calendar integration, richer retrieval, and desktop packaging. Reading supported spreadsheet files is already part of v1.

These are examples of capabilities, not predefined workflows for the model. Each needs its own small specification and acceptance evidence before implementation. Model-weight training and automatic modification of the permission-enforcement core are not part of v1.

## Research references

References checked during the design discussion on 2026-09-11. Pin dependency versions when first introduced and include the lockfile; do not treat an upstream `latest` page as a frozen API contract.

- [Pi SDK](https://pi.dev/docs/latest/sdk): embedding, explicit tools, sessions, and context management.
- [Pi security](https://pi.dev/docs/latest/security): Pi does not provide a built-in sandbox; resource loading and execution authority require explicit treatment.
- [Pi local model configuration](https://pi.dev/docs/latest/models).
- [Ollama Qwen3.5](https://ollama.com/library/qwen3.5) and [local-only operation](https://docs.ollama.com/faq).
- [MiniCPM5-2B](https://huggingface.co/openbmb/MiniCPM5-2B): candidate model, deployment formats, and tool-call parser requirements.
- [ExcelJS](https://github.com/exceljs/exceljs): local `.xlsx` and delimited-text reading, with stored formula results rather than formula recalculation.
- [Chokidar](https://github.com/paulmillr/chokidar): watching, atomic saves, and write-settling behavior.
- [SQLite full-text search](https://www.sqlite.org/fts5.html).
- [CopilotKit Channels direct adapters](https://docs.copilotkit.ai/reference/channels/sdk/direct-adapters): chosen on 2026-09-12 for Telegram first and later messengers; the Intelligence lifecycle dependency also applies to direct adapters.
- [Hermes](https://docs.ollama.com/integrations/hermes) and [Goose](https://goose-docs.ai/): considered alternatives; v1 uses Pi.
