import { z } from "zod";
import { t } from "../../../shared/i18n";
import { defineTool } from "../../define";

export const transportWrites = [defineTool({
  name: "song_set_transport", changes: "set", mainAgentOnly: true,
  description: "Perform one actual native transport operation with song_get_transport's current readToken. play/stop need no value. record_mode, metronome, punch_in/out, loop and back_to_arranger take boolean values; false for back_to_arranger returns to Arrangement. loop_start/loop_length/current_song_time take beats. Seeking requires stopped, non-recording transport. Other setup changes refuse recording. Arm/routing use their own track tools first. record_mode=true arms Arrangement Record and starts writing immediately if playback is running: use only when the musician requests recording and is ready; do not claim a microphone or singer was set up. Tokens tolerate normal playback progress, not changed controls. Stopping Ode does not undo a completed transport command or stop a musician's recording. Inspect native readback afterwards.",
  input: { readToken: z.string().min(1), action: z.enum(["play", "stop", "record_mode", "metronome", "punch_in", "punch_out", "loop", "back_to_arranger", "loop_start", "loop_length", "current_song_time"]), value: z.union([z.boolean(), z.number()]).optional() },
  describe: () => t("maxDaw.activityTransport"),
  async run(args, ctx) {
    ctx.signal?.throwIfAborted();
    if (!ctx.maxDaw) throw new Error(t("maxDaw.unavailable"));
    if (!ctx.exchangeId) throw new Error(t("maxDaw.invalid"));
    return ctx.maxDaw.run("transport_set", null, args, ctx.exchangeId, ctx.signal);
  },
})];
