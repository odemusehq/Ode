import { z } from "zod";
import { t } from "../../../shared/i18n";
import { defineTool } from "../../define";
import { nativeTarget } from "../native-target";
import { DeviceRefSchema } from "../schemas";

export const pluginWrites = [defineTool({
  name: "plugin_set_preset", changes: "set", mainAgentOnly: true,
  description: "Select an actual preset reported by plugin_get_presets for this loaded plugin. Give its current readToken and exact index; refuses changed target, preset list or state. Native plugin state changes may exceed Ode's History restoration; inspect and audition afterwards. No plugin/preset files are loaded from disk.",
  input: { device: DeviceRefSchema, readToken: z.string().min(1), index: z.number().int().min(0) },
  describe: ({ device }, names) => t("maxDaw.activityPreset", { device: names.device(device) }),
  async run({ device, ...args }, ctx) { const target = await nativeTarget({ device }, ctx); return target.native.run("plugin_preset", target.address, args, target.scope, ctx.signal); },
}), defineTool({
  name: "device_show", changes: "set", mainAgentOnly: true,
  description: "Show an existing device in Live's Device View, or set editor=true to open a loaded PluginDevice's own editor. Use this to guide a musician through a control/preset that the APIs cannot operate. This does not read the editor UI, load a plugin or discover its undocumented features.",
  input: { device: DeviceRefSchema, editor: z.boolean().optional() },
  describe: ({ device }, names) => t("maxDaw.activityShow", { device: names.device(device) }),
  async run({ device, ...args }, ctx) { const target = await nativeTarget({ device }, ctx); return target.native.run("device_show", target.address, args, target.scope, ctx.signal); },
})];
