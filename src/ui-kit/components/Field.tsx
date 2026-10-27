import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import "./Field.css";

export interface FieldProps {
  /** Id of the control inside; the label points at it. */
  id: string;
  label: string;
  hint?: ReactNode;
  /** Keeps the label for assistive technology but hides it on screen. */
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
}

/** A label, a control and an optional hint underneath. */
export function Field({ id, label, hint, hideLabel, className, children }: FieldProps) {
  return (
    <div className={cx("ode-field", className)}>
      <label htmlFor={id} className={hideLabel ? "ode-visually-hidden" : "ode-field__label"}>
        {label}
      </label>
      {children}
      {hint && (
        <div id={hintId(id)} className="ode-field__hint">
          {hint}
        </div>
      )}
    </div>
  );
}

/** Id of a field's hint, for the control's aria-describedby. */
export function hintId(id: string): string {
  return `${id}-hint`;
}

export function TextInput({ className, type = "text", ...rest }: ComponentProps<"input">) {
  return <input type={type} className={cx("ode-input", className)} {...rest} />;
}

export function TextArea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cx("ode-input", "ode-input--multiline", className)} {...rest} />;
}
