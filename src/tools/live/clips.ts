import { z } from "zod";
import { extensionTool } from "./extension-tool";
import { SetWording } from "../../mneme/set-diff";
import { ClipRefSchema, ClipSlotRefSchema, LoopSchema, NoteSchema, TakeLaneRefSchema, nameFields } from "./schemas";

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
    describe: ({ lane, name }, names) => `${names.takeLane(lane)} · rename to ${name}`,
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
    describe: ({ lane, start, length, notes, name }, names) =>
      `${names.takeLane(lane)} · new MIDI clip${name ? ` ${name}` : ""} in ${names.span(start, start + length)}${notes ? ` with ${SetWording.count(notes.length, "note")}` : ""}`,
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
    describe: ({ lane, start, name }, names) => `${names.takeLane(lane)} · new audio clip${name ? ` ${name}` : ""} at ${names.position(start)}`,
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
    describe: ({ slot, length, notes, name }, names) =>
      `${names.slot(slot)} · new MIDI clip${name ? ` ${name}` : ""}, ${names.length(length)}${notes ? ` with ${SetWording.count(notes.length, "note")}` : ""}`,
  }),
  extensionTool({
    op: "clip_slot_create_audio_clip",
    changes: "set",
    description: "Create an audio clip in an empty Session clip slot from a file imported with import_into_project.",
    input: { slot: ClipSlotRefSchema, filePath: z.string().min(1), warped: z.boolean().optional(), loop: LoopSchema.optional(), ...nameFields },
    describe: ({ slot, name }, names) => `${names.slot(slot)} · new audio clip${name ? ` ${name}` : ""}`,
  }),
  extensionTool({
    op: "clip_slot_delete_clip",
    changes: "set",
    description: "Delete the clip in a Session clip slot.",
    input: { slot: ClipSlotRefSchema },
    describe: ({ slot }, names) => `${names.clip(slot)} · delete`,
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
    describe: ({ clip, name, color, muted, looping }, names) => {
      const changes = [
        name === undefined ? "" : `rename to ${name}`,
        color === undefined ? "" : "colour",
        muted === undefined ? "" : muted ? "deactivate" : "activate",
        looping === undefined ? "" : looping ? "loop on" : "loop off",
      ].filter((change) => change.length > 0);
      return `${names.clip(clip)} · ${SetWording.list(changes) || "no change"}`;
    },
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
    describe: ({ clip, notes }, names) => `${names.clip(clip)} · write ${SetWording.count(notes.length, "note")}, replacing its notes`,
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
    describe: ({ clip, warping, warpMode }, names) => {
      const changes = [
        warping === undefined ? "" : warping ? "warping on" : "warping off",
        warpMode === undefined ? "" : `warp mode ${SetWording.warpMode(warpMode)}`,
      ].filter((change) => change.length > 0);
      return `${names.clip(clip)} · ${SetWording.list(changes) || "no change"}`;
    },
  }),
];
