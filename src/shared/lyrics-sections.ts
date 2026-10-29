/** A line in square brackets, such as "[Chorus]", names the section below it and stays unsung. */
const LABEL = /^\[([^\]]*)\]$/;
const LINE_BREAK = /\r\n|\r|\n/;
const TRAILING_NUMBER = /\s+\d+$/;

/** One section of the lyrics: the name its [label] gives (null for lines before the first label) and its lines. */
export interface LyricsSection {
  name: string | null;
  lines: string[];
}

/**
 * The lyrics as sections, split at their [labels] and joined back in the same shape. Sections that share a name are
 * linked copies, kept identical by the editor and by Ode's saves.
 */
export class LyricsSections {
  /** The name a label line gives, or null for a sung or blank line. */
  static labelName(line: string): string | null {
    const match = LABEL.exec(line.trim());
    return match ? (match[1] ?? "").trim() : null;
  }

  /** A line that is sung: it holds text and sits outside square brackets. */
  static isSung(line: string): boolean {
    return line.trim() !== "" && LyricsSections.labelName(line) === null;
  }

  /** The text split at its labels; blank lines at a section's edges belong to the gaps between sections. */
  static parse(text: string): LyricsSection[] {
    const sections: LyricsSection[] = [];
    let current: LyricsSection = { name: null, lines: [] };
    for (const line of text.split(LINE_BREAK)) {
      const name = LyricsSections.labelName(line);
      if (name === null) {
        current.lines.push(line);
        continue;
      }
      sections.push(current);
      current = { name, lines: [] };
    }
    sections.push(current);
    return sections
      .map((section) => ({ name: section.name, lines: LyricsSections.trimmed(section.lines) }))
      .filter((section) => section.name !== null || section.lines.length > 0);
  }

  /** The sections joined back: each label on its own line with its lines under it, one blank line between sections. */
  static join(sections: readonly LyricsSection[]): string {
    return sections.map((section) => (section.name === null ? section.lines : [`[${section.name}]`, ...section.lines]).join("\n")).join("\n\n");
  }

  /** The name without a trailing number: "Verse 2" gives "Verse". */
  static baseName(name: string): string {
    return name.replace(TRAILING_NUMBER, "");
  }

  /**
   * The first name in the series that no section uses. A numbered name counts from 1 ("Verse 1", "Verse 2"…); a plain
   * one keeps its name while free, then counts from 2 ("Chorus", "Chorus 2"…).
   */
  static freeName(sections: readonly LyricsSection[], name: string): string {
    const used = new Set(sections.map((section) => section.name));
    const base = LyricsSections.baseName(name);
    const numbered = base !== name;
    if (!numbered && !used.has(base)) return base;
    for (let count = numbered ? 1 : 2; ; count++) {
      const candidate = `${base} ${count}`;
      if (!used.has(candidate)) return candidate;
    }
  }

  /** The lines without the blank ones at either end. */
  private static trimmed(lines: readonly string[]): string[] {
    let start = 0;
    let end = lines.length;
    while (start < end && lines[start]?.trim() === "") start++;
    while (end > start && lines[end - 1]?.trim() === "") end--;
    return lines.slice(start, end);
  }
}
