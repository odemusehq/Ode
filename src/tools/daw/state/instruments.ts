import { z } from "zod";
import { defineTool } from "../../define";
import { nativeTarget } from "../native-target";
import { DeviceRefSchema } from "../schemas";

export const instrumentReads = [defineTool({
  name: "simpler_get_native", changes: "none",
  description: "Read Simpler's native playback/voice/retrigger/slicing settings and its actual loaded Sample: source, sample-frame length/rate, start/end markers, native gain/warping and slicing controls/positions. Returns readToken for simpler_set_native/simpler_slice. Playback modes: 0 Classic, 1 One-Shot, 2 Slicing; slicing playback: 0 Mono, 1 Poly, 2 Thru; slicing style: 0 Transient, 1 Beat, 2 Region, 3 Manual. Sample markers/slices are frames, not beats/seconds. Unsupported fields are null. Native transient slicing is performed by Simpler, never an Ode detector.",
  input: { device: DeviceRefSchema },
  async run(input, ctx) { const target = await nativeTarget(input, ctx); return target.native.run("simpler_read", target.address, {}, target.scope, ctx.signal); },
}), defineTool({
  name: "drum_chain_get_native", changes: "none",
  description: "Read one actual Drum Rack chain's native input note, output note and choke group with readToken. device identifies the rack; chain is its actual 0-based chain index from rack_get_chains, never a guessed GM drum note. Null means the host does not expose that property.",
  input: { device: DeviceRefSchema, chain: z.number().int().min(0) },
  async run({ device, ...args }, ctx) { const target = await nativeTarget({ device }, ctx); return target.native.run("drum_chain_read", target.address, args, target.scope, ctx.signal); },
})];
