import { cx } from "./cx";
import { Tone } from "./types";
import "./Dot.css";

export interface DotProps {
  tone?: Tone;
  /** What the dot means, for assistive technology; leave out when the text next to it says it. */
  label?: string;
  /** Hollow, for something missing or off. */
  hollow?: boolean;
  /** Pulses, for something in progress. */
  pulse?: boolean;
}

/** A small coloured dot: a status, or who made something. */
export function Dot({ tone = Tone.Neutral, label, hollow, pulse }: DotProps) {
  return (
    <span
      className={cx("ode-dot", `ode-dot--${tone}`, hollow && "ode-dot--hollow", pulse && "ode-dot--pulse")}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
    />
  );
}
