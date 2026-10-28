import type { ComponentProps } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { cx } from "./cx";
import "./Button.css";

export interface IconButtonProps extends Omit<ComponentProps<"button">, "children"> {
  icon: IconName;
  /** Accessible name, also shown as a tooltip since the button has no text. */
  label: string;
}

/** A quiet button that shows only an icon. */
export function IconButton({ icon, label, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} className={cx("ode-button", "ode-icon-button", "ode-button--quiet", className)} {...rest}>
      <Icon name={icon} />
    </button>
  );
}
