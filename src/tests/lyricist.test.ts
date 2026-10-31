import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyLeadSheet } from "../shared/song";
import type { ToolContext } from "../tools/define";
import { lyricist } from "../tools/lyricist";

test("lyric work reaches the configured Lyricist with current text, exact notes and artist context without saving a draft", async () => {
  const sheet = { ...emptyLeadSheet(), title: "Open Door", lyrics: "[Chorus]\nLeave the door ajar", lyricsRevision: 3, intent: { mood: "hopeful" } };
  const notes = [{ pitch: 62, start: 0.25, duration: 1.5, velocity: 86 }];
  const calls: { role?: string; prompt?: string; options?: { system?: string; maxTokens: number; signal?: AbortSignal } } = {};
  const stopped = new AbortController();
  const ctx = {
    signal: stopped.signal,
    config: { lyricsSupport: { maxTokens: 6000 } },
    song: { songId: "song-1", read: async () => sheet },
    prefs: { effective: async () => ({ genre: "pop", pronunciation: "uk" }) },
    mneme: { recall: async () => [{ topic: "rhymes", value: "Prefer imperfect rhymes", source: "said", confidence: 1 }] },
    snapshots: { latest: null },
    services: { chat: async (role: string) => {
      calls.role = role;
      return { ask: async (prompt: string, options: typeof calls.options) => { calls.prompt = prompt; calls.options = options; return "Keep the opening; try 'Let the evening in'."; } };
    } },
  } as unknown as ToolContext;
  const result = await lyricist.run({ task: "Rewrite the chorus ending, keep the melody", notes }, ctx);
  assert.equal(calls.role, "lyrics_check");
  const sent = JSON.parse(calls.prompt!);
  assert.equal(sent.task, "Rewrite the chorus ending, keep the melody");
  assert.equal(sent.lyrics, sheet.lyrics);
  assert.equal(sent.lyricsRevision, 3);
  assert.deepEqual(sent.notes, notes);
  assert.equal(sent.preferences.pronunciation, "uk");
  assert.equal(sent.artistPreferences[0].value, "Prefer imperfect rhymes");
  assert.equal(calls.options?.signal, stopped.signal);
  assert.equal(calls.options?.maxTokens, 6000);
  assert.match((result as { answer: string }).answer, /Let the evening in/);
  assert.equal(sheet.lyricsRevision, 3);
});

test("a stopped lyric task does not read context or call a model", async () => {
  const stopped = new AbortController();
  stopped.abort();
  await assert.rejects(lyricist.run({ task: "Check this rhyme" }, { signal: stopped.signal } as ToolContext), { name: "AbortError" });
});
