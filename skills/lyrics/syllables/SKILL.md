---
name: syllables
description: Review sung syllables and intended word-to-note fit.
---

# Syllables

Ask lyricist with the exact text, pronunciation and relevant melody coordinates. Counts, stress and delivery come from that configured model, not a local dictionary. Counts do not establish phrasing. Ask for the chosen word/syllable-to-note mapping, lexical and semantic stress, articulation time and breath gaps at the actual tempo. Melisma, pickups, elision and unequal counts can be intentional. Forward a needed reference through `lyricist.references`; it is not automatically included.

Use the tool schemas exposed by the SDK; discover missing schemas with `ToolSearch` when available. Read only the references needed for the current task; the artist's current direction overrides stylistic advice.

- `references/craft.md`: optional detailed techniques and examples.
