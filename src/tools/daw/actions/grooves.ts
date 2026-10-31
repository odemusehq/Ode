import { z } from "zod";
import { t } from "../../../shared/i18n";
import { defineTool } from "../../define";
import { nativeTarget } from "../native-target";
import { ClipRefSchema } from "../schemas";

export const grooveWrites = [defineTool({
  name: "clip_set_groove", changes: "set", mainAgentOnly: true,
  description: "Assign an existing native Groove Pool groove to a clip, or clear its assignment with groove:null. First read clip_get_native for its current readToken and groove_pool_get for the exact groove id/name. Refuses stale clip state, missing/renamed grooves and recording. Live applies its own groove behaviour; this creates no local humanisation or timing engine and does not bake changes into MIDI. Read back and audition. Groove settings can be shared by several clips; assignment is outside Ode's saved-state restoration, so use Live's native Undo when needed.",
  input: { clip: ClipRefSchema, readToken: z.string().min(1), groove: z.object({ id: z.string().regex(/^[1-9]\d*$/).max(32), name: z.string().min(1).max(512) }).nullable() },
  describe: ({ clip }, names) => t("maxDaw.activityGroove", { clip: names.clip(clip) }),
  async run({ clip, ...args }, ctx) {
    const target = await nativeTarget({ clip }, ctx);
    return target.native.run("clip_groove_set", target.address, args, target.scope, ctx.signal);
  },
})];
