const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const HUNDRED = 100;
const THOUSAND = 1000;
const MILLION = 1_000_000;
const LARGEST_SPOKEN = 999_999_999;
/** Years sung in pairs ("nineteen seventy-five", "twenty twenty-five"); 2000–2009 keep the thousand reading. */
const PAIRED_YEARS: readonly [number, number][] = [
  [1100, 1999],
  [2010, 2099],
];

/** How a whole number written in digits is said, for counting and spelling its syllables. */
export class NumberReading {
  /**
   * The ways the number can be said, the likeliest first: a year in pairs ("1975" → nineteen seventy five), then the
   * full reading (one thousand nine hundred and seventy five). Null when the text is something other than a plain number.
   */
  static readings(text: string): string[][] | null {
    if (!/^\d+$/.test(text)) return null;
    const value = Number(text);
    if (!Number.isSafeInteger(value) || value > LARGEST_SPOKEN) return null;
    const full = NumberReading.full(value);
    const year = NumberReading.year(value);
    return year ? [year, full] : [full];
  }

  /** The year reading, for the years sung in pairs. */
  private static year(value: number): string[] | null {
    if (!PAIRED_YEARS.some(([first, last]) => value >= first && value <= last)) return null;
    const century = NumberReading.belowHundred(Math.floor(value / HUNDRED));
    const rest = value % HUNDRED;
    if (rest === 0) return [...century, "hundred"];
    return rest < 10 ? [...century, "oh", ...NumberReading.belowHundred(rest)] : [...century, ...NumberReading.belowHundred(rest)];
  }

  private static full(value: number): string[] {
    if (value < THOUSAND) return NumberReading.belowThousand(value);
    if (value < MILLION) return NumberReading.withUnit(value, THOUSAND, "thousand");
    return NumberReading.withUnit(value, MILLION, "million");
  }

  /** "two thousand and five", "three million four hundred thousand": the count of the unit, then what is left. */
  private static withUnit(value: number, unit: number, name: string): string[] {
    const count = Math.floor(value / unit);
    const rest = value % unit;
    const words = [...NumberReading.full(count), name];
    if (rest === 0) return words;
    return [...words, ...(rest < HUNDRED ? ["and"] : []), ...NumberReading.full(rest)];
  }

  private static belowHundred(value: number): string[] {
    if (value < ONES.length) return [ONES[value] ?? ""];
    const tens = TENS[Math.floor(value / 10)] ?? "";
    const ones = value % 10;
    return ones === 0 ? [tens] : [tens, ONES[ones] ?? ""];
  }

  private static belowThousand(value: number): string[] {
    if (value < HUNDRED) return NumberReading.belowHundred(value);
    const words = [ONES[Math.floor(value / HUNDRED)] ?? "", "hundred"];
    const rest = value % HUNDRED;
    return rest === 0 ? words : [...words, "and", ...NumberReading.belowHundred(rest)];
  }
}
