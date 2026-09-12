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

Status: complete; reportHash: 9b98cc0d8d279b34f59f495dd792592886510e2ef7696f4e9f7fa44762960785.


**F1 (7be0f68f-144f-4878-aef0-b6ef256af5b6)** Neri is the lighthouse keeper who is afraid of deep water; her courage means acting despite fear rather than losing that fear, and she solves problems with practical tools without magic.

Kind: observed. Uncertainty: none.

characters/keeper.md:2 (bbecb8919f05):
```text
Neri is the lighthouse keeper. She is afraid of deep water.
Her courage means acting despite fear, not losing that fear.
Constraint: no magic. She solves problems with practical tools.
```


Review: All required character facts are supported.

- **supported** F1: Neri is the lighthouse keeper, afraid of deep water; courage means acting despite fear. She uses practical tools without magic. — The quoted character lines explicitly state each trait and constraint. Coverage: character, constraint.

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

Status: complete; reportHash: 99095f88e40077ed1631539c909650bcf67cae9e21f64c4cadce83c63c53682c.


**F1 (7be0f68f-144f-4878-aef0-b6ef256af5b6)** Neri is the lighthouse keeper who is afraid of deep water; her courage means acting despite fear rather than losing that fear, and she solves problems with practical tools without magic.

Kind: observed. Uncertainty: none.

characters/keeper.md:2 (bbecb8919f05):
```text
Neri is the lighthouse keeper. She is afraid of deep water.
Her courage means acting despite fear, not losing that fear.
Constraint: no magic. She solves problems with practical tools.
```


**F2 (1b9dc181-62ee-4033-8008-c73a69fbc5b6)** other/pilot.md describes a different Neri character: a fearless starship pilot who uses telepathy in science fiction, explicitly stated as belonging to a different story from the lighthouse keeper.

Kind: observed. Uncertainty: none.

other/pilot.md:1 (3b771e70498b):
```text
# Unrelated science-fiction story
Neri is a fearless starship pilot who uses telepathy.
This belongs to a different story from the lighthouse keeper.
```


**F3 (2be6d672-efdb-411c-ac01-7c04d21e760f)** scenes/storm.txt describes a storm scene for the keeper's story where she stays on the quay and uses a rope to help a stranded sailor, keeping her fear of deep water visible with practical tool resolution.

Kind: observed. Uncertainty: none.

scenes/storm.txt:1 (113b108f2d26):
```text
Storm scene for the story about the keeper in the character notes.
The keeper stays on the quay and uses a rope to help a stranded sailor.
Keep her fear of deep water visible; the resolution must use practical tools.
```


**F4 (937547b8-5892-459b-8c13-7faf88d172d1)** scenes/storm.txt connects to the lighthouse keeper story by describing how she stays on the quay (not in deep water) and uses a rope to help a stranded sailor, keeping her fear of deep water visible while using practical tools for resolution.

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


Review: All outcomes are supported with complete joint citations. The separate scene summary repeats part of the joint finding; it is redundant but no longer under-cited.

- **supported** F1: Neri is the lighthouse keeper, afraid of deep water; courage means acting despite fear. She uses practical tools without magic. — The quoted character lines explicitly state each trait and constraint. Coverage: character, constraint.
- **supported** F2: The fearless telepathic starship pilot Neri belongs to a different science-fiction story. — The finding cites the pilot description and its explicit different-story statement. Coverage: other-story.
- **supported** F3: The storm outline describes the keeper staying on the quay and helping a sailor with a rope; it calls for visible fear and a practical resolution. — All scene details and intended constraints occur in the cited scene excerpt; no unsupported character name or lighthouse role is imported. Coverage: extra claim.
- **supported** F4: The storm outline connects to the lighthouse keeper notes through quay-and-rope action that preserves her fear and practical-tool constraints. — Both the scene and character excerpts are cited, including the explicit reference to the keeper notes, the quay and rope, fear, and no-magic/practical constraints. Staying on the quay supports the parenthetical not in deep water. Coverage: scene-link.
