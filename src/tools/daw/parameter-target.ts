import { t } from "../../shared/i18n";
import type { ParameterRef } from "../../shared/live";
import type { ParameterReadInfo } from "../../shared/live-ops";
import { type ToolContext } from "../define";
export async function target(parameter: ParameterRef, ctx: ToolContext) {
  ctx.signal?.throwIfAborted();
  if (!ctx.maxParameters) throw new Error(t("maxParameters.unavailable"));
  if (!ctx.exchangeId) throw new Error(t("maxParameters.requestRequired"));
  const read = await ctx.live.extension.call<ParameterReadInfo>("parameter_get", { parameter });
  ctx.signal?.throwIfAborted();
  if (!read.maxAddress) throw new Error(t("maxParameters.unavailable"));
  return { address: read.maxAddress, scope: ctx.exchangeId, native: ctx.maxParameters };
}
