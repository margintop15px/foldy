# PDF reader delivery check — 2026-09-12

The user asked to finish PDF parsing promptly and defer further attempts to make the full semantic gate green. This is one focused mixed-PDF check, not the 30-trial phase benchmark. The unsuccessful reasoning result is retained without retry.

## Commands and scope

Executed in `/Users/usuario/Projects/foldy`:

```sh
npm ci --ignore-scripts --offline --cache /tmp/foldy-phase03-npm-cache
npm test
npm run typecheck
git diff --check
caffeinate -i node /tmp/foldy-pdf-live-smoke.mjs > /tmp/foldy-pdf-live-smoke.log 2>&1
```

`driver.mjs` retains the exact temporary driver. It scans only a copy of the frozen `tests/fixtures/documents/mixed.pdf`, named `a.pdf`, using temporary state outside the source root. It sends no benchmark answers to Foldy. The driver uses a three-minute scan cap and checks input bytes after scanning. It attempts a cached scan only after completed reasoning. Temporary source/state directories were removed afterward.

The driver is a record of this run: its output directory and workspace import are absolute, and its output directory must not already exist. Use a new output directory for a new attempt; do not overwrite these results.

## Results

| Check | Observed result |
| --- | --- |
| Offline suite | 57/57 passed in 17.032 seconds; `offline-tests.log` retained |
| Typecheck / diff whitespace | Passed |
| PDF extraction and rendering | One helper job, one rendered page, 365 ms; one subsequent derived-page cache hit |
| Inspection coverage | Full text and visual coverage for page 1; 94 text characters, 1,200 × 1,520 pixel preview |
| Visual reading | Correctly read Monday 35 C, Tuesday 72 C, Wednesday 48 C from the raster chart |
| Source integrity | Driver's byte-for-byte assertion passed |
| Reasoning completion | **Failed/incomplete** after 162.645 seconds: model response-token limit reached; pending work retained |
| Tool validation | Two missing-PDF-page citation attempts rejected; later citations included page 1 |
| Completed live cache scan | **Not run** because reasoning was incomplete; zero-work cache behavior is covered by offline tests |

The extraction result and observed chart values work. This is not a passing end-to-end live smoke or a passing strict semantic trial. The three-minute scan deadline was not the failure: the individual model response reached its token limit.

## Independent evidence review

Codex inspected the retained exact preview and each final finding against its own references; the tested local model did not grade itself. This small development check has no independent human calibration.

| Finding ID | Review |
| --- | --- |
| `c2645663-9c3c-4f06-acd2-9fc87a802f39` | ST-204, the 60 C limit and daily peak temperatures are supported by its quoted text. The additional Mon/Tue/Wed labels occur only in the chart, but this finding cites text alone: incomplete supporting citation. |
| `dec2cd00-dd68-4cd9-926a-12889b3368bf` | The three day/value pairs match the cited page preview, which also identifies ST-204. Supported. |
| `c51baa57-408b-4dc1-9a48-de12cdda7a83` | The temperature comparison follows from the cited limit and chart. Its extra uncertainty about an “intended compliance assessment” has no source support. The whole finding does not meet the strict gate. |

No findings were removed to improve this result. Remaining citation precision, unnecessary uncertainty, response truncation and the full cross-file document benchmark are deferred quality work.

## Runtime and retained evidence

Node 24.19.0 on the M4 Pro / 24 GiB development machine; Pi 0.85.1; Ollama 0.34.0; `qwen3.5:9b` with vision and tools, context 16,384, requested low reasoning effort, temperature zero and a 2,048-token response cap. Model digest: `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`. Ollama reported 6,031,262,349 loaded bytes, not total process RSS.

Analysis revision 15; extractor revision 1; SQLite schema 3. Product document defaults remain 15 minutes / 80 tool calls; this driver shortened only the time cap to 180 seconds. The scan used seven model calls and seven tool calls, with 11,475 input tokens and 3,919 output tokens reported across agent responses. This is an end-to-end observation, not isolated inference throughput.

- `report.json`: complete scan report, source coverage, findings, errors and effective configuration.
- `tools.jsonl`: tool events with image payloads replaced by links to exact retained preview bytes.
- `preview-cc894044eb85216e350a5bb07e127c2b3f6cb4ab030f22454715c572e30112ec.png`: pixels actually sent to the model.
- `source.pdf`: original input; SHA-256 `7c66d99a79a8b5194f6cfd78622a043b5645d91d848f1acf9e577fafc3855a87`.
- `source-snapshot.json`: source/package contents used by this implementation.
- `driver.mjs`, `live.log`, `offline-tests.log`: execution provenance.

The full live regression and 90-scan benchmark were not run for this delivery. See [the implementation guide](../../../specs/implementation.md) for the implemented contracts and remaining phase gate.
