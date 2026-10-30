import { t } from "../../shared/i18n";
import { z } from "zod";
import { LIVE_TEMPO } from "../../shared/live";
import { extensionTool } from "./extension-tool";
import { LocatorRefSchema, SceneRefSchema, TrackRefSchema, nameFields } from "./schemas";

export const songTools = [
  extensionTool({
    op: "song_get",
    alwaysLoad: true,
    description:
      "Read the open Live Set: tempo, Arrangement grid, key and scale (root note 0 = C … 11 = B, scale name, whether Scale Mode is on, scale intervals), every track with its devices, return tracks, scenes and locators. Use it before acting so you know what is in the Set.",
    input: {},
  }),
  extensionTool({
    op: "song_set_tempo",
    changes: "set",
    description: "Set the Set's tempo in BPM.",
    input: { tempo: z.number().min(LIVE_TEMPO.min).max(LIVE_TEMPO.max).describe("Beats per minute") },
    describe: ({ tempo }) => t("toolActivity.setTempo", { tempo: tempo }),
  }),
  extensionTool({
    op: "song_create_midi_track",
    changes: "set",
    description: "Create a MIDI track after the selected track (or at the end). Returns the new track's reference, index and name.",
    input: { ...nameFields },
    describe: ({ name }) => t("toolActivity.createMidiTrack", { isName: Boolean(name), name: name }),
  }),
  extensionTool({
    op: "song_create_audio_track",
    changes: "set",
    description: "Create an audio track after the selected track (or at the end). Returns the new track's reference, index and name.",
    input: { ...nameFields },
    describe: ({ name }) => t("toolActivity.createAudioTrack", { isName: Boolean(name), name: name }),
  }),
  extensionTool({
    op: "song_delete_track",
    changes: "set",
    description: "Delete a track and everything on it.",
    input: { track: TrackRefSchema },
    describe: ({ track }, names) => t("toolActivity.deleteTheTrack", { track: names.track(track) }),
  }),
  extensionTool({
    op: "song_duplicate_track",
    changes: "set",
    description: "Duplicate a track with its clips and devices; the copy goes right after the original.",
    input: { track: TrackRefSchema, ...nameFields },
    describe: ({ track, name }, names) => t("toolActivity.duplicateTrack", { track: names.track(track), isName: Boolean(name), name: name }),
  }),
  extensionTool({
    op: "song_create_scene",
    changes: "set",
    description: "Create a scene in Session View at a 0-based position (default: at the end).",
    input: {
      index: z.number().int().min(-1).optional().describe("0-based position; -1 or empty for the end"),
      name: z.string().min(1).optional(),
    },
    describe: ({ name }) => t("toolActivity.createScene", { isName: Boolean(name), name: name }),
  }),
  extensionTool({
    op: "song_delete_scene",
    changes: "set",
    description: "Delete a scene and the clips in its row.",
    input: { scene: SceneRefSchema },
    describe: ({ scene }, names) => t("toolActivity.deleteScene", { scene: names.scene(scene) }),
  }),
  extensionTool({
    op: "song_duplicate_scene",
    changes: "set",
    description: "Duplicate a scene with its clips; the copy goes right after the original.",
    input: { scene: SceneRefSchema },
    describe: ({ scene }, names) => t("toolActivity.duplicateScene", { scene: names.scene(scene) }),
  }),
  extensionTool({
    op: "song_create_locator",
    changes: "set",
    description: "Add a locator in the Arrangement at a beat, for example to mark where Verse 1 or the Chorus starts.",
    input: { time: z.number().min(0).describe("Position in beats"), name: z.string().min(1).optional() },
    describe: ({ time, name }, names) => t("toolActivity.createLocator", { isName: Boolean(name), name: name, time: names.position(time) }),
  }),
  extensionTool({
    op: "song_delete_locator",
    changes: "set",
    description: "Delete a locator from the Arrangement.",
    input: { locator: LocatorRefSchema },
    describe: ({ locator }, names) => t("toolActivity.deleteLocator", { locator: names.locator(locator) }),
  }),
  extensionTool({
    op: "locator_rename",
    changes: "set",
    description: "Rename a locator.",
    input: { locator: LocatorRefSchema, name: z.string().min(1) },
    describe: ({ locator, name }, names) => t("toolActivity.renameLocator", { locator: names.locator(locator), name: name }),
  }),
];
