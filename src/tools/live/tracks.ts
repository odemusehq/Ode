import { z } from "zod";
import { extensionTool } from "./extension-tool";
import { ArrangementClipRefSchema, DeviceRefSchema, LoopSchema, NoteSchema, TrackRefSchema, deviceLabel, nameFields, trackLabel } from "./schemas";

export const trackTools = [
  extensionTool({
    op: "track_get",
    alwaysLoad: true,
    description:
      "Read one track: name, kind (MIDI, audio, group, return, Main), mute, solo, arm, devices, Session clip slots with their clips, Arrangement clips, take lanes, and its group track.",
    input: { track: TrackRefSchema },
  }),
  extensionTool({
    op: "track_set",
    changes: "set",
    description: "Change a track's name, mute, solo or arm state. Only the fields you give change.",
    input: {
      track: TrackRefSchema,
      name: z.string().min(1).optional(),
      mute: z.boolean().optional(),
      solo: z.boolean().optional(),
      arm: z.boolean().optional().describe("Arm the track for recording"),
    },
    describe: ({ track, ...changes }) =>
      `Change ${trackLabel(track)}: ${Object.entries(changes)
        .map(([key, value]) => `${key} → ${String(value)}`)
        .join(", ")}.`,
  }),
  extensionTool({
    op: "track_create_midi_clip",
    changes: "set",
    description:
      "Create a MIDI clip in the Arrangement on a MIDI track, optionally with notes (note times are beats from the clip start). Returns the clip's reference.",
    input: {
      track: TrackRefSchema,
      start: z.number().min(0).describe("Arrangement position in beats"),
      length: z.number().positive().describe("Length in beats"),
      notes: z.array(NoteSchema).optional(),
      ...nameFields,
    },
    describe: ({ track, start, length, notes, name }) =>
      `Create a MIDI clip${name ? ` "${name}"` : ""} on ${trackLabel(track)} at beat ${start}, ${length} beats long${notes ? ` with ${notes.length} notes` : ""}.`,
  }),
  extensionTool({
    op: "track_create_audio_clip",
    changes: "set",
    description:
      "Create an audio clip in the Arrangement on an audio track from a file. The file must first be copied into the project with import_into_project; use the path it returns. Length defaults to the file's length at the current tempo. loop requires warped to be set; unwarped clips can't loop.",
    input: {
      track: TrackRefSchema,
      filePath: z.string().min(1).describe("Path returned by import_into_project"),
      start: z.number().min(0).describe("Arrangement position in beats"),
      length: z.number().positive().optional().describe("Length in beats"),
      warped: z.boolean().optional(),
      loop: LoopSchema.optional(),
      ...nameFields,
    },
    describe: ({ track, start, name }) => `Place an audio clip${name ? ` "${name}"` : ""} on ${trackLabel(track)} at beat ${start}.`,
  }),
  extensionTool({
    op: "track_delete_clip",
    changes: "set",
    description: "Delete an Arrangement clip. For Session clips use clip_slot_delete_clip.",
    input: { clip: z.union([ArrangementClipRefSchema, z.object({ tag: z.string().min(1) })]) },
    describe: ({ clip }) => ("tag" in clip ? `Delete the clip tagged ${clip.tag}.` : `Delete the Arrangement clip at beat ${clip.start} on ${trackLabel(clip.track)}.`),
  }),
  extensionTool({
    op: "track_clear_range",
    changes: "set",
    description: "Delete everything on a track between two Arrangement beats; clips crossing the edges are shortened to the edge.",
    input: { track: TrackRefSchema, start: z.number().min(0), end: z.number().positive() },
    describe: ({ track, start, end }) => `Clear ${trackLabel(track)} from beat ${start} to beat ${end}.`,
  }),
  extensionTool({
    op: "track_create_take_lane",
    changes: "set",
    description: "Add a take lane to a track (used for comping recordings).",
    input: { track: TrackRefSchema, name: z.string().min(1).optional() },
    describe: ({ track }) => `Add a take lane to ${trackLabel(track)}.`,
  }),
  extensionTool({
    op: "track_insert_device",
    changes: "set",
    description:
      'Insert one of Live\'s built-in instruments or effects, with its default preset, into a track\'s device chain (e.g. "Drift", "Operator", "Wavetable", "Meld", "Simpler", "Sampler", "Drum Rack", "EQ Eight", "Compressor", "Glue Compressor", "Multiband Dynamics", "Saturator", "Reverb", "Delay", "Echo", "Auto Filter", "Chorus-Ensemble", "Utility", "Limiter"). Third-party plug-ins and presets load with browser_load instead.',
    input: {
      track: TrackRefSchema,
      device: z.string().min(1).describe("Exact name of the built-in Live device"),
      index: z.number().int().min(0).optional().describe("0-based position in the chain; default: the end"),
    },
    describe: ({ track, device }) => `Add ${device} to ${trackLabel(track)}.`,
  }),
  extensionTool({
    op: "track_delete_device",
    changes: "set",
    description: "Remove a device from a track's device chain.",
    input: { device: DeviceRefSchema },
    describe: ({ device }) => `Remove ${deviceLabel(device)}.`,
  }),
  extensionTool({
    op: "track_duplicate_device",
    changes: "set",
    description: "Duplicate a device; the copy goes right after the original.",
    input: { device: DeviceRefSchema },
    describe: ({ device }) => `Duplicate ${deviceLabel(device)}.`,
  }),
];
