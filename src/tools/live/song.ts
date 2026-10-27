import { z } from "zod";
import { extensionTool } from "./extension-tool";
import { LocatorRefSchema, SceneRefSchema, TrackRefSchema, locatorLabel, nameFields, sceneLabel, trackLabel } from "./schemas";

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
    input: { tempo: z.number().min(20).max(999).describe("Beats per minute") },
    describe: ({ tempo }) => `Set the tempo to ${tempo} BPM.`,
  }),
  extensionTool({
    op: "song_create_midi_track",
    changes: "set",
    description: "Create a MIDI track after the selected track (or at the end). Returns the new track's reference, index and name.",
    input: { ...nameFields },
    describe: ({ name }) => `Create a MIDI track${name ? ` called "${name}"` : ""}.`,
  }),
  extensionTool({
    op: "song_create_audio_track",
    changes: "set",
    description: "Create an audio track after the selected track (or at the end). Returns the new track's reference, index and name.",
    input: { ...nameFields },
    describe: ({ name }) => `Create an audio track${name ? ` called "${name}"` : ""}.`,
  }),
  extensionTool({
    op: "song_delete_track",
    changes: "set",
    description: "Delete a track and everything on it.",
    input: { track: TrackRefSchema },
    describe: ({ track }) => `Delete ${trackLabel(track)}.`,
  }),
  extensionTool({
    op: "song_duplicate_track",
    changes: "set",
    description: "Duplicate a track with its clips and devices; the copy goes right after the original.",
    input: { track: TrackRefSchema, ...nameFields },
    describe: ({ track }) => `Duplicate ${trackLabel(track)}.`,
  }),
  extensionTool({
    op: "song_create_scene",
    changes: "set",
    description: "Create a scene in Session View at a 0-based position (default: at the end).",
    input: {
      index: z.number().int().min(-1).optional().describe("0-based position; -1 or empty for the end"),
      name: z.string().min(1).optional(),
    },
    describe: ({ name }) => `Create a scene${name ? ` called "${name}"` : ""}.`,
  }),
  extensionTool({
    op: "song_delete_scene",
    changes: "set",
    description: "Delete a scene and the clips in its row.",
    input: { scene: SceneRefSchema },
    describe: ({ scene }) => `Delete ${sceneLabel(scene)}.`,
  }),
  extensionTool({
    op: "song_duplicate_scene",
    changes: "set",
    description: "Duplicate a scene with its clips; the copy goes right after the original.",
    input: { scene: SceneRefSchema },
    describe: ({ scene }) => `Duplicate ${sceneLabel(scene)}.`,
  }),
  extensionTool({
    op: "song_create_locator",
    changes: "set",
    description: "Add a locator in the Arrangement at a beat, for example to mark where Verse 1 or the Chorus starts.",
    input: { time: z.number().min(0).describe("Position in beats"), name: z.string().min(1).optional() },
    describe: ({ time, name }) => `Add a locator${name ? ` "${name}"` : ""} at beat ${time}.`,
  }),
  extensionTool({
    op: "song_delete_locator",
    changes: "set",
    description: "Delete a locator from the Arrangement.",
    input: { locator: LocatorRefSchema },
    describe: ({ locator }) => `Delete ${locatorLabel(locator)}.`,
  }),
  extensionTool({
    op: "locator_rename",
    changes: "set",
    description: "Rename a locator.",
    input: { locator: LocatorRefSchema, name: z.string().min(1) },
    describe: ({ locator, name }) => `Rename ${locatorLabel(locator)} to "${name}".`,
  }),
];
