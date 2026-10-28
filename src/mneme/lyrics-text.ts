/** A line in square brackets, such as "[Chorus]", names a part of the song and isn't sung. */
const LABEL = /^\[[^\]]*\]$/;
const LINE_BREAK = /\r\n|\r|\n/;

/** The shared lyrics as one text: one sung line per line, blank lines between stanzas, and [labels] that aren't sung. */
export class LyricsText {
  /** Every line of the text, blank and label lines included. */
  static lines(text: string): string[] {
    return text.split(LINE_BREAK);
  }

  /** The text with "\n" between its lines, however they were broken. */
  static normalize(text: string): string {
    return LyricsText.lines(text).join("\n");
  }

  static isLabel(line: string): boolean {
    return LABEL.test(line.trim());
  }

  /** A line with words on it that isn't a label. */
  static isSung(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.length > 0 && !LABEL.test(trimmed);
  }

  /** The sung lines, without blank and label lines. */
  static sung(text: string): string[] {
    return LyricsText.lines(text)
      .filter((line) => LyricsText.isSung(line))
      .map((line) => line.trim());
  }

  /** Every line, with blank and label lines left empty, so that line i of an analysis is line i of the text. */
  static forAnalysis(text: string): string[] {
    return LyricsText.lines(text).map((line) => (LyricsText.isSung(line) ? line : ""));
  }

  /**
   * Where a line is, as a musician says it: the label it comes under and its number among that label's sung lines
   * ("Verse 1", 2), or no label and its number among the sung lines from the top.
   */
  static place(lines: readonly string[], index: number): { label: string | null; line: number } {
    let label: string | null = null;
    let line = 0;
    lines.slice(0, index + 1).forEach((text) => {
      if (LyricsText.isLabel(text)) {
        label = text.trim().slice(1, -1).trim();
        line = 0;
      } else if (LyricsText.isSung(text)) {
        line += 1;
      }
    });
    return { label, line };
  }

  /** Every line numbered from 1, as "3: I count the windows going by". */
  static numbered(text: string): string[] {
    return LyricsText.lines(text).map((line, index) => `${index + 1}: ${line}`);
  }
}
