import { defineTool } from "../../define";
import { nativeTarget } from "../native-target";
import { ClipRefSchema } from "../schemas";

export const nativeClipReads = [defineTool({
  name: "clip_get_native", changes: "none",
  description: "Read native clip start/end/loop markers, assigned groove id, and, for audio, gain with display text, transpose semitones, detune cents, source path and warp markers through Max. Returns readToken for clip_set_native/clip_warp_marker/clip_set_groove. Groove id 0 means unassigned; null means unsupported. Markers are clip beats; warp sample_time is seconds in the source file. Gain is Live's native 0..1 control; do not infer a dB conversion. Unsupported fields are null. No waveform, pitch or transient analysis runs in Ode.",
  input: { clip: ClipRefSchema },
  async run(input, ctx) { const target = await nativeTarget(input, ctx); return target.native.run("clip_read", target.address, {}, target.scope, ctx.signal); },
})];
