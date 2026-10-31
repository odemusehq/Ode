import { z } from "zod";
import { defineTool } from "../../define";
import { nativeTarget } from "../native-target";
import { DeviceRefSchema } from "../schemas";

export const pluginReads = [defineTool({
  name: "plugin_get_presets", changes: "none",
  description: "Read a PluginDevice already loaded in this Set through Max: its reported presets with exact indices, selected index, editor state and readToken. offset pages 128 presets. This is not an installed-plugin inventory, Live Browser search, arbitrary preset-file loader or plugin manual. Some plugins report no presets or expose only configured parameters; ask the musician to load missing content in Live. Read device_get for exposed controls.",
  input: { device: DeviceRefSchema, offset: z.number().int().min(0).optional() },
  async run({ device, offset }, ctx) { const target = await nativeTarget({ device }, ctx); return target.native.run("plugin_read", target.address, { offset }, target.scope, ctx.signal); },
})];
