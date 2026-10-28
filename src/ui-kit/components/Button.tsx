import type { ComponentProps } from "react";
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

/** A button with text and an optional icon; set aria-pressed for one that turns something on and off. */
export function Button({ variant = ButtonVariant.Secondary, icon, className, type = "button", children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx("ode-button", `ode-button--${variant}`, className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}
