import { useId } from "react";
import type { ReactNode } from "react";
import "./Toggle.css";

export interface ToggleProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** An on/off switch. */
export function Toggle({ label, checked, onChange }: ToggleProps) {
  const id = useId();
  return (
    <div className="ode-toggle">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className="ode-toggle__switch"
        onClick={() => onChange(!checked)}
      >
        <span className="ode-toggle__thumb" />
      </button>
      <label htmlFor={id} className="ode-toggle__label">
        {label}
      </label>
    </div>
  );
}
