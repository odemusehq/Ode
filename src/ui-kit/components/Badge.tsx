import type { ReactNode } from "react";
import { Tone } from "./types";
import "./Badge.css";

export interface BadgeProps {
  tone?: Tone;
  /** Tooltip and accessible description of what the badge means. */
  title?: string;
  children: ReactNode;
}

export function Badge({ tone = Tone.Neutral, title, children }: BadgeProps) {
  return (
    <span className={`ode-badge ode-badge--${tone}`} title={title}>
      {children}
    </span>
  );
}
