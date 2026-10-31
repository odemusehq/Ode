import { z } from "zod";
import { t } from "../../../shared/i18n";
import { defineTool } from "../../define";
import { nativeTarget } from "../native-target";
import { ClipRefSchema } from "../schemas";

const base = { clip: ClipRefSchema, readToken: z.string().min(1) };
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
})];
