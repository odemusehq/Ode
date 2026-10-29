import { cx } from "./cx";
import { Tone } from "./types";
import "./Dot.css";

export interface DotProps {
  tone?: Tone;
}

/** A small coloured dot beside text that says what it means, such as who made a version. */
export function Dot({ tone = Tone.Neutral }: DotProps) {
  return <span className={cx("ode-dot", `ode-dot--${tone}`)} aria-hidden="true" />;
}
