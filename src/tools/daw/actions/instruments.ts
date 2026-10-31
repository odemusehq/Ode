import { z } from "zod";
import { t } from "../../../shared/i18n";
import { defineTool } from "../../define";
import { nativeTarget } from "../native-target";
import { DeviceRefSchema } from "../schemas";

const base = { device: DeviceRefSchema, readToken: z.string().min(1) };
export const instrumentWrites = [defineTool({
  name: "simpler_set_native", changes: "set", mainAgentOnly: true,
  description: "Set one native Simpler/Sample setting using simpler_get_native's current readToken. Booleans: retrigger, pad_slicing, sample.warping; other fields are numeric native values. Sample start/end markers are integer sample frames, slicing sensitivity 0..1, modes use the documented read-tool indices. Native transient/beat/region slicing is Simpler's own operation. No custom trimming, stretching, synthesis or transient detector runs. Refuses changed/replaced sample, multisample mode or recording. Read back and audition; outside Ode's saved-state restoration.",
  input: { ...base, field: z.enum(["playback_mode", "retrigger", "voices", "pad_slicing", "slicing_playback_mode", "sample.start_marker", "sample.end_marker", "sample.gain", "sample.warping", "sample.warp_mode", "sample.slicing_style", "sample.slicing_sensitivity", "sample.slicing_beat_division", "sample.slicing_region_count"]), value: z.union([z.number(), z.boolean()]) },
  describe: ({ device }, names) => t("maxDaw.activityInstrument", { device: names.device(device) }),
  async run({ device, ...args }, ctx) { const target = await nativeTarget({ device }, ctx); return target.native.run("simpler_set", target.address, args, target.scope, ctx.signal); },
}), defineTool({
  name: "simpler_slice", changes: "set", mainAgentOnly: true,
  description: "Insert, move or remove one native sample slice in a Simpler already in Slicing playback mode and Manual slicing style. Use simpler_get_native's readToken and actual integer sample-frame positions; move also takes destinationFrame. Simpler performs the edit. This does not split files, analyse audio or build a new Drum Rack. Refuses changed sample or recording; outside Ode's saved-state restoration.",
  input: { ...base, action: z.enum(["insert", "move", "remove"]), frame: z.number().int().min(0), destinationFrame: z.number().int().min(0).optional() },
  describe: ({ device }, names) => t("maxDaw.activityInstrument", { device: names.device(device) }),
  async run({ device, ...args }, ctx) { const target = await nativeTarget({ device }, ctx); return target.native.run("simpler_slice", target.address, args, target.scope, ctx.signal); },
}), defineTool({
  name: "drum_chain_set_native", changes: "set", mainAgentOnly: true,
  description: "Set one Drum Rack chain's actual choke group (0 none, 1..16 groups) or output MIDI note (0..127). Use drum_chain_get_native's readToken, same rack and chain. Refuses stale/replaced chains, unavailable fields or recording. Input-note changes use the existing SDK drum_pad_set_note. No assumed pad mapping; outside Ode's saved-state restoration.",
  input: { ...base, chain: z.number().int().min(0), field: z.enum(["choke_group", "out_note"]), value: z.number().int().min(0).max(127) },
  describe: ({ device }, names) => t("maxDaw.activityInstrument", { device: names.device(device) }),
  async run({ device, ...args }, ctx) { const target = await nativeTarget({ device }, ctx); return target.native.run("drum_chain_set", target.address, args, target.scope, ctx.signal); },
})];
