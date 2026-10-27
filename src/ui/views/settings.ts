import type { Detectable } from "../../shared/personalisation";
import { formatPercent } from "../app/format";

/** Select values shared by the Personalisation settings, besides the settings' own values. */
export enum SettingChoice {
  Detect = "detect",
  Custom = "custom",
}

export interface SettingProps<T, R> {
  value: Detectable<T>;
  /** The value Ode uses now. */
  resolved: R;
  onChange: (value: Detectable<T>) => void;
}

/** What Ode detected for a setting left on Detect; nothing when the musician chose a value. */
export function detectionHint<T>(value: Detectable<T>, format: (detected: T) => string, fallback?: string): string | undefined {
  if (value.mode === "set") return undefined;
  if (value.detected) return `Detected: ${format(value.detected.value)}, ${formatPercent(value.detected.confidence)} confidence`;
  return fallback ? `Not detected yet, so Ode uses ${fallback}` : "Not detected yet";
}
