# Evidence review

Review the claim AND its uncertainty against cited evidence. Split compound claims, merge equivalent claims (list all finding numbers), and cover every finding. Labels: supported / contradicted / insufficient. An exact quote alone earns no semantic credit. Refer to the oracle; supported extra facts are allowed. Mark wrong dates/amounts/entities and invented approvals as critical. A relationship needs supporting linking evidence. Grade usefulness 0–2; explain each missed outcome and every negative label.

The JSON review is bound to resultsHash and per-stage reportHash. `findings` uses one-based numbers from the matching report. `covers` names only requirements fully satisfied with their required sources. Use separate atomic claims for independently true/false parts. Do not auto-label based on keywords. Assistant review must identify itself and remains provisional for human calibration.

## Q05 — Conflicting deadlines

Forbidden: Choose one deadline as authoritative without evidence. Infer priority from filename, arrival order or modification time.

### Stage 1 oracle

- proposal (fact): Engineering proposes 2026-11-09 for OR-517; it is not a final decision. Sources: notes/engineering.txt.

#### notes/engineering.txt

```text
Orchard release OR-517, engineering note.
Proposed launch deadline: 2026-11-09.
This is a proposal, not a final decision.

```

### Q05/1/1

Status: complete; reportHash: 70f6cf425e4e5f5aca8d711f78d4ad7432e8eab42497f92f12a0191af6d14837.


**F1 (0349a7db-b42d-494e-b208-18619f795156)** Orchard release OR-517 is proposed with a launch deadline of 2026-11-09, but this remains a proposal and not yet a final decision.

Kind: observed. Uncertainty: none.

notes/engineering.txt:1 (3d7b4acbd873):
```text
Orchard release OR-517, engineering note.
Proposed launch deadline: 2026-11-09.
This is a proposal, not a final decision.
```


Review: All of the single finding is supported. No citation errors.

- **supported** F1: Engineering proposes 2026-11-09 for Orchard OR-517; the date is not final. — The exact engineering quotation supplies the release, proposed date and non-final status. Coverage: proposal.

### Stage 2 oracle

- conflict (uncertainty): OR-517 has unresolved proposals of 2026-11-09 and 2026-11-16; the final date is unknown. Cite both, choose neither. Sources: notes/engineering.txt, notes/marketing-latest.txt.

#### notes/engineering.txt

```text
Orchard release OR-517, engineering note.
Proposed launch deadline: 2026-11-09.
This is a proposal, not a final decision.

```

#### notes/marketing-latest.txt

```text
Orchard release OR-517, marketing note.
Proposed launch deadline: 2026-11-16.
This is a proposal, not a final decision. Neither department has decision authority.

```

### Q05/1/2

Status: complete; reportHash: 768bac951693ffa2ebf6de12af4b368651b424b9b25b64f60f61e3c4dabb650a.


**F1 (0349a7db-b42d-494e-b208-18619f795156)** Orchard release OR-517 is proposed with a launch deadline of 2026-11-09, but this remains a proposal and not yet a final decision.

Kind: observed. Uncertainty: none.

notes/engineering.txt:1 (3d7b4acbd873):
```text
Orchard release OR-517, engineering note.
Proposed launch deadline: 2026-11-09.
This is a proposal, not a final decision.
```


**F2 (3a3a2933-5e71-499a-9380-ba2784988378)** Orchard release OR-517 is proposed with two different launch deadlines: engineering proposes 2026-11-09 while marketing proposes 2026-11-16. Both documents state these are proposals, not final decisions, and neither department has decision authority.

Kind: observed. Uncertainty: none.

notes/marketing-latest.txt:1 (e67786686321):
```text
Orchard release OR-517, marketing note.
Proposed launch deadline: 2026-11-16.
This is a proposal, not a final decision. Neither department has decision authority.
```

notes/engineering.txt:1 (3d7b4acbd873):
```text
Orchard release OR-517, engineering note.
Proposed launch deadline: 2026-11-09.
This is a proposal, not a final decision.
```


Review: Both findings and all quoted sources were manually checked. Original evidence was reread before recording the joint finding. No deadline was selected and no citation was rejected.

- **supported** F1,F2: Engineering proposes 2026-11-09 for Orchard OR-517, with no final decision. — Both occurrences cite the full original engineering note. Coverage: extra claim.
- **supported** F2: Marketing proposes 2026-11-16 for Orchard OR-517, with no final decision. — The full marketing note is quoted in the joint finding. Coverage: extra claim.
- **supported** F2: Neither department has decision authority. — Marketing states this explicitly; the joint finding does not assign authority. Coverage: extra claim.
- **supported** F2: The two different dates remain unresolved proposals for the same release. — One finding cites both shared-identifier notes, preserves both dates as proposals and chooses neither. Coverage: conflict.
