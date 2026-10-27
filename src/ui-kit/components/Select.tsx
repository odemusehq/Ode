import { useId } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { Field, hintId } from "./Field";
import "./Field.css";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  hint?: ReactNode;
  disabled?: boolean;
  hideLabel?: boolean;
  className?: string;
}

export function Select<T extends string>({ label, value, options, onChange, hint, disabled, hideLabel, className }: SelectProps<T>) {
  const id = useId();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const option = options.find((candidate) => candidate.value === event.target.value);
    if (option) onChange(option.value);
  };

  return (
    <Field id={id} label={label} hint={hint} hideLabel={hideLabel} className={className}>
      <select
        id={id}
        className="ode-select"
        value={value}
        disabled={disabled}
        onChange={handleChange}
        aria-describedby={hint ? hintId(id) : undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
