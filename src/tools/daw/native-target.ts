import { t } from "../../shared/i18n";
import type { ClipRef, DeviceRef, TrackRef } from "../../shared/live";
import type { MaxDawAddress } from "../../shared/max-daw";
import type { ToolContext } from "../define";

export async function nativeTarget(input: { track?: TrackRef; device?: DeviceRef; clip?: ClipRef }, ctx: ToolContext) {
  ctx.signal?.throwIfAborted();
  if (!ctx.maxDaw) throw new Error(t("maxDaw.unavailable"));
  if (!ctx.exchangeId) throw new Error(t("maxDaw.invalid"));
  const address = await ctx.live.extension.call<MaxDawAddress>("max_target", input);
  ctx.signal?.throwIfAborted();
  return { address, native: ctx.maxDaw, scope: ctx.exchangeId };
}
