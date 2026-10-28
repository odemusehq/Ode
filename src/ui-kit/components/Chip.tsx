import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { cx } from "./cx";
import { Tone } from "./types";
import "./Chip.css";

export interface ChipProps extends ComponentProps<"button"> {
  tone?: Tone;
  icon?: IconName;
}

/** A one-tap action, shaped as a pill. */
export function Chip({ tone = Tone.Neutral, icon, className, type = "button", children, ...rest }: ChipProps) {
  return (
    <button type={type} className={cx("ode-chip", `ode-chip--${tone}`, className)} {...rest}>
      {icon && <Icon name={icon} />}
      <span className="ode-chip__label">{children}</span>
    </button>
  );
}

export interface ChipGroupProps {
  /** Names the group for assistive technology. */
  label: string;
  children: ReactNode;
}

/** Chips that wrap onto as many rows as they need. */
export function ChipGroup({ label, children }: ChipGroupProps) {
  return (
    <div className="ode-chip-group" role="group" aria-label={label}>
      {children}
    </div>
  );
}
