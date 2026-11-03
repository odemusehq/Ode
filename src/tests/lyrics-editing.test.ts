import assert from "node:assert/strict";
import { test } from "node:test";
import { EditorState, Transaction } from "@codemirror/state";
import { history, undo } from "@codemirror/commands";
import { lyricTextChanges } from "../ui/app/lyrics-changes";

test("remote lyric edits retain local undo in the unchanged middle of the document", () => {
  let state = EditorState.create({ doc: "A\nB\nC", extensions: [history()] });
  state = state.update({ changes: { from: 3, insert: "!" } }).state;
  state = state.update({ changes: lyricTextChanges(state.doc.toString(), "AA\nB!\nCC"), annotations: Transaction.addToHistory.of(false) }).state;
  const undone = undo({ state, dispatch: transaction => { state = transaction.state; } });
  assert.equal(undone, true);
  assert.equal(state.doc.toString(), "AA\nB\nCC");
});
