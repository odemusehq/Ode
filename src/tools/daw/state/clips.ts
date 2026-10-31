import { extensionTool } from "../extension-tool";

import { ClipRefSchema, ClipSlotRefSchema, TakeLaneRefSchema } from "../schemas";

export const takeLaneTools = [
  extensionTool({
    op: "take_lane_get",
    description: "Read a take lane: its name and clips.",
    input: { lane: TakeLaneRefSchema },
  })
];

export const clipSlotTools = [
  extensionTool({
    op: "clip_slot_get",
    description: "Read a Session View clip slot and the clip in it, if any.",
    input: { slot: ClipSlotRefSchema },
  })
];

export const clipTools = [
  extensionTool({
    op: "clip_get",
    description: "Read a clip: name, colour, mute, position, start and end markers, loop settings.",
    input: { clip: ClipRefSchema },
  }),
  extensionTool({
    op: "midi_clip_get_notes",
    alwaysLoad: true,
    description: "Read the supported performance fields of every MIDI note in a clip and its recoveryToken: pitch, start/duration in beats from clip start, velocity, mute, probability, velocity deviation and release velocity. For a later replacement pass this actual recoveryToken as midi_clip_set_notes.expected.token. The token binds this native clip and its observed note state in this extension lifetime; expired tokens require a fresh read. This is not a history of intermediate edits or unavailable MPE/automation.",
    input: { clip: ClipRefSchema },
  }),
  extensionTool({
    op: "audio_clip_get",
    description: "Read an audio clip: file path, warping, warp mode and warp markers, plus the clip settings.",
    input: { clip: ClipRefSchema },
  })
];
