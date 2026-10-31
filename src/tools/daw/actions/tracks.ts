import { z } from "zod";
import { SetWording } from "../../../mneme/set-diff";
import { t } from "../../../shared/i18n";
import { extensionTool } from "../extension-tool";
import { ArrangementClipRefSchema, DeviceRefSchema, LoopSchema, NoteSchema, TrackRefSchema, nameFields } from "../schemas";

export const trackTools = [
  extensionTool({
    op: "import_into_project",
    changes: "set",
    description: "Copy an available audio file into the Live project through the SDK. Returns the persistent path to use when creating audio clips. Simpler sample replacement imports its file automatically.",
    input: { filePath: z.string().min(1) },
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
    describe: ({ track, name, mute, solo, arm }, names) => {
      const changes = [
        name === undefined ? "" : t("toolActivity.rename", { name: name }),
        mute === undefined ? "" : mute ? t("toolActivity.words.mute") : t("toolActivity.words.unmute"),
        solo === undefined ? "" : solo ? t("toolActivity.words.solo") : t("toolActivity.words.unsolo"),
        arm === undefined ? "" : arm ? t("toolActivity.words.arm") : t("toolActivity.words.disarm"),
      ].filter((change) => change.length > 0);
      return `${names.track(track)} · ${SetWording.list(changes) || t("toolActivity.words.unchanged")}`;
    },
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
    describe: ({ track, start, length, notes, name }, names) =>
      t("toolActivity.createArrangementMidiClip", { track: names.track(track), isName: Boolean(name), name: name, start: names.span(start, start + length), isNotes: Boolean(notes), length: (notes ? SetWording.count(notes.length, "note") : "") }),
  }),
  extensionTool({
    op: "track_create_audio_clip",
    changes: "set",
    description:
      "Create an audio clip in the Arrangement on an audio track from a file. The file must first be copied into the project with import_into_project; use the path it returns. Length defaults to the file's length at the current tempo. loop requires warped to be set; only warped clips loop.",
    input: {
      track: TrackRefSchema,
      filePath: z.string().min(1).describe("Path returned by import_into_project"),
      start: z.number().min(0).describe("Arrangement position in beats"),
      length: z.number().positive().optional().describe("Length in beats"),
      warped: z.boolean().optional(),
      loop: LoopSchema.optional(),
      ...nameFields,
    },
    describe: ({ track, start, name }, names) => t("toolActivity.createArrangementAudioClip", { track: names.track(track), isName: Boolean(name), name: name, start: names.position(start) }),
  }),
  extensionTool({
    op: "track_delete_clip",
    changes: "set",
    description: "Delete an Arrangement clip. For Session clips use clip_slot_delete_clip.",
    input: { clip: z.union([ArrangementClipRefSchema, z.object({ tag: z.string().min(1) })]) },
    describe: ({ clip }, names) => t("toolActivity.deleteArrangementClip", { clip: names.clip(clip) }),
  }),
  extensionTool({
    op: "track_clear_range",
    changes: "set",
    description: "Delete everything on a track between two Arrangement beats; clips crossing the edges are shortened to the edge.",
    input: { track: TrackRefSchema, start: z.number().min(0), end: z.number().positive() },
    describe: ({ track, start, end }, names) => t("toolActivity.clear", { track: names.track(track), start: names.span(start, end) }),
  }),
  extensionTool({
    op: "track_create_take_lane",
    changes: "set",
    description: "Add a take lane to a track (used for comping recordings).",
    input: { track: TrackRefSchema, name: z.string().min(1).optional() },
    describe: ({ track, name }, names) => t("toolActivity.createTakeLane", { track: names.track(track), isName: Boolean(name), name: name }),
  }),
  extensionTool({
    op: "track_insert_device",
    changes: "set",
    description:
      'Insert one of Live\'s built-in instruments or effects, with its default sound, into a track\'s device chain (e.g. "Drift", "Operator", "Wavetable", "Meld", "Simpler", "Sampler", "Drum Rack", "EQ Eight", "Compressor", "Glue Compressor", "Multiband Dynamics", "Saturator", "Reverb", "Delay", "Echo", "Auto Filter", "Chorus-Ensemble", "Utility", "Limiter"). Plug-ins the musician already added take parameter changes through parameter_set.',
    input: {
      track: TrackRefSchema,
      device: z.string().min(1).describe("Exact name of the built-in Live device"),
      index: z.number().int().min(0).optional().describe("0-based position in the chain; default: the end"),
    },
    describe: ({ track, device }, names) => t("toolActivity.add", { track: names.track(track), device: device }),
  }),
  extensionTool({
    op: "track_delete_device",
    changes: "set",
    description: "Remove a device from a track's device chain.",
    input: { device: DeviceRefSchema },
    describe: ({ device }, names) => t("toolActivity.remove", { device: names.device(device) }),
  }),
  extensionTool({
    op: "track_duplicate_device",
    changes: "set",
    description: "Duplicate a device; the copy goes right after the original.",
    input: { device: DeviceRefSchema },
    describe: ({ device }, names) => t("toolActivity.duplicate", { device: names.device(device) }),
  })
];
