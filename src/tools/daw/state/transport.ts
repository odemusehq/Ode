import { t } from "../../../shared/i18n";
import { defineTool } from "../../define";

export const transportReads = [defineTool({
  name: "song_get_transport", changes: "none",
  description: "Read actual Live playback, Arrangement/Session recording, automation-recording, count-in, loop, punch, metronome, meter and Back to Arrangement states through Max, plus current beat and a readToken. Null means unavailable. Playback time is an observation, not an exact capture boundary. This does not read the audio-interface configuration, microphone permission or a plugin's internal recording state.",
  input: {},
  async run(_input, ctx) {
    ctx.signal?.throwIfAborted();
    if (!ctx.maxDaw) throw new Error(t("maxDaw.unavailable"));
    if (!ctx.exchangeId) throw new Error(t("maxDaw.invalid"));
    return ctx.maxDaw.run("transport_read", null, {}, ctx.exchangeId, ctx.signal);
  },
})];
