# Diagnostic attempts before the full comparison

These targeted or interrupted runs informed the implementation. They were not pooled with the final three-trial comparison or substituted for its failures. Raw local runs remain under the ignored `benchmarks/runs/` directory; this summary preserves their observed limitations. The original baseline, six fixtures, oracles and semantic grading rules were not changed.

## 2026-09-12-quality-fix-pilot

[Local raw results](../../runs/2026-09-12-quality-fix-pilot/results.json).


Analysis revision 2, one trial of each unchanged case, 18 scans. The full source snapshot and every attempted output are retained. This experiment is not a passing benchmark and was not fully semantically graded.

Directly inspected failures:

- Q01/1/2 repeats the original project summary with both citations but still omits the newly requested room Birch.
- Q02/1/2 records a supported payment connection using the receipt copy. It omits the original/copy relationship and other statement entries; the frozen payment oracle also requires the original receipt's citation.
- Q04/1/2 describes the scene without recording the required connection to the earlier character notes with both sources.
- Q06/1/2 leaves the maintenance log partially read. The scan correctly remains pending; the following cache probe fails when it attempts inference with network denied. This is an incomplete reasoning failure, not a silent cache hit.

The next experiment adds one explicit completeness review in the same session and within the original budgets. No original fixture, oracle, or semantic scoring rule was changed.

## 2026-09-12-quality-review

[Local raw results](../../runs/2026-09-12-quality-review/results.json).


Analysis revision 3. Intended three-trial run was stopped after five completed scans because Q01/1/2 reproduced the missing room Birch outcome. Q02/1/2 also omitted the duplicate relationship and other statement entries. Every completed scan and its source snapshot remain here; this is an unfinished diagnostic experiment, not a comparable full score or a passing benchmark.

The additional review prompt produced no additional tool calls in the failed Q01 stage. The extra pass and its feature-specific test were removed. The next experiment enables the local model's advertised thinking capability instead of adding another loop. The first experiment explicitly disabled thinking with reasoning_effort=none; Ollama supports thinking control through its OpenAI-compatible endpoint: https://docs.ollama.com/api/openai-compatibility.

## 2026-09-12-thinking-timing

[Local raw results](../../runs/2026-09-12-thinking-timing/results.json).


Revision 4, one Q01 trial. All three execution/cache checks passed. Stage 1 took 25.952 seconds of scan work (26.402 wall); stage 2 took 75.219 seconds (76.019 wall). The cache took 8 ms of work (965 ms wall).

The cross-file finding reports room Birch with both original and update citations. Two invalid calls were safely rejected and recovered: a directory read and a citation before rereading the original in this session. One extra summary broadens Omar's seed-order role into management of the project, so this probe is not described as perfect semantic output. It was not fully scored.

This probe still used the SDK's unsupported max_completion_tokens field. Its configured output cap is historical intent, not the later corrected max_tokens request.

## 2026-09-12-thinking-comparison

[Local raw results](../../runs/2026-09-12-thinking-comparison/results.json).


Analysis revision 4. Stopped after eight completed scans, before completing the intended three-trial comparison. Individual reasoning scans took 28–96 seconds of scan work, below the five-minute limit. No completed scan had a timeout or structural failure.

Q01 now reports the room Birch request and cites both batches. Q03 reports the original/renewed expiry, current status and independent Beacon expiry. Q02 reports the copy, correct payment match/date difference and other currencies, but the payment finding cites the newly arrived receipt copy rather than the original source required by the frozen oracle. Its factual content is supported; this is an earlier-source provenance requirement, not a false transaction match.

The next revision explicitly requests that source when connecting to saved knowledge, even if a recent copy repeats its contents. It also labels inventory rows with readable: true/false to discourage directory reads that cost extra model turns. Full measurement restarts under the new revision; these partial results are not combined with it. The draft review-notes.mjs covers only the directly inspected Q01 outputs and is not a completed grade.

## 2026-09-12-original-citation

[Local raw results](../../runs/2026-09-12-original-citation/results.json).


Analysis revision 5, one Q02 trial. All three scans completed their structural checks and the cache probe passed. Stage 2 took 61.443 seconds of scan work (63.261 seconds including process startup), four model calls, five tool calls, and no tool errors.

The payment finding now cites the original receipt and bank statement, with the correct one-day purchase/posting difference. The duplicate finding cites both files. The other EUR/USD charges were omitted, so the full Q02 oracle still fails. This is not a passing semantic benchmark. The following revision tests one bounded completeness check with thinking enabled.

## 2026-09-12-completeness-probe

[Local raw results](../../runs/2026-09-12-completeness-probe/results.json).


Analysis revision 6, one Q02 trial. All execution/cache checks pass. The additional completeness turn records the other EUR/USD charges. The bank match again cites the recent copy instead of the original receipt required by the frozen oracle; it is factually supported but does not meet that provenance requirement. This probe is not a full semantic pass.

A subsequent request-level regression test found that the SDK selected max_completion_tokens, which Ollama 0.34.0's ChatCompletionRequest does not read. The claimed 2,048-token budget in this and earlier manifests was configured in the SDK but not enforced by that request field. The raw manifests remain unchanged as historical records. The next revision explicitly selects max_tokens and measures agent-turn token usage; it does not increase the five-minute wall-clock limit.

## 2026-09-12-token-budget

[Local raw results](../../runs/2026-09-12-token-budget/results.json).


Revision 7, one Q02 trial. All three execution/cache checks passed. Stage 1 took 39.472 seconds of scan work (39.895 wall), 1,036 output tokens and a largest response of 295 tokens. Stage 2 took 119.782 seconds (120.669 wall), 2,964 output tokens across responses, and a largest response of 906 tokens. Neither the actual 2,048-token response cap nor the five-minute scan deadline was reached. The cache took 12 ms of work (903 ms wall).

Required content is present, including the original receipt/bank citations, date difference, duplicate, and separate currencies. However, the payment finding adds an unsupported explanation about card processing; another finding asserts absent receipts while quoting only the bank statement. These remaining semantic gaps are retained, not treated as a clean pass. The full comparison uses the same reasoning revision with an additional aggregate counter confirming thinking responses.
