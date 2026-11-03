/** Text written with light Markdown, without its marks, on one line. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n?/g, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*(?:[-*•]|\d+[.)]|#{1,6})\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Syllable counts of a line: "7", "7–8" for a range, "7, 9" otherwise. */
export function formatSyllableCounts(counts: readonly number[]): string {
  if (counts.length === 0) return "–";
  const low = Math.min(...counts);
  const high = Math.max(...counts);
  if (low === high) return String(low);
  const contiguous = new Set(counts).size === high - low + 1;
  return contiguous ? `${low}–${high}` : [...new Set(counts)].join(", ");
}

/** Readable rhythmic fractions; the displayed value never quantises the stored performance. */
export function formatBeatFraction(value: number): string {
  for (let denominator = 1; denominator <= 128; denominator++) {
    const numerator = Math.round(value * denominator);
    if (Math.abs(numerator / denominator - value) > 1e-9) continue;
    const whole = Math.floor(numerator / denominator), remainder = numerator % denominator;
    return remainder ? `${whole ? whole + " " : ""}${remainder}/${denominator}` : String(whole);
  }
  const whole = Math.floor(value), places = Math.min(9, String(value).split(".")[1]?.length ?? 9);
  let denominator = 10 ** places, numerator = Math.round((value - whole) * denominator), a = numerator, b = denominator;
  while (b) { const rest = a % b; a = b; b = rest; }
  numerator /= a; denominator /= a;
  return `${whole ? whole + " " : ""}${numerator}/${denominator}`;
}
