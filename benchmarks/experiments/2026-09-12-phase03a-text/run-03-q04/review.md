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

Status: complete; reportHash: f653398f2ca16e95574a25c96b36e3e5a3a49def476965010d8850e516b80e15.


**F1 (60e370be-7f3e-4628-8991-0a3dc6a9ceca)** Neri is the lighthouse keeper who is afraid of deep water; her courage means acting despite fear rather than losing it; she operates under a constraint of no magic and solves problems with practical tools.

Kind: observed. Uncertainty: none.

characters/keeper.md:2 (bbecb8919f05):
```text
Neri is the lighthouse keeper. She is afraid of deep water.
Her courage means acting despite fear, not losing that fear.
Constraint: no magic. She solves problems with practical tools.
```


Review: All final claims supported.

- **supported** F1: Neri is the keeper afraid of deep water, with courage as acting despite fear. — The cited passages explicitly support the statement. Coverage: character.
- **supported** F1: She uses practical tools under the no-magic constraint. — The cited passages explicitly support the statement. Coverage: constraint.

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

Status: complete; reportHash: c5395e6925814d80b6a3dfbd3fd9996cc63abf14889ffcdd8b13ab1163e8a63a.


**F1 (60e370be-7f3e-4628-8991-0a3dc6a9ceca)** Neri is the lighthouse keeper who is afraid of deep water; her courage means acting despite fear rather than losing it; she operates under a constraint of no magic and solves problems with practical tools.

Kind: observed. Uncertainty: none.

characters/keeper.md:2 (bbecb8919f05):
```text
Neri is the lighthouse keeper. She is afraid of deep water.
Her courage means acting despite fear, not losing that fear.
Constraint: no magic. She solves problems with practical tools.
```


**F2 (a6b0207d-bef8-433b-bd2e-f178c32e3d5a)** Neri is a starship pilot in an unrelated science-fiction story who uses telepathy; this belongs to a different story from the lighthouse keeper.

Kind: observed. Uncertainty: none.

other/pilot.md:1 (3b771e70498b):
```text
# Unrelated science-fiction story
Neri is a fearless starship pilot who uses telepathy.
This belongs to a different story from the lighthouse keeper.
```


**F3 (f9c970c2-47ab-41ca-b6a9-97ff44ce9ad6)** The storm scene for the lighthouse keeper story shows the keeper staying on the quay and using a rope to help a stranded sailor; her fear of deep water must remain visible and resolution uses practical tools.

Kind: observed. Uncertainty: none.

scenes/storm.txt:1 (113b108f2d26):
```text
Storm scene for the story about the keeper in the character notes.
The keeper stays on the quay and uses a rope to help a stranded sailor.
Keep her fear of deep water visible; the resolution must use practical tools.
```


**F4 (f4f0c9e1-2296-47ce-ba53-8a809bb07658)** The storm scene (scenes/storm.txt) is for the same lighthouse keeper story described in characters/keeper.md, confirming Neri's fear of deep water and no-magic constraint while adding specific scene details about helping a stranded sailor with a rope from the quay.

Kind: observed. Uncertainty: none.

scenes/storm.txt:1 (113b108f2d26):
```text
Storm scene for the story about the keeper in the character notes.
The keeper stays on the quay and uses a rope to help a stranded sailor.
Keep her fear of deep water visible; the resolution must use practical tools.
```

characters/keeper.md:1 (bbecb8919f05):
```text
# The lighthouse story
Neri is the lighthouse keeper. She is afraid of deep water.
Her courage means acting despite fear, not losing that fear.
Constraint: no magic. She solves problems with practical tools.
```


Review: FAILED: F3 has an uncited lighthouse attribution. Also the pilot finding omits the required fearless characterization; citing the word does not report it.

- **supported** F1: Neri is the keeper afraid of deep water, with courage as acting despite fear. — The cited passages explicitly support the statement. Coverage: character.
- **supported** F1: She uses practical tools under the no-magic constraint. — The cited passages explicitly support the statement. Coverage: constraint.
- **supported** F2: A separate science-fiction story has Neri as a telepathic starship pilot, distinct from the keeper. — The cited passages explicitly support the statement. Coverage: extra claim.
- **insufficient** F3: The storm scene belongs to the lighthouse keeper story. — Only storm.txt is cited, which says keeper in character notes but never lighthouse. The separate F4 does not supply evidence for F3. Coverage: extra claim.
- **supported** F3: The scene keeps the keeper on the quay, helping a stranded sailor with a rope, preserving visible fear and practical tools. — The cited passages explicitly support the statement. Coverage: extra claim.
- **supported** F4: The storm scene is linked to the character notes, fits the fear/no-magic constraints, and adds the quay/rope rescue. — Both complete scene and character passages are cited together, supporting the concrete new action and its fit. Coverage: scene-link.
