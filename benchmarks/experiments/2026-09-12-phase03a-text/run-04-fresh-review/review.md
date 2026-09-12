# Evidence review

Review the claim AND its uncertainty against cited evidence. Split compound claims, merge equivalent claims (list all finding numbers), and cover every finding. Labels: supported / contradicted / insufficient. An exact quote alone earns no semantic credit. Refer to the oracle; supported extra facts are allowed. Mark wrong dates/amounts/entities and invented approvals as critical. A relationship needs supporting linking evidence. Grade usefulness 0–2; explain each missed outcome and every negative label.

The JSON review is bound to resultsHash and per-stage reportHash. `findings` uses one-based numbers from the matching report. `covers` names only requirements fully satisfied with their required sources. Use separate atomic claims for independently true/false parts. Do not auto-label based on keywords. Assistant review must identify itself and remains provisional for human calibration.

## Q04 — Creative context without shared IDs

Forbidden: Make the lighthouse keeper a fearless swimmer or magical character. Merge the sci-fi pilot with the lighthouse keeper.

### Stage 1 oracle

- character (fact): Neri is a lighthouse keeper afraid of deep water; her courage is acting despite fear. Sources: characters/keeper.md.
- constraint (fact): The lighthouse story has no magic; Neri solves problems with practical tools. Sources: characters/keeper.md.

#### characters/keeper.md

```text
# The lighthouse story
Neri is the lighthouse keeper. She is afraid of deep water.
Her courage means acting despite fear, not losing that fear.
Constraint: no magic. She solves problems with practical tools.

```

### Q04/1/1

Status: complete; reportHash: 289531e43bbbdb6765515fa6616a7c1611d6706e0a98ca82924b7cc7a746ed8c.


**F1 (b1c7216b-a9b4-472f-9065-796891f294c9)** Neri is the lighthouse keeper who is afraid of deep water; her courage means acting despite fear, not losing that fear; she solves problems with practical tools under a no-magic constraint.

Kind: observed. Uncertainty: none.

characters/keeper.md:2 (bbecb8919f05):
```text
Neri is the lighthouse keeper. She is afraid of deep water.
Her courage means acting despite fear, not losing that fear.
Constraint: no magic. She solves problems with practical tools.
```


Review: All required facts and all final claims supported.

- **supported** F1: Neri is the lighthouse keeper, afraid of deep water, with courage as acting despite fear. — The cited passages explicitly support this statement. Coverage: character.
- **supported** F1: She uses practical tools under a no-magic constraint. — The cited passages explicitly support this statement. Coverage: constraint.

### Stage 2 oracle

- character (fact): Neri is a lighthouse keeper afraid of deep water; her courage is acting despite fear. Sources: characters/keeper.md.
- constraint (fact): The lighthouse story has no magic; Neri solves problems with practical tools. Sources: characters/keeper.md.
- scene-link (relationship): The storm outline explicitly refers to the keeper's character notes and respects her fear/no-magic constraints through quay-and-rope action. Sources: characters/keeper.md, scenes/storm.txt.
- other-story (fact): The fearless, telepathic pilot is Neri in a separate science-fiction story. Sources: other/pilot.md.

#### characters/keeper.md

```text
# The lighthouse story
Neri is the lighthouse keeper. She is afraid of deep water.
Her courage means acting despite fear, not losing that fear.
Constraint: no magic. She solves problems with practical tools.

```

#### scenes/storm.txt

```text
Storm scene for the story about the keeper in the character notes.
The keeper stays on the quay and uses a rope to help a stranded sailor.
Keep her fear of deep water visible; the resolution must use practical tools.

```

#### other/pilot.md

```text
# Unrelated science-fiction story
Neri is a fearless starship pilot who uses telepathy.
This belongs to a different story from the lighthouse keeper.

```

### Q04/1/2

Status: complete; reportHash: 091d19121c458e85de331804ef23c7c81010985a644a5f7814e93038fb4a930f.


**F1 (b1c7216b-a9b4-472f-9065-796891f294c9)** Neri is the lighthouse keeper who is afraid of deep water; her courage means acting despite fear, not losing that fear; she solves problems with practical tools under a no-magic constraint.

Kind: observed. Uncertainty: none.

characters/keeper.md:2 (bbecb8919f05):
```text
Neri is the lighthouse keeper. She is afraid of deep water.
Her courage means acting despite fear, not losing that fear.
Constraint: no magic. She solves problems with practical tools.
```


**F2 (a5762148-2a6c-4cde-a921-e64b6565beae)** The file other/pilot.md describes an unrelated science-fiction story where Neri is a fearless starship pilot who uses telepathy, explicitly stated as belonging to a different story from the lighthouse keeper.

Kind: observed. Uncertainty: none.

other/pilot.md:1 (3b771e70498b):
```text
# Unrelated science-fiction story
Neri is a fearless starship pilot who uses telepathy.
This belongs to a different story from the lighthouse keeper.
```


**F3 (2997bd97-4eb9-42af-b95e-07c45bd9777e)** The storm scene in scenes/storm.txt is for the lighthouse keeper story, where Neri stays on the quay and uses a rope to help a stranded sailor while keeping her fear of deep water visible; resolution must use practical tools.

Kind: observed. Uncertainty: none.

scenes/storm.txt:1 (113b108f2d26):
```text
Storm scene for the story about the keeper in the character notes.
The keeper stays on the quay and uses a rope to help a stranded sailor.
Keep her fear of deep water visible; the resolution must use practical tools.
```


Review: FAILED: F3 attributes Neri and lighthouse from uncited character information. The reviewer reread all three sources but did not repair or jointly cite this finding.

- **supported** F1: Neri is the lighthouse keeper, afraid of deep water, with courage as acting despite fear. — The cited passages explicitly support this statement. Coverage: character.
- **supported** F1: She uses practical tools under a no-magic constraint. — The cited passages explicitly support this statement. Coverage: constraint.
- **supported** F2: A separate science-fiction story describes Neri as a fearless telepathic starship pilot. — The cited passages explicitly support this statement. Coverage: other-story.
- **insufficient** F3: The storm scene belongs to the lighthouse keeper story and its keeper is Neri. — The sole scene quotation names neither Neri nor lighthouse. The character source is missing from this finding; no joint finding establishes the required scene-link outcome. Coverage: extra claim.
- **supported** F3: The keeper stays on the quay and helps a stranded sailor with a rope, while fear remains visible and practical tools are required. — The cited passages explicitly support this statement. Coverage: extra claim.
