import { z } from "zod";
import { defineTool, type AnyTool } from "../define";
import { TrackRefSchema, trackLabel } from "../live/schemas";

const CATEGORIES = ["instruments", "audio_effects", "midi_effects", "plugins", "drums", "sounds", "samples", "user_library", "all"] as const;

export const browserTools: AnyTool[] = [
  defineTool({
    name: "browser_search",
    changes: "none",
    description:
      "Search Live's browser for instruments, effects, plug-ins, presets, drum kits, sounds and samples by name. Returns items with a uri to pass to browser_load. Narrow with a category when you know it.",
    input: {
      query: z.string().min(1),
      category: z.enum(CATEGORIES).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
    run: (input, ctx) => ctx.live.bridge.call("browser_search", input),
  }),
  defineTool({
    name: "browser_load",
    changes: "set",
    description:
      "Load an item from Live's browser (a plug-in, a preset, an instrument or effect preset, a drum kit or a sample) onto a track, as if the musician double-clicked it with that track selected.",
    input: { uri: z.string().min(1).describe("uri from browser_search or plugin_list"), track: TrackRefSchema },
    describe: ({ track }) => `Load the chosen browser item onto ${trackLabel(track)}.`,
    run: (input, ctx) => ctx.live.bridge.call("browser_load", input),
  }),
  defineTool({
    name: "plugin_list",
    changes: "none",
    description: "List the third-party plug-ins installed in Live (VST3 and Audio Units), with a uri for browser_load.",
    input: { limit: z.number().int().min(1).max(500).optional() },
    run: (input, ctx) => ctx.live.bridge.call("plugin_list", input),
  }),
];
