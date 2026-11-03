import assert from "node:assert/strict";
import { test } from "node:test";
import type { JsonRequest } from "../services/capabilities";
import { emptyLeadSheet } from "../shared/song";
import type { ToolContext } from "../tools/define";
import { lyricist } from "../tools/lyrics/lyricist";

test("lyric work reaches the configured Lyricist with current text, exact notes and artist context without saving a draft", async () => {
  const sheet = { ...emptyLeadSheet(), title: "Open Door", lyrics: "[Chorus]\nLeave the door ajar", lyricsRevision: 3, intent: { mood: "hopeful" } };
  const notes = [{ pitch: 62, start: 0.25, duration: 1.5, velocity: 86 }];
  const calls: { role?: string; request?: JsonRequest<unknown> } = {};
  const stopped = new AbortController();
  const ctx = {
    signal: stopped.signal,
    config: { lyricsSupport: { maxTokens: 6000 } },
    song: { songId: "song-1", read: async () => sheet },
    prefs: { effective: async () => ({ genre: "pop", pronunciation: "uk" }) },
    mneme: { recall: async () => [{ topic: "rhymes", value: "Prefer imperfect rhymes", source: "said", confidence: 1 }] },
    snapshots: { latest: null },
    skills: { read: async (name: string, file?: string) => `Selected guidance for ${name}${file ? `/${file}` : ""}` },
    services: { chat: async (role: string) => {
      calls.role = role;
      return { json: async (request: JsonRequest<unknown>) => { calls.request = request; return request.parse({ text: "Let the evening in", explanation: "Keep the opening; replace the ending.", cautions: [] }); } };
    } },
  } as unknown as ToolContext;
  const result = await lyricist.run({ task: "Rewrite the chorus ending, keep the melody", notes, skills: ["lyrics/rhymes"], references: [{ skill: "lyrics/prosody", file: "references/craft.md" }] }, ctx);
  assert.equal(calls.role, "lyrics_check");
  const sent = JSON.parse(calls.request!.user);
  assert.equal(sent.task, "Rewrite the chorus ending, keep the melody");
  assert.equal(sent.lyrics, sheet.lyrics);
  assert.equal(sent.lyricsRevision, 3);
  assert.deepEqual(sent.notes, notes);
  assert.deepEqual(sent.guidance.map((entry: { name: string; file?: string }) => [entry.name, entry.file]), [
    ["lyrics", undefined], ["lyrics/rhymes", undefined], ["lyrics/prosody", undefined], ["lyrics/prosody", "references/craft.md"],
  ]);
  assert.equal(sent.guidance[3].instructions, "Selected guidance for lyrics/prosody/references/craft.md");
  assert.ok(!calls.request!.user.includes("references/writing.md"));
  assert.equal(sent.preferences.pronunciation, "uk");
  assert.equal(sent.artistPreferences[0].value, "Prefer imperfect rhymes");
  assert.equal(calls.request?.signal, stopped.signal);
  assert.equal(calls.request?.maxTokens, 6000);
  assert.equal(calls.request?.schema.additionalProperties, false);
  assert.equal((result as { text: string }).text, "Let the evening in");
  assert.equal(sheet.lyricsRevision, 3);
});

test("a stopped lyric task does not read context or call a model", async () => {
  const stopped = new AbortController();
  stopped.abort();
  await assert.rejects(lyricist.run({ task: "Check this rhyme" }, { signal: stopped.signal } as ToolContext), { name: "AbortError" });
});

test("a failed annotation check is a tool error instead of usable lyric data", async () => {
  const ctx = { song: { songId: "song-1", read: async () => emptyLeadSheet() }, prefs: { effective: async () => ({ pronunciation: "uk" }) },
    mneme: { recall: async () => [] }, lyricsChecker: {}, lyrics: { analyse: async () => ({ status: "unreachable", detail: "Invalid syllable interpretation" }), read: async () => ({}) } } as unknown as ToolContext;
  await assert.rejects(lyricist.run({ task: "Check the current phrase", analyse: true }, ctx), /Invalid syllable interpretation/);
});
