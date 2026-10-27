const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const HUNDRED = 100;
const THOUSAND = 1000;
const LARGEST_SPOKEN = 999_999;

function belowHundred(value: number): string[] {
  if (value < ONES.length) return [ONES[value] ?? ""];
  const tens = TENS[Math.floor(value / 10)] ?? "";
  const ones = value % 10;
  return ones === 0 ? [tens] : [tens, ONES[ones] ?? ""];
}

function belowThousand(value: number): string[] {
  if (value < HUNDRED) return belowHundred(value);
  const words = [ONES[Math.floor(value / HUNDRED)] ?? "", "hundred"];
  const rest = value % HUNDRED;
  return rest === 0 ? words : [...words, "and", ...belowHundred(rest)];
}

/** Spoken words for a whole number written in digits ("21" → twenty one); null when not a plain number. */
export function numberWords(text: string): string[] | null {
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value > LARGEST_SPOKEN) return null;
  if (value < THOUSAND) return belowThousand(value);
  const thousands = Math.floor(value / THOUSAND);
  const rest = value % THOUSAND;
  const words = [...belowThousand(thousands), "thousand"];
  return rest === 0 ? words : [...words, ...(rest < HUNDRED ? ["and"] : []), ...belowThousand(rest)];
}
