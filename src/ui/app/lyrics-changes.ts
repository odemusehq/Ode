import { diffIndices } from "node-diff3";

/** Keep unchanged spans intact so remote edits map the caret and local undo history accurately. */
export function lyricTextChanges(before: string, after: string): { from: number; to: number; insert: string }[] {
  return diffIndices(before.split(""), after.split("")).map(change => ({
    from: change.buffer1[0], to: change.buffer1[0] + change.buffer1[1],
    insert: after.slice(change.buffer2[0], change.buffer2[0] + change.buffer2[1]),
  }));
}
