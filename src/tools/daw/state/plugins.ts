import { z } from "zod";
import { defineTool } from "../../define";
import { nativeTarget } from "../native-target";
import { DeviceRefSchema } from "../schemas";

export const pluginReads = [defineTool({
  name: "plugin_get_presets", changes: "none",
  description: "Read a PluginDevice already loaded in this Set through Max: its reported presets with exact indices, selected index, editor state and readToken. offset/limit page the list (default 32, maximum 128) with nextOffset. This is not an installed-plugin inventory, Live Browser search, arbitrary preset-file loader or plugin manual. Some plugins report no presets or expose only configured parameters; ask the musician to load missing content in Live. Read device_get for exposed controls.",
  input: { device: DeviceRefSchema, offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(128).optional() },
  async run({ device, ...args }, ctx) { const target = await nativeTarget({ device }, ctx); return target.native.run("plugin_read", target.address, args, target.scope, ctx.signal); },
}), defineTool({
  name: "device_get_native_info", changes: "none",
  description: "Inspect a device already in the Set through Max: actual native type/class, chain/drum-pad capabilities and the LiveAPI.info description of its children, properties and functions. offset/limit page that literal host metadata. Null means unavailable. Read device_get for exposed parameters and plugin_get_presets for reported plugin programs. This is Live's object interface, not an installed-plugin catalogue, plugin manual, hidden UI access or permission to invent a callable tool. Use existing named adapters; guide the musician through features without an exposed adapter.",
  input: { device: DeviceRefSchema, offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(12000).optional() },
  async run({ device, ...args }, ctx) { const target = await nativeTarget({ device }, ctx); return target.native.run("device_info", target.address, args, target.scope, ctx.signal); },
})];
