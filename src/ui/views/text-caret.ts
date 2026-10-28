import { LineDiff } from "../app/line-diff";

/** A place in a text by line and column, from 0. */
export interface CaretPosition {
  line: number;
  column: number;
}

/** The selection in a text box; start and end are the same place for a plain caret. */
export interface TextSelection {
  start: CaretPosition;
  end: CaretPosition;
}

export const TOP_OF_TEXT: TextSelection = { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };

/** Moves a caret between versions of a text by line and column, so it stays where the musician was writing. */
export class TextCaret {
  /** The selection of a text box, by line and column. */
  static selectionOf(element: HTMLTextAreaElement): TextSelection {
    return {
      start: TextCaret.positionAt(element.value, element.selectionStart),
      end: TextCaret.positionAt(element.value, element.selectionEnd),
    };
  }

  /**
   * Puts a selection made in `before` into the text box, which now holds `after`: on the same line where that line
   * is still there (found by matching the two texts line by line), otherwise on the line with the same number;
   * the column stays, up to the end of the line.
   */
  static carry(element: HTMLTextAreaElement, before: string, after: string, selection: TextSelection): TextSelection {
    const lines = LineDiff.lines(after);
    const { beforeToAfter } = new LineDiff(LineDiff.lines(before), lines).alignment();
    const carried = { start: TextCaret.move(selection.start, beforeToAfter, lines), end: TextCaret.move(selection.end, beforeToAfter, lines) };
    element.setSelectionRange(TextCaret.offsetOf(lines, carried.start), TextCaret.offsetOf(lines, carried.end));
    return carried;
  }

  private static positionAt(text: string, offset: number): CaretPosition {
    const before = text.slice(0, offset);
    const lineStart = before.lastIndexOf("\n") + 1;
    return { line: before.split("\n").length - 1, column: offset - lineStart };
  }

  private static move(position: CaretPosition, beforeToAfter: readonly number[], lines: readonly string[]): CaretPosition {
    const matched = beforeToAfter[position.line] ?? -1;
    const line = Math.max(0, Math.min(matched >= 0 ? matched : position.line, lines.length - 1));
    return { line, column: Math.min(position.column, (lines[line] ?? "").length) };
  }

  private static offsetOf(lines: readonly string[], position: CaretPosition): number {
    let offset = 0;
    for (let index = 0; index < position.line; index += 1) offset += (lines[index] ?? "").length + 1;
    return offset + position.column;
  }
}
