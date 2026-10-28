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
