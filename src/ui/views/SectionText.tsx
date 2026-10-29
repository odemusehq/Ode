import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { CSSVariables } from "../../ui-kit";

export interface SectionTextProps {
  /** The section's lines as stored. */
  lines: readonly string[];
  /** Names the field for screen readers, e.g. "Chorus lyrics". */
  label: string;
  onLines: (lines: string[]) => void;
  /** Drawn behind the text, line for line, for the lines as typed. */
  renderMarks?: (lines: readonly string[]) => ReactNode;
}

/** The text without the blank lines at its end: what the stored lyrics keep of a section. */
function stored(text: string): string {
  return text.replace(/(\n[ \t]*)+$/, "");
}

/**
 * A section's lines in a plain text field, one sung line per row, with marks drawn behind the text. The field keeps
 * what the musician types, including a new empty line at the end, and takes the stored lines when they change from
 * elsewhere (Ode saved, or a linked copy was edited).
 */
export function SectionText({ lines, label, onLines, renderMarks }: SectionTextProps) {
  const text = lines.join("\n");
  const [draft, setDraft] = useState(text);

  useEffect(() => {
    setDraft((current) => (stored(current) === text ? current : text));
  }, [text]);

  const rows = draft.split("\n");
  const style: CSSVariables = { "--section-rows": rows.length };
  return (
    <div className="section-text" style={style}>
      {renderMarks && (
        <div className="section-text__marks" aria-hidden="true">
          {renderMarks(rows)}
        </div>
      )}
      <textarea
        className="section-text__field"
        aria-label={label}
        placeholder="Write the lines"
        value={draft}
        rows={rows.length}
        wrap="off"
        spellCheck={false}
        onChange={(event) => {
          setDraft(event.target.value);
          onLines(event.target.value.split("\n"));
        }}
      />
    </div>
  );
}
