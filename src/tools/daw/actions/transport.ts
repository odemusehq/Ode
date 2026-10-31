import { z } from "zod";
import { t } from "../../../shared/i18n";
import { defineTool } from "../../define";

export const transportWrites = [defineTool({
  name: "song_set_transport", changes: "set", mainAgentOnly: true,
  description: "Perform one actual native transport operation with song_get_transport's current readToken. play/stop need no value. Before play, stop and set current_song_time to the requested beat: this also sets Live's rehearsal insert marker start_time. Read transport again to confirm both positions before Play; native changes can be deferred. Play starts from that confirmed marker, not a guessed resume position. metronome, punch_in/out, loop and back_to_arranger take boolean values; false for back_to_arranger returns to Arrangement. loop_start/loop_length/current_song_time take beats. Seeking requires stopped, non-recording transport. The musician starts and stops vocal recording in Live. Ode cannot enable Record or start playback with Record active. Tokens tolerate normal playback progress, not changed controls. Stopping Ode does not undo a completed command. Inspect actual readback afterwards; transport and insert marker are outside History restoration.",
  input: { readToken: z.string().min(1), action: z.enum(["play", "stop", "metronome", "punch_in", "punch_out", "loop", "back_to_arranger", "loop_start", "loop_length", "current_song_time"]), value: z.union([z.boolean(), z.number()]).optional() },
  describe: () => t("maxDaw.activityTransport"),
  async run(args, ctx) {
    ctx.signal?.throwIfAborted();
    if (!ctx.maxDaw) throw new Error(t("maxDaw.unavailable"));
    if (!ctx.exchangeId) throw new Error(t("maxDaw.invalid"));
    return ctx.maxDaw.run("transport_set", null, args, ctx.exchangeId, ctx.signal);
  },
})];
