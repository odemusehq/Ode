import { z } from "zod";
import type { DeviceOp } from "../../shared/live";
import { defineTool, type AnyTool, type OdeTool, type ToolChange } from "../define";
import { LocatorRefSchema } from "../live/schemas";
import { NOTE_NAMES } from "../../shared/notes";

interface DeviceToolSpec<S extends z.ZodRawShape> {
  op: Exclude<DeviceOp, "set_info">;
  description: string;
  input: S;
  changes?: ToolChange;
  describe?: (input: z.infer<z.ZodObject<S>>) => string;
}

/** A tool that runs one Max for Live API operation through the Ode device on the Master track. */
function deviceTool<S extends z.ZodRawShape>(spec: DeviceToolSpec<S>): OdeTool<S> {
  return defineTool({
    name: spec.op,
    description: spec.description,
    input: spec.input,
    changes: spec.changes ?? "none",
    describe: spec.describe,
    run: (input, ctx) => ctx.live.device.call(spec.op, input),
  });
}

export const deviceTools: AnyTool[] = [
  deviceTool({
    op: "transport_play",
    description: "Start playback, optionally from a beat in the Arrangement. Use it so the musician can hear a change.",
    input: { from: z.number().min(0).optional().describe("Arrangement position in beats") },
  }),
  deviceTool({ op: "transport_stop", description: "Stop playback.", input: {} }),
  deviceTool({ op: "transport_continue", description: "Continue playback from where it stopped.", input: {} }),
  deviceTool({
    op: "transport_set_position",
    description: "Move the playhead to a beat in the Arrangement.",
    input: { time: z.number().min(0) },
  }),
  deviceTool({
    op: "transport_record",
    changes: "set",
    description: "Turn Arrangement recording on or off (records onto armed tracks while playing).",
    input: { on: z.boolean() },
    describe: ({ on }) => (on ? "Start Arrangement recording." : "Stop Arrangement recording."),
  }),
  deviceTool({
    op: "session_record",
    changes: "set",
    description: "Turn Session recording (overdub) on or off.",
    input: { on: z.boolean() },
    describe: ({ on }) => (on ? "Turn Session recording on." : "Turn Session recording off."),
  }),
  deviceTool({
    op: "loop_set",
    changes: "set",
    description: "Turn the Arrangement loop on or off and set its start and length in beats, for example to loop a chorus while working on it.",
    input: {
      on: z.boolean().optional(),
      start: z.number().min(0).optional(),
      length: z.number().positive().optional(),
    },
    describe: ({ on, start, length }) =>
      `${on === false ? "Turn off" : "Set"} the Arrangement loop${start !== undefined ? ` from beat ${start}` : ""}${length !== undefined ? ` for ${length} beats` : ""}.`,
  }),
  deviceTool({
    op: "locator_jump",
    description: "Move the playhead to a locator, for example the start of the chorus.",
    input: { locator: LocatorRefSchema },
  }),
  deviceTool({
    op: "song_set_key",
    changes: "set",
    description:
      'Set the Set\'s key and scale (Live\'s Scale setting) and optionally turn Scale Mode on. root: 0 = C … 11 = B. scale: a scale name as Live shows it, e.g. "Major", "Minor", "Dorian", "Mixolydian", "Harmonic Minor".',
    input: {
      root: z.number().int().min(0).max(11),
      scale: z.string().min(1),
      scaleMode: z.boolean().optional(),
    },
    describe: ({ root, scale }) => `Set the key to ${NOTE_NAMES[root]} ${scale}.`,
  }),
  deviceTool({
    op: "song_set_time_signature",
    changes: "set",
    description: "Set the Set's time signature.",
    input: { numerator: z.number().int().min(1).max(99), denominator: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16)]) },
    describe: ({ numerator, denominator }) => `Set the time signature to ${numerator}/${denominator}.`,
  }),
  deviceTool({
    op: "song_create_return_track",
    changes: "set",
    description: "Add a return track at the end (for shared reverb or delay sends).",
    input: {},
    describe: () => "Add a return track.",
  }),
  deviceTool({
    op: "song_delete_return_track",
    changes: "set",
    description: "Delete a return track by its 0-based index.",
    input: { index: z.number().int().min(0) },
    describe: ({ index }) => `Delete return track ${index + 1}.`,
  }),
  deviceTool({
    op: "song_capture_midi",
    changes: "set",
    description: "Capture MIDI: turn what the musician just played into a clip (Live's Capture MIDI).",
    input: {},
    describe: () => "Capture the MIDI the musician just played into a clip.",
  }),
  deviceTool({
    op: "song_undo",
    changes: "set",
    description: "Undo the last change in Live.",
    input: {},
    describe: () => "Undo the last change in Live.",
  }),
  deviceTool({
    op: "song_redo",
    changes: "set",
    description: "Redo the last undone change in Live.",
    input: {},
    describe: () => "Redo the last undone change in Live.",
  }),
  deviceTool({
    op: "selection_get",
    description: "Read what the musician has selected in Live (track, clip, scene), the playhead position and whether Live is playing.",
    input: {},
  }),
  deviceTool({
    op: "track_meters_get",
    description: "Read the current output level of every track and of the Master (0–1, as Live's meters show while playing).",
    input: {},
  }),
  deviceTool({
    op: "master_measure",
    description:
      "Record the Master output for a number of seconds to a WAV file (starting playback from a beat if play is true) and return its path. master_check already uses this; call it directly only to analyse the file another way.",
    input: {
      seconds: z.number().positive().max(600),
      play: z.boolean().optional(),
      from: z.number().min(0).optional(),
    },
  }),
];
