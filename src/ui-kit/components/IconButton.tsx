import type { ComponentProps } from "react";
import { ButtonVariant } from "./Button";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { cx } from "./cx";
import "./Button.css";

export interface IconButtonProps extends Omit<ComponentProps<"button">, "children"> {
  icon: IconName;
  /** Accessible name, also shown as a tooltip. */
  label: string;
  /** Set for on/off buttons; shows the pressed state. */
  pressed?: boolean;
  variant?: ButtonVariant;
}

export function IconButton({ icon, label, pressed, variant = ButtonVariant.Quiet, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cx("ode-button", "ode-icon-button", `ode-button--${variant}`, pressed && "ode-icon-button--pressed", className)}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
