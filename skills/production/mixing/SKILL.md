---
name: mixing
description: Balance and process the real tracks for the requested sound.
---

# Mixing

Read actual devices and mixer controls. Capture relevant processed routes through Max and assess audio_describe/audio_compare for a specific criterion. Use parameter_read_display and parameter_set_display for native units, inspecting returned units and automation state. Native controls set sound; an LLM assessment is not a meter. No automatic gain-matching, mastering or mixing engine exists.

Read `production/live-controls` for actual track/Compressor routing, return creation and native peak meters. Use real routing identifiers and current read tokens. Native meters remain in 0..1 units; do not convert them to dBFS or claim LUFS/true peak. Build processing with the SDK's actual instruments/effects. For inaccessible analyser readings or timed automation, open the relevant native device and give the musician a specific step, then continue from fresh observations.

Discover the named tools with `tool_search` using `names` and the appropriate group before calling them. Read only the references needed for the current task; the artist's current direction overrides stylistic advice.

- `references/craft.md`: optional detailed techniques and examples.

Optional sub-skills:
- `production/mixing/low-end`: Mix the low end in place in Live — decide whether the kick, the bass or the 808 owns the sub, tune the kick to the key, complementary EQ, ducking the bass or 808 under the kick, ph.
- `production/mixing/vocals`: Mix lead vocals, doubles, harmonies, backing vocals, ad-libs and rap vocals in place in Live — high-pass and corrective EQ, serial compression, de-essing with Live's devices, prese.
