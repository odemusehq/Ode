import type { CSSProperties } from "react";

/** Colour role of cards, chips, notices and status marks. */
export enum Tone {
  Neutral = "neutral",
  Accent = "accent",
  Info = "info",
  Success = "success",
  Warning = "warning",
  Danger = "danger",
}

/** Inline style that may also set CSS custom properties, e.g. `{ "--roll-rows": 13 }`. */
export type CSSVariables = CSSProperties & { [name: `--${string}`]: string | number };
