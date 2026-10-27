import { z } from "zod";
import { extensionTool } from "./extension-tool";
import { ClipRefSchema, ClipSlotRefSchema, LoopSchema, NoteSchema, TakeLaneRefSchema, clipLabel, nameFields, trackLabel } from "./schemas";

/** Live's warp modes, as the SDK numbers them. */
export enum WarpMode {
  Beats = 0,
  Tones = 1,
  Texture = 2,
  Repitch = 3,
  Complex = 4,
  ComplexPro = 6,
}

export const takeLaneTools = [
  extensionTool({
    op: "take_lane_get",
    description: "Read a take lane: its name and clips.",
    input: { lane: TakeLaneRefSchema },
  }),
  extensionTool({
    op: "take_lane_rename",
    changes: "set",
    description: "Rename a take lane.",
    input: { lane: TakeLaneRefSchema, name: z.string().min(1) },
    describe: ({ lane, name }) => `Rename take lane ${lane.lane + 1} of ${trackLabel(lane.track)} to "${name}".`,
  }),
  extensionTool({
    op: "take_lane_create_midi_clip",
    changes: "set",
    description: "Create a MIDI clip on a take lane at an Arrangement beat, optionally with notes (beats from the clip start).",
    input: {
      lane: TakeLaneRefSchema,
      start: z.number().min(0),
      length: z.number().positive(),
      notes: z.array(NoteSchema).optional(),
      ...nameFields,
    },
    describe: ({ lane, start }) => `Create a MIDI clip on take lane ${lane.lane + 1} of ${trackLabel(lane.track)} at beat ${start}.`,
  }),
  extensionTool({
    op: "take_lane_create_audio_clip",
    changes: "set",
    description: "Create an audio clip on a take lane from a file imported with import_into_project.",
    input: {
      lane: TakeLaneRefSchema,
      filePath: z.string().min(1),
      start: z.number().min(0),
      length: z.number().positive().optional(),
      warped: z.boolean().optional(),
      loop: LoopSchema.optional(),
      ...nameFields,
    },
    describe: ({ lane, start }) => `Place an audio clip on take lane ${lane.lane + 1} of ${trackLabel(lane.track)} at beat ${start}.`,
  }),
];

export const clipSlotTools = [
  extensionTool({
    op: "clip_slot_get",
    description: "Read a Session View clip slot and the clip in it, if any.",
    input: { slot: ClipSlotRefSchema },
  }),
  extensionTool({
    op: "clip_slot_create_midi_clip",
    changes: "set",
    description: "Create a MIDI clip in an empty Session clip slot, optionally with notes (beats from the clip start).",
    input: { slot: ClipSlotRefSchema, length: z.number().positive(), notes: z.array(NoteSchema).optional(), ...nameFields },
    describe: ({ slot, length }) => `Create a ${length}-beat MIDI clip in slot ${slot.slot + 1} of ${trackLabel(slot.track)}.`,
  }),
  extensionTool({
    op: "clip_slot_create_audio_clip",
    changes: "set",
    description: "Create an audio clip in an empty Session clip slot from a file imported with import_into_project.",
    input: { slot: ClipSlotRefSchema, filePath: z.string().min(1), warped: z.boolean().optional(), loop: LoopSchema.optional(), ...nameFields },
    describe: ({ slot }) => `Place an audio clip in slot ${slot.slot + 1} of ${trackLabel(slot.track)}.`,
  }),
  extensionTool({
    op: "clip_slot_delete_clip",
    changes: "set",
    description: "Delete the clip in a Session clip slot.",
    input: { slot: ClipSlotRefSchema },
    describe: ({ slot }) => `Delete the clip in slot ${slot.slot + 1} of ${trackLabel(slot.track)}.`,
  }),
];

export const clipTools = [
  extensionTool({
    op: "clip_get",
    description: "Read a clip: name, colour, mute, position, start and end markers, loop settings.",
    input: { clip: ClipRefSchema },
  }),
  extensionTool({
    op: "clip_set",
    changes: "set",
    description: "Change a clip's name, colour (RGB integer), mute or loop on/off. Only the fields you give change.",
    input: {
      clip: ClipRefSchema,
      name: z.string().min(1).optional(),
      color: z.number().int().min(0).max(0xffffff).optional(),
      muted: z.boolean().optional(),
      looping: z.boolean().optional(),
    },
    describe: ({ clip }) => `Change ${clipLabel(clip)}.`,
  }),
  extensionTool({
    op: "midi_clip_get_notes",
    alwaysLoad: true,
    description: "Read every note in a MIDI clip (pitch, start and duration in beats from the clip start, velocity, mute, probability).",
    input: { clip: ClipRefSchema },
  }),
  extensionTool({
    op: "midi_clip_set_notes",
    changes: "set",
    description: "Replace all notes in a MIDI clip with the given notes (beats from the clip start). Read the notes first if you only want to change some.",
    input: { clip: ClipRefSchema, notes: z.array(NoteSchema) },
    describe: ({ clip, notes }) => `Write ${notes.length} notes into ${clipLabel(clip)}, replacing its notes.`,
  }),
  extensionTool({
    op: "audio_clip_get",
    description: "Read an audio clip: file path, warping, warp mode and warp markers, plus the clip settings.",
    input: { clip: ClipRefSchema },
  }),
  extensionTool({
    op: "audio_clip_set",
    changes: "set",
    description: "Turn warping on or off for an audio clip, or change its warp mode (0 Beats, 1 Tones, 2 Texture, 3 Re-Pitch, 4 Complex, 6 Complex Pro).",
    input: {
      clip: ClipRefSchema,
      warping: z.boolean().optional(),
      warpMode: z.enum(WarpMode).optional(),
    },
    describe: ({ clip }) => `Change warping of ${clipLabel(clip)}.`,
  }),
];
