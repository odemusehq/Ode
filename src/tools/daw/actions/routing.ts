import { z } from "zod";
import { t } from "../../../shared/i18n";
import { defineTool } from "../../define";
import { nativeTarget } from "../native-target";
import { DeviceRefSchema, TrackRefSchema } from "../schemas";

const choice = { readToken: z.string().min(1), identifier: z.union([z.string().min(1).max(1024), z.number()]).describe("Exact identifier returned by Live, preserving its string or numeric type.") };
export const routingWrites = [defineTool({
  name: "track_set_routing", changes: "set", mainAgentOnly: true,
  description: "Set one native track input/output routing choice using an exact identifier and readToken from track_get_routing. Refuses stale state, unavailable choices or active recording. Read again after a type change before choosing its channel. Routing is outside Ode's saved-state restoration; preserve the returned native before-state. No conventional routing is assumed.",
  input: { track: TrackRefSchema, ...choice, field: z.enum(["input_routing_type", "input_routing_channel", "output_routing_type", "output_routing_channel"]) },
  describe: ({ track }, names) => t("maxDaw.activityRouting", { target: names.track(track) }),
  async run({ track, ...args }, ctx) { const target = await nativeTarget({ track }, ctx); return target.native.run("track_routing_set", target.address, args, target.scope, ctx.signal); },
}), defineTool({
  name: "compressor_set_sidechain", changes: "set", mainAgentOnly: true,
  description: "Set one offered input type/channel on Live's Compressor using compressor_get_sidechain's readToken and identifier. Read again between type and channel changes. Enabling sidechain and adjusting its EQ/compression use actual device parameters separately. Refuses stale state or recording; routing is outside Ode's saved-state restoration.",
  input: { device: DeviceRefSchema, ...choice, field: z.enum(["input_routing_type", "input_routing_channel"]) },
  describe: ({ device }, names) => t("maxDaw.activityRouting", { target: names.device(device) }),
  async run({ device, ...args }, ctx) { const target = await nativeTarget({ device }, ctx); return target.native.run("compressor_routing_set", target.address, args, target.scope, ctx.signal); },
}), defineTool({
  name: "song_create_return_track", changes: "set", mainAgentOnly: true,
  description: "Create a real return track using Max's native Song.create_return_track, optionally naming it. Then read song_get/track_get, insert native effects and set sends with existing SDK tools. Refuses active recording. This does not create a group bus, effect rack return chain or automatic mix setup.",
  input: { name: z.string().min(1).max(512).optional() },
  describe: () => t("maxDaw.activityReturn"),
  async run(args, ctx) {
    ctx.signal?.throwIfAborted();
    if (!ctx.maxDaw) throw new Error(t("maxDaw.unavailable"));
    if (!ctx.exchangeId) throw new Error(t("maxDaw.invalid"));
    return ctx.maxDaw.run("return_create", null, args, ctx.exchangeId, ctx.signal);
  },
})];
