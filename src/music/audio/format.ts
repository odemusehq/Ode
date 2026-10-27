/** A reading with an explicit sign for positive values, e.g. "+0.4" or "-13.2". */
export function signed(value: number, digits: number = 1): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}
