import type { ComponentProps } from "react";
import { cx } from "./cx";
import "./Select.css";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<ComponentProps<"select">, "onChange"> {
  options: readonly SelectOption[];
  onChange: (value: string) => void;
}

/** A drop-down list, for choices of four or more and for lists that grow. */
export function Select({ options, onChange, className, ...rest }: SelectProps) {
  return (
    <select className={cx("ode-select", className)} onChange={(event) => onChange(event.target.value)} {...rest}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
