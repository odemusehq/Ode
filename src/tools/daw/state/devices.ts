import { z } from "zod";

import { extensionTool } from "../extension-tool";
import { DeviceRefSchema, ParameterRefSchema, TrackRefSchema } from "../schemas";

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
    op: "mixer_get",
    description: "Read a track's mixer: volume, panning and send levels (each with its range and current value).",
    input: { track: TrackRefSchema },
  })
];

export const rackTools = [
  extensionTool({
    op: "rack_get_chains",
    description: "Read the chains of a rack (Instrument, Audio Effect or Drum Rack) with their devices; Drum Rack chains include the note each pad receives.",
    input: { device: DeviceRefSchema },
  }),
  extensionTool({
    op: "simpler_get_sample",
    description: "Read the file path of the sample loaded in a Simpler.",
    input: { device: DeviceRefSchema },
  })
];
