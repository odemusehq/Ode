import { cx } from "./cx";
import { Orientation } from "./types";
import type { CSSVariables } from "./types";
import "./Meter.css";

export interface MeterProps {
  label: string;
  /** Live's meter level, 0 to 1, as Live draws its own meters (not decibels); null when there is no reading. */
  level: number | null;
  orientation?: Orientation;
}

export function Meter({ label, level, orientation = Orientation.Horizontal }: MeterProps) {
  const value = level === null || Number.isNaN(level) ? 0 : Math.min(1, Math.max(0, level));
  const style: CSSVariables = { "--meter-level": `${value * 100}%` };

  return (
    <div className={cx("ode-meter", `ode-meter--${orientation}`)} style={style}>
      <div
        className="ode-meter__track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
        aria-valuetext={level === null ? "no reading" : `${Math.round(value * 100)}% of the meter`}
      >
        <div className="ode-meter__fill" />
      </div>
    </div>
  );
}
