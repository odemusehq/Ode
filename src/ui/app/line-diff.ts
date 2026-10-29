import { UI_CONFIG } from "./config";

/** Lines that changed in one place: the old lines and the new lines that took their place. */
export interface LineHunk {
  removed: string[];
  added: string[];
}

/** For each line of either text, the index of the same line in the other text, or -1 when it is missing. */
export interface LineAlignment {
  beforeToAfter: number[];
  afterToBefore: number[];
}

const LINE_BREAK = /\r?\n/;

/** Compares two texts line by line through the longest sequence of lines they share, in order. */
export class LineDiff {
  /** Index pairs [before, after] of the shared lines, in order. */
  private readonly shared: [number, number][];

  constructor(
    readonly before: readonly string[],
    readonly after: readonly string[],
  ) {
    this.shared = LineDiff.sharedLines(before, after);
  }

  /** The lines of a text; a text ending with a line break has an empty last line. */
  static lines(text: string): string[] {
    return text.split(LINE_BREAK);
  }

  alignment(): LineAlignment {
    const beforeToAfter = new Array<number>(this.before.length).fill(-1);
    const afterToBefore = new Array<number>(this.after.length).fill(-1);
    for (const [before, after] of this.shared) {
      beforeToAfter[before] = after;
      afterToBefore[after] = before;
    }
    return { beforeToAfter, afterToBefore };
  }

  /** Each place where the texts differ, in order. */
  hunks(): LineHunk[] {
    const hunks: LineHunk[] = [];
    let before = 0;
    let after = 0;
    for (const [nextBefore, nextAfter] of [...this.shared, [this.before.length, this.after.length] as const]) {
      if (nextBefore > before || nextAfter > after) {
        hunks.push({ removed: this.before.slice(before, nextBefore), added: this.after.slice(after, nextAfter) });
      }
      before = nextBefore + 1;
      after = nextAfter + 1;
    }
    return hunks;
  }

  private static sharedLines(before: readonly string[], after: readonly string[]): [number, number][] {
    let start = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
    let endBefore = before.length;
    let endAfter = after.length;
    while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
      endBefore -= 1;
      endAfter -= 1;
    }
    const pairs: [number, number][] = [];
    for (let index = 0; index < start; index += 1) pairs.push([index, index]);
    pairs.push(...LineDiff.longestShared(before.slice(start, endBefore), after.slice(start, endAfter), start));
    for (let offset = 0; endBefore + offset < before.length; offset += 1) pairs.push([endBefore + offset, endAfter + offset]);
    return pairs;
  }

  /** The longest common subsequence of two runs of lines that both start at `offset` in their texts. */
  private static longestShared(before: readonly string[], after: readonly string[], offset: number): [number, number][] {
    const rows = before.length;
    const columns = after.length;
    if (rows === 0 || columns === 0 || rows * columns > UI_CONFIG.lineDiffMaxCells) return [];
    const width = columns + 1;
    // lengths[row * width + column]: how many lines before[row..] and after[column..] share, in order.
    const lengths = new Int32Array((rows + 1) * width);
    for (let row = rows - 1; row >= 0; row -= 1) {
      for (let column = columns - 1; column >= 0; column -= 1) {
        lengths[row * width + column] =
          before[row] === after[column]
            ? (lengths[(row + 1) * width + column + 1] ?? 0) + 1
            : Math.max(lengths[(row + 1) * width + column] ?? 0, lengths[row * width + column + 1] ?? 0);
      }
    }
    const pairs: [number, number][] = [];
    let row = 0;
    let column = 0;
    while (row < rows && column < columns) {
      if (before[row] === after[column]) {
        pairs.push([offset + row, offset + column]);
        row += 1;
        column += 1;
      } else if ((lengths[(row + 1) * width + column] ?? 0) >= (lengths[row * width + column + 1] ?? 0)) {
        row += 1;
      } else {
        column += 1;
      }
    }
    return pairs;
  }
}
