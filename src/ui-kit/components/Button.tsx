import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { cx } from "./cx";
import "./Button.css";

export enum ButtonVariant {
  Primary = "primary",
  Secondary = "secondary",
  Quiet = "quiet",
  Danger = "danger",
}

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  icon?: IconName;
}

export function Button({ variant = ButtonVariant.Secondary, icon, className, type = "button", children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx("ode-button", `ode-button--${variant}`, className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export interface ButtonGroupProps {
  /** Names the group for assistive technology. */
  label: string;
  children: ReactNode;
}

/** Buttons that belong together; each gets the same width. */
export function ButtonGroup({ label, children }: ButtonGroupProps) {
  return (
    <div className="ode-button-group" role="group" aria-label={label}>
      {children}
    </div>
  );
}
