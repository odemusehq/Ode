import type { CSSProperties } from "react";

/** Colour role of badges, notices and status marks. */
export enum Tone {
  Neutral = "neutral",
  Accent = "accent",
  Info = "info",
  Success = "success",
  Warning = "warning",
  Danger = "danger",
}

export enum Orientation {
  Horizontal = "horizontal",
  Vertical = "vertical",
}

/** Inline style that may also set CSS custom properties, e.g. `{ "--meter-level": "40%" }`. */
export type CSSVariables = CSSProperties & { [name: `--${string}`]: string | number };
