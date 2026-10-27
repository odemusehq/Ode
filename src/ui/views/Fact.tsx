export interface FactProps {
  label: string;
  value: string;
}

/** A label and value pair; use inside a `<dl className="facts">`. */
export function Fact({ label, value }: FactProps) {
  return (
    <div className="fact">
      <dt className="fact__label">{label}</dt>
      <dd className="fact__value">{value}</dd>
    </div>
  );
}
