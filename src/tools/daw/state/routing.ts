import { defineTool } from "../../define";
import { nativeTarget } from "../native-target";
import { DeviceRefSchema, TrackRefSchema } from "../schemas";

export const routingReads = [defineTool({
  name: "track_get_routing", changes: "none",
  description: "Read a track's actual input/output routing and available native choices through Max, plus readToken. Unsupported fields are null. Use exact offered identifiers with track_set_routing; selecting a type can change its channel choices, so read again before setting a channel. This observes real routing rather than inferring dependencies from track names or sends.",
  input: { track: TrackRefSchema },
  async run(input, ctx) { const target = await nativeTarget(input, ctx); return target.native.run("track_routing_read", target.address, {}, target.scope, ctx.signal); },
}), defineTool({
  name: "track_get_meters", changes: "none",
  description: "Read Live's current input/output momentary and held peak meters for one track through Max. Values remain in native 0..1 units; unavailable meters are null. Read during playback for an actual signal. These are not dBFS conversions, LUFS, true peak or compressor gain reduction and do not measure the whole song. Use the configured audio listener separately for musical judgements.",
  input: { track: TrackRefSchema },
  async run(input, ctx) { const target = await nativeTarget(input, ctx); return target.native.run("track_meters", target.address, {}, target.scope, ctx.signal); },
}), defineTool({
  name: "compressor_get_sidechain", changes: "none",
  description: "Read the actual sidechain input type/channel and offered choices of Live's Compressor through Max, with readToken. Does not expose a third-party plugin's hidden routing. Use device_get for its normal sidechain enable/EQ and compression parameters.",
  input: { device: DeviceRefSchema },
  async run(input, ctx) { const target = await nativeTarget(input, ctx); return target.native.run("compressor_routing_read", target.address, {}, target.scope, ctx.signal); },
})];
