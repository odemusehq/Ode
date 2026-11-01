import { defineTool } from "../../define";
import { nativeTarget } from "../native-target";
import { ClipRefSchema } from "../schemas";
import { z } from "zod";
import { MAX_DAW } from "../../../shared/max-daw";

export const nativeClipReads = [defineTool({
  name: "clip_get_native", changes: "none",
  description: "Read native clip start/end/loop markers, assigned groove id, and, for audio, gain with display text, transpose semitones, detune cents, source path and warp markers through Max. Returns readToken for clip_set_native/clip_warp_marker/clip_set_groove. Groove id 0 means unassigned; null means unsupported. Markers are clip beats; warp sample_time is seconds in the source file. Gain is Live's native 0..1 control; do not infer a dB conversion. Unsupported fields are null. No waveform, pitch or transient analysis runs in Ode.",
  input: { clip: ClipRefSchema },
  async run(input, ctx) { const target = await nativeTarget(input, ctx); return target.native.run("clip_read", target.address, {}, target.scope, ctx.signal); },
}), defineTool({
  name: "midi_clip_get_notes_native", changes: "none",
  description: "Read existing MIDI notes with their actual clip-local native note_id through Max's get_all_notes_extended. Returns a bounded page in note-ID order, native pitch/start_time/duration/velocity/mute/probability/velocity_deviation/release_velocity, total, nextOffset and a readToken bound to the entire observed clip note state and this returned page. Times are absolute clip beats, not Arrangement positions. Read again for later pages. midi_clip_modify_notes_native accepts only IDs from its token's page. Clips over 1024 notes or 262144 native JSON characters are refused; no partial snapshot can authorise an edit. Tokens require unchanged observed notes and native target/session; IDs identify surviving notes only within this clip and must never be invented. Attached MPE is preserved by the native edit but is not exposed or backed up here.",
  input: { clip: ClipRefSchema, offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(MAX_DAW.midiPageSize).optional() },
  async run({ clip, ...args }, ctx) { const target = await nativeTarget({ clip }, ctx); return target.native.run("midi_notes_read", target.address, args, target.scope, ctx.signal); },
})];
