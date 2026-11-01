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
  description: "Read existing MIDI notes with actual clip-local native note_id through Max. Optional window:{start,length} uses Live's get_notes_extended(0,128,start,length) to select notes whose start times fall in that native beat area, across all MIDI pitches; this is not a sustain-overlap query. Window start/length and returned start_time/duration use absolute clip beats, not Arrangement positions. Without window, read all clip notes. offset/limit page the selected notes in note-ID order; total and nextOffset describe this selection. Repeat the same window for later pages. Returns native performance fields and a readToken bound to the entire observed clip note state and only this returned page's IDs for midi_clip_modify_notes_native. Clips over 1024 notes or 262144 native JSON characters are refused even with a narrow window; no partial snapshot authorises an edit. Tokens require unchanged observed notes and native target/session. IDs identify surviving notes only within this clip and must never be invented. Attached MPE is preserved by the native edit but is not exposed or backed up here.",
  input: { clip: ClipRefSchema, window: z.object({ start: z.number(), length: z.number().positive() }).strict().optional(),
    offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(MAX_DAW.midiPageSize).optional() },
  async run({ clip, ...args }, ctx) { const target = await nativeTarget({ clip }, ctx); return target.native.run("midi_notes_read", target.address, args, target.scope, ctx.signal); },
})];
