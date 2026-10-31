import { z } from "zod";
import { t } from "../../../shared/i18n";
import { defineTool } from "../../define";

export const grooveReads = [defineTool({
  name: "groove_pool_get", changes: "none",
  description: "Read existing grooves in this Live Set's native Groove Pool through Max. Returns bounded pages with opaque native ids, names, base-grid indices and native quantization/timing/velocity/random amounts; null means unavailable. These are native settings, not measured performance. This does not browse or load .agr files, extract a groove, generate timing, or commit a groove to notes. Use an actual returned id/name with clip_set_groove after clip_get_native. An empty pool requires the musician to load Ode's chosen groove in Live before it can be assigned.",
  input: { offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(64).optional() },
  async run(args, ctx) {
    ctx.signal?.throwIfAborted();
    if (!ctx.maxDaw) throw new Error(t("maxDaw.unavailable"));
    if (!ctx.exchangeId) throw new Error(t("maxDaw.invalid"));
    return ctx.maxDaw.run("groove_pool_read", null, args, ctx.exchangeId, ctx.signal);
  },
})];
