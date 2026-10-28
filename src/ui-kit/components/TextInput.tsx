import type { ComponentProps } from "react";
import { cx } from "./cx";
import "./TextInput.css";

/** A one-line text box. */
export function TextInput({ className, type = "text", ...rest }: ComponentProps<"input">) {
  return <input type={type} className={cx("ode-input", className)} {...rest} />;
}
