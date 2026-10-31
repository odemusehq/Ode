import { WarpMode } from "@ableton-extensions/sdk";
import { z } from "zod";
import { SetWording } from "../../../mneme/set-diff";
import { t } from "../../../shared/i18n";
import { extensionTool } from "../extension-tool";
import { ClipRefSchema, ClipSlotRefSchema, LoopSchema, NoteSchema, TakeLaneRefSchema, nameFields } from "../schemas";

export const takeLaneTools = [
  extensionTool({
    op: "take_lane_rename",
    changes: "set",
    description: "Rename a take lane.",
    input: { lane: TakeLaneRefSchema, name: z.string().min(1) },
    describe: ({ lane, name }, names) => t("toolActivity.renameTakeLane", { lane: names.takeLane(lane), name: name }),
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
      t("toolActivity.createTakeLaneMidiClip", { lane: names.takeLane(lane), isName: Boolean(name), name: name, start: names.span(start, start + length), isNotes: Boolean(notes), length: (notes ? SetWording.count(notes.length, "note") : "") }),
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
    describe: ({ lane, start, name }, names) => t("toolActivity.createTakeLaneAudioClip", { lane: names.takeLane(lane), isName: Boolean(name), name: name, start: names.position(start) }),
  })
];

export const clipSlotTools = [
  extensionTool({
    op: "clip_slot_create_midi_clip",
    changes: "set",
    description: "Create a MIDI clip in an empty Session clip slot, optionally with notes (beats from the clip start).",
    input: { slot: ClipSlotRefSchema, length: z.number().positive(), notes: z.array(NoteSchema).optional(), ...nameFields },
    describe: ({ slot, length, notes, name }, names) =>
      t("toolActivity.createSessionMidiClip", { slot: names.slot(slot), isName: Boolean(name), name: name, length: names.length(length), isNotes: Boolean(notes), length2: (notes ? SetWording.count(notes.length, "note") : "") }),
  }),
  extensionTool({
    op: "clip_slot_create_audio_clip",
    changes: "set",
    description: "Create an audio clip in an empty Session clip slot from a file imported with import_into_project.",
    input: { slot: ClipSlotRefSchema, filePath: z.string().min(1), warped: z.boolean().optional(), loop: LoopSchema.optional(), ...nameFields },
    describe: ({ slot, name }, names) => t("toolActivity.createSessionAudioClip", { slot: names.slot(slot), isName: Boolean(name), name: name }),
  }),
  extensionTool({
    op: "clip_slot_delete_clip",
    changes: "set",
    description: "Delete the clip in a Session clip slot.",
    input: { slot: ClipSlotRefSchema },
    describe: ({ slot }, names) => t("toolActivity.deleteSessionClip", { slot: names.clip(slot) }),
  })
];

export const clipTools = [
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
        name === undefined ? "" : t("toolActivity.rename", { name: name }),
        color === undefined ? "" : t("toolActivity.words.colour"),
        muted === undefined ? "" : muted ? t("toolActivity.words.deactivate") : t("toolActivity.words.activate"),
        looping === undefined ? "" : looping ? t("toolActivity.loopOn") : t("toolActivity.loopOff"),
      ].filter((change) => change.length > 0);
      return `${names.clip(clip)} · ${SetWording.list(changes) || t("toolActivity.words.unchanged")}`;
    },
  }),
  extensionTool({
    op: "midi_clip_set_notes",
    changes: "set",
    description: "Replace all notes in an existing MIDI clip, preserving every untouched note and field in the supplied list. First read midi_clip_get_notes and give expected:{token:recoveryToken} from that actual read; never echo its full preimage. The synchronous native guard refuses changed notes, another target, an expired token or restarted Live extension before writing. On refusal reread and reconcile the requested edit with current material rather than replaying the stale replacement. The token is consumed only on a successful write. Beats remain relative to clip start. New clip creation accepts initial notes separately.",
    input: { clip: ClipRefSchema, notes: z.array(NoteSchema), expected: z.object({ token: z.string().min(1).max(1000) }) },
    describe: ({ clip, notes }, names) => t("toolActivity.writeReplacingItsNotes", { clip: names.clip(clip), length: (notes ? SetWording.count(notes.length, "note") : "") }),
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
        warping === undefined ? "" : warping ? t("toolActivity.warpingOn") : t("toolActivity.warpingOff"),
        warpMode === undefined ? "" : t("toolActivity.warpMode", { warpMode: SetWording.warpMode(warpMode) }),
      ].filter((change) => change.length > 0);
      return `${names.clip(clip)} · ${SetWording.list(changes) || t("toolActivity.words.unchanged")}`;
    },
  })
];
