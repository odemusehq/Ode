import { z } from "zod";
import { t } from "../../../shared/i18n";
import { defineTool } from "../../define";
import { nativeTarget } from "../native-target";
import { ClipRefSchema } from "../schemas";
import { MAX_DAW } from "../../../shared/max-daw";

const base = { clip: ClipRefSchema, readToken: z.string().min(1) };
const nativeNotePatch = z.object({
  note_id: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  pitch: z.number().int().min(0).max(127).optional(),
  start_time: z.number().optional(), duration: z.number().positive().optional(),
  velocity: z.number().min(0).max(127).optional(), mute: z.boolean().optional(),
  probability: z.number().min(0).max(1).optional(), velocity_deviation: z.number().min(-127).max(127).optional(),
  release_velocity: z.number().min(0).max(127).optional(),
}).strict().refine(note => Object.keys(note).length > 1, "Supply at least one absolute field to change.");
export const nativeClipWrites = [defineTool({
  name: "clip_set_native", changes: "set", mainAgentOnly: true,
  description: "Set one native clip property after clip_get_native: start/end/loop marker in clip beats; audio gain in native 0..1 units, transpose in integer semitones (-48..48), or detune in cents (-50..49). Read again between changes. Refuses stale state/identity or recording clips. Loop-marker editing needs warped audio. Source files are preserved; these controls are outside Ode's saved-state restoration. Live readback establishes what changed; no custom audio processing runs.",
  input: { ...base, field: z.enum(["start_marker", "end_marker", "loop_start", "loop_end", "gain", "pitch_coarse", "pitch_fine"]), value: z.number() },
  describe: ({ clip }, names) => t("maxDaw.activityClip", { clip: names.clip(clip) }),
  async run({ clip, ...args }, ctx) { const target = await nativeTarget({ clip }, ctx); return target.native.run("clip_set", target.address, args, target.scope, ctx.signal); },
}), defineTool({
  name: "clip_warp_marker", changes: "set", mainAgentOnly: true,
  description: "Add, move or remove one warp marker using Live's native operation and clip_get_native's readToken. beatTime is the existing clip beat for move/remove or the requested new beat for add. Add optionally takes sampleTime in source-file seconds; move takes distance in beats, not a destination. Read and check markers afterwards: Live enforces ordering/tempo constraints and may refuse. Warped, non-recording audio only; no custom stretching or transient detection. Outside Ode's saved-state restoration.",
  input: { ...base, action: z.enum(["add", "move", "remove"]), beatTime: z.number(), sampleTime: z.number().min(0).optional(), distance: z.number().optional() },
  describe: ({ clip }, names) => t("maxDaw.activityWarp", { clip: names.clip(clip) }),
  async run({ clip, ...args }, ctx) { const target = await nativeTarget({ clip }, ctx); return target.native.run("clip_warp", target.address, args, target.scope, ctx.signal); },
}), defineTool({
  name: "clip_show", changes: "set", mainAgentOnly: true,
  description: "Reveal an existing clip in Live's Clip View. Use this for musician-performed commands such as Convert Melody to New MIDI Track; showing the clip does not execute that command or select a context-menu item. Read the resulting new MIDI/track state after the musician finishes.",
  input: { clip: ClipRefSchema },
  describe: ({ clip }, names) => t("maxDaw.activityShowClip", { clip: names.clip(clip) }),
  async run(input, ctx) { const target = await nativeTarget(input, ctx); return target.native.run("clip_show", target.address, {}, target.scope, ctx.signal); },
}), defineTool({
  name: "midi_clip_modify_notes_native", changes: "set", mainAgentOnly: true,
  description: "Modify up to 32 existing MIDI notes using explicit note_id values returned on one midi_clip_get_notes_native page and that page's current readToken. Supply only caller-chosen absolute destination fields: pitch, start_time/duration in clip beats, velocity, mute (boolean), probability, velocity_deviation and release_velocity. No relative transpose, timing, humanisation or composition algorithm runs. Live's apply_note_modifications edits copies of the original returned dictionaries, retaining IDs, attached MPE and untouched fields; other notes are not replaced. Refuses changed clip identity/note state, IDs outside the returned page, duplicates, recording and expired/consumed tokens. Returns selected before/after readback and confirmed; inspect the actual result and reread between writes. This does not itself prevent repeating a musical edit after a fresh read. Ode History cannot safely invert this edit because snapshots omit native IDs/MPE; save the Set and use native Undo where supported.",
  input: { ...base, notes: z.array(nativeNotePatch).min(1).max(MAX_DAW.midiMaxEdits)
    .refine(notes => new Set(notes.map(note => note.note_id)).size === notes.length, "Each native note ID may appear once.") },
  describe: ({ clip }, names) => t("maxDaw.activityClip", { clip: names.clip(clip) }),
  async run({ clip, ...args }, ctx) {
    const target = await nativeTarget({ clip }, ctx);
    const result = await target.native.run("midi_notes_modify", target.address, args, target.scope, ctx.signal);
    return { ...result, __odeReceipts: [{ kind: "unverified", tool: "midi_clip_modify_notes_native", reason: t("maxDaw.midiRestoration") }] };
  },
})];
