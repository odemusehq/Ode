import { z } from "zod";
import { extensionTool } from "./extension-tool";
import { DeviceRefSchema, ParameterRefSchema, TrackRefSchema, deviceLabel, parameterLabel } from "./schemas";

export const deviceTools = [
  extensionTool({
    op: "device_get",
    description:
      "Read a device: name, kind, its parameters (name, range, default, value names for switches) and, for racks, its chains; for Simpler, the loaded sample. Set withValues to also read current values.",
    input: { device: DeviceRefSchema, withValues: z.boolean().optional() },
  }),
  extensionTool({
    op: "parameter_get",
    description: "Read one device parameter with its range and current value.",
    input: { parameter: ParameterRefSchema },
  }),
  extensionTool({
    op: "parameter_set",
    changes: "set",
    description:
      "Set a device parameter. Values are in the parameter's own range (see parameter_get); switches and choosers take the index of the option. Values outside the range are clamped.",
    input: { parameter: ParameterRefSchema, value: z.number() },
    describe: ({ parameter, value }) => `Set ${parameterLabel(parameter)} to ${value}.`,
  }),
  extensionTool({
    op: "mixer_get",
    description: "Read a track's mixer: volume, panning and send levels (each with its range and current value).",
    input: { track: TrackRefSchema },
  }),
];

export const rackTools = [
  extensionTool({
    op: "rack_get_chains",
    description: "Read the chains of a rack (Instrument, Audio Effect or Drum Rack) with their devices; Drum Rack chains include the note each pad receives.",
    input: { device: DeviceRefSchema },
  }),
  extensionTool({
    op: "rack_insert_chain",
    changes: "set",
    description: "Add an empty chain to a rack at a 0-based position (default: the end).",
    input: { device: DeviceRefSchema, index: z.number().int().min(0).optional() },
    describe: ({ device }) => `Add a chain to ${deviceLabel(device)}.`,
  }),
  extensionTool({
    op: "chain_insert_device",
    changes: "set",
    description: "Insert a built-in Live device (default preset) into a chain of a rack. device is the rack; chain is the 0-based chain index.",
    input: {
      device: DeviceRefSchema,
      chain: z.number().int().min(0),
      name: z.string().min(1).describe("Exact name of the built-in Live device"),
      index: z.number().int().min(0).optional(),
    },
    describe: ({ device, chain, name }) => `Add ${name} to chain ${chain + 1} of ${deviceLabel(device)}.`,
  }),
  extensionTool({
    op: "chain_delete_device",
    changes: "set",
    description: "Remove a device that sits inside a rack chain (give its full chain path in the device reference).",
    input: { device: DeviceRefSchema },
    describe: ({ device }) => `Remove ${deviceLabel(device)}.`,
  }),
  extensionTool({
    op: "chain_duplicate_device",
    changes: "set",
    description: "Duplicate a device inside a rack chain; the copy goes right after it.",
    input: { device: DeviceRefSchema },
    describe: ({ device }) => `Duplicate ${deviceLabel(device)}.`,
  }),
  extensionTool({
    op: "drum_pad_set_note",
    changes: "set",
    description: "Set which MIDI note triggers a Drum Rack pad chain (device is the Drum Rack; chain is the pad's chain index).",
    input: { device: DeviceRefSchema, chain: z.number().int().min(0), note: z.number().int().min(0).max(127) },
    describe: ({ chain, note }) => `Make Drum Rack pad chain ${chain + 1} play on note ${note}.`,
  }),
  extensionTool({
    op: "simpler_get_sample",
    description: "Read the file path of the sample loaded in a Simpler.",
    input: { device: DeviceRefSchema },
  }),
  extensionTool({
    op: "simpler_replace_sample",
    changes: "set",
    description: "Load a different audio file into a Simpler (for example a drum one-shot or a sample made with sample_from_recording).",
    input: { device: DeviceRefSchema, filePath: z.string().min(1) },
    describe: ({ device }) => `Load a new sample into ${deviceLabel(device)}.`,
  }),
];
