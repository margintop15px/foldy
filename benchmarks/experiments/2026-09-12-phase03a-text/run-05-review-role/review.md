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

Status: complete; reportHash: 97706a2721609a17089abf7e15a795730b99cc573b69238b0431bfede53f4d95.


**F1 (d8b1f142-62e5-42da-a287-254882b71c9b)** Neri is the lighthouse keeper who is afraid of deep water; her courage means acting despite fear rather than losing it; she solves problems with practical tools without magic.

Kind: observed. Uncertainty: none.

characters/keeper.md:2 (bbecb8919f05):
```text
Neri is the lighthouse keeper. She is afraid of deep water.
Her courage means acting despite fear, not losing that fear.
Constraint: no magic. She solves problems with practical tools.
```


Review: All final claims supported.

- **supported** F1: Neri is the keeper afraid of deep water, with courage defined as acting despite fear. — The cited passages support this statement and its scope. Coverage: character.
- **supported** F1: She solves problems with practical tools and no magic. — The cited passages support this statement and its scope. Coverage: constraint.

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

Status: complete; reportHash: d2cd7b3ce61f730d277ac5f10b541fb978c6792e30f53ebf5d2389849f21cb99.


**F1 (d8b1f142-62e5-42da-a287-254882b71c9b)** Neri is the lighthouse keeper who is afraid of deep water; her courage means acting despite fear rather than losing it; she solves problems with practical tools without magic.

Kind: observed. Uncertainty: none.

characters/keeper.md:2 (bbecb8919f05):
```text
Neri is the lighthouse keeper. She is afraid of deep water.
Her courage means acting despite fear, not losing that fear.
Constraint: no magic. She solves problems with practical tools.
```


**F2 (b1c52b1e-0336-400e-922e-8a0c450e1499)** other/pilot.md describes an unrelated science-fiction story where Neri is a fearless starship pilot who uses telepathy, explicitly stated to belong to a different story from the lighthouse keeper.

Kind: observed. Uncertainty: none.

other/pilot.md:1 (3b771e70498b):
```text
# Unrelated science-fiction story
Neri is a fearless starship pilot who uses telepathy.
This belongs to a different story from the lighthouse keeper.
```


**F3 (86b09b20-1bef-4c47-8380-8677395131fd)** scenes/storm.txt describes a storm scene for the lighthouse keeper story where she stays on the quay and uses a rope to help a stranded sailor, keeping her fear of deep water visible with practical tools (no magic).

Kind: observed. Uncertainty: none.

scenes/storm.txt:1 (113b108f2d26):
```text
Storm scene for the story about the keeper in the character notes.
The keeper stays on the quay and uses a rope to help a stranded sailor.
Keep her fear of deep water visible; the resolution must use practical tools.
```


**F4 (c9223ea9-523d-4450-bf3f-504e97811b1b)** scenes/storm.txt connects to characters/keeper.md by describing a specific storm scene for Neri's lighthouse keeper story, where she stays on the quay (avoiding deep water) and uses a rope with practical tools—consistent with her fear of deep water and no-magic constraint from keeper.md.

Kind: observed. Uncertainty: none.

scenes/storm.txt:1 (113b108f2d26):
```text
Storm scene for the story about the keeper in the character notes.
The keeper stays on the quay and uses a rope to help a stranded sailor.
Keep her fear of deep water visible; the resolution must use practical tools.
```

characters/keeper.md:2 (bbecb8919f05):
```text
Neri is the lighthouse keeper. She is afraid of deep water.
Her courage means acting despite fear, not losing that fear.
Constraint: no magic. She solves problems with practical tools.
```


Review: FAILED strict: a supported joint finding exists, but the redundant F3 retains uncited lighthouse/no-magic details. Required scene-link is now present.

- **supported** F1: Neri is the keeper afraid of deep water, with courage defined as acting despite fear. — The cited passages support this statement and its scope. Coverage: character.
- **supported** F1: She solves problems with practical tools and no magic. — The cited passages support this statement and its scope. Coverage: constraint.
- **supported** F2: An unrelated science-fiction story describes Neri as a fearless telepathic starship pilot, explicitly distinct from the keeper. — The cited passages support this statement and its scope. Coverage: other-story.
- **insufficient** F3: The single-source scene summary is about the lighthouse story and has a no-magic constraint. — The attached scene excerpt gives neither lighthouse identity nor no-magic constraint. Both are borrowed from uncited character notes. Re-recording the same incomplete evidence did not fix it. Coverage: extra claim.
- **supported** F3: The keeper stays on the quay and helps a stranded sailor with a rope, with visible fear and practical tools. — The cited passages support this statement and its scope. Coverage: extra claim.
- **supported** F4: The scene is linked to Neri's lighthouse story and its quay/rope action fits the fear-of-water and no-magic constraints. — The cited passages support this statement and its scope. Coverage: scene-link.
