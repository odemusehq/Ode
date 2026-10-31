import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SettingsStore } from "../mneme/settings-store";
import type { JsonRequest } from "../services/capabilities";
import { LyricsChecker } from "../services/lyrics-checker";
import { ModelRoles } from "../services/model-roles";
import { ProviderCatalog } from "../services/provider-catalog";
import type { LyricsCheck, LyricsCheckResponse } from "../shared/lyrics";
import { LyricsSections } from "../shared/lyrics-sections";
import { MarkLayout } from "../ui/views/mark-layout";
import { LyricsMarks } from "../ui/app/lyrics-marks";
import type { OdeApi } from "../ui/app/api";

const SONG = "[Verse 1]\nI kept the window open wide\n\n[Chorus]\nso leave the light on\nwait for me\n\n[Verse 2]\nthe neighbours say\n\n[Chorus]\nso leave the light on\nwait for me";

test("Lyrics support runs on Muse Spark 1.3 at minimal effort, with its own key or the Meta key Ode holds", async () => {
  const settings = new SettingsStore(await mkdtemp(join(tmpdir(), "ode-lyrics-")), ProviderCatalog.bundled);
  const roles = new ModelRoles(settings, ProviderCatalog.bundled);
  await settings.update({ provider: "modal", model: "muse-spark-open", key: "modal-key", metaKey: "meta-key" });
  const reused = (await roles.roles()).lyrics_check;
  assert.deepEqual([reused.provider, reused.model, reused.effort, reused.apiKey], ["meta", "muse-spark-1.3", "minimal", "meta-key"]);

  const own = await settings.update({ provider: "modal", model: "muse-spark-open", lyrics: { provider: "meta", model: "muse-wonder-1.0", key: "own" } });
  assert.deepEqual(own.lyrics, { provider: "meta", model: "muse-wonder-1.0", keySet: true });
  assert.equal((await roles.roles()).lyrics_check.apiKey, "own");
  assert.ok(!JSON.stringify(own).includes("own\""));
});

test("the lyrics split into sections and join back, and a save writes the changed linked copy into the others", () => {
  const sections = LyricsSections.parse(SONG);
  assert.deepEqual(sections.map((section) => section.name), ["Verse 1", "Chorus", "Verse 2", "Chorus"]);
  assert.equal(LyricsSections.join(sections), SONG);
  assert.equal(LyricsSections.freeName(sections, "Verse 1"), "Verse 3");
  assert.equal(LyricsSections.freeName(sections, "Chorus"), "Chorus 2");

  const edited = SONG.replace(/wait for me$/, "wait up for me");
  const saved = LyricsSections.parse(LyricsSections.unifyLinked(SONG, edited));
  assert.deepEqual(saved[1]?.lines, ["so leave the light on", "wait up for me"]);
  assert.equal(LyricsSections.unifyLinked(SONG, SONG), SONG);
});

test("a whole-song check sends the strict schema, comes from the cache the second time, and says when setup or the model is missing", async () => {
  const answer: LyricsCheck = { lines: [{ words: [{ text: "inside", syllables: ["in", "side"], stress: [0, 1] }], rhyme: { letter: "A", quality: "perfect", part: "ide", sound: "aɪd" } }] };
  let configured = false;
  let failing = false;
  const requests: JsonRequest<LyricsCheck>[] = [];
  const makeModel = () => ({
    json: async (request: JsonRequest<LyricsCheck>) => {
      requests.push(request);
      if (failing) throw new Error("connect ECONNREFUSED");
      return request.parse(answer);
    },
  });
  let model = makeModel();
  const services = {
    available: async () => ({ lyrics_check: configured }),
    chat: async () => model,
  };
  const texts = { read: async () => "Mark the lyrics as sung in {accent}.", list: async () => [] };
  const checker = new LyricsChecker(services as never, texts, { maxTokens: 6000, cacheSize: 10 });

  assert.deepEqual(await checker.check(["back inside"], "uk"), { status: "setup" });
  configured = true;
  assert.deepEqual(await checker.check(["back inside"], "uk"), { status: "ok", check: answer });
  assert.deepEqual(await checker.check(["back inside"], "uk"), { status: "ok", check: answer });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.schema.additionalProperties, false);
  assert.equal(requests[0]?.system, "Mark the lyrics as sung in UK English.");
  model = makeModel();
  assert.deepEqual(await checker.check(["back inside"], "uk"), { status: "ok", check: answer });
  assert.equal(requests.length, 2, "a changed provider/model adapter must not reuse the earlier model's marks");
  configured = false;
  assert.deepEqual(await checker.check(["back inside"], "uk"), { status: "setup" });
  configured = true;
  failing = true;
  assert.equal((await checker.check(["another line"], "us")).status, "unreachable");
});

test("the marks sit on the letters of the line as typed: bars between syllables, stress, and the rhyming letters", () => {
  const line = "Back inside!";
  const check: LyricsCheck["lines"][number] = {
    words: [
      { text: "Back", syllables: ["Back"], stress: [1] },
      { text: "inside", syllables: ["in", "side"], stress: [0, 1] },
    ],
    rhyme: { letter: "A", quality: "near", part: "ide", sound: "aɪd" },
  };
  const runs = MarkLayout.runs(line, check);
  assert.equal(runs.map((run) => run.text).join(""), line);
  const side = runs.find((run) => run.text === "side");
  assert.deepEqual(side?.syllable, { barBefore: true, stressed: true });
  assert.deepEqual(side?.rhyme, [1, 4]);
  assert.equal(MarkLayout.count(check), 3);
});

test("changing the lyric model clears cached marks and pending work, and ignores replaced or disposed replies", async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    setTimeout: (run: () => void) => { timers.set(++nextTimer, run); return nextTimer; },
    clearTimeout: (id: number) => timers.delete(id),
  } });
  t.after(() => original ? Object.defineProperty(globalThis, "window", original) : Reflect.deleteProperty(globalThis, "window"));
  const runTimers = () => { const due = [...timers.values()]; timers.clear(); due.forEach((run) => run()); };
  const pending: ((answer: LyricsCheckResponse) => void)[] = [];
  const api = { checkLyrics: () => new Promise<LyricsCheckResponse>((resolve) => pending.push(resolve)) } as unknown as OdeApi;
  const marks = new LyricsMarks(api);
  const line = ["Back inside"];
  const first = { words: [], rhyme: { letter: "A", quality: "perfect" as const, part: "ide", sound: "aɪd" } };
  const second = { words: [], rhyme: { letter: "B", quality: "near" as const, part: "side", sound: "aɪd" } };
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

  marks.request(line); runTimers();
  pending[0]!({ status: "ok", check: { lines: [first] } }); await settle();
  assert.deepEqual(marks.marksFor(line), [first]);
  marks.request(["A pending verse"]);
  marks.retry();
  assert.deepEqual(marks.marksFor(line), [null]);
  assert.equal(timers.size, 0);
  marks.request(line); runTimers();
  marks.retry();
  marks.request(line); runTimers();
  assert.equal(pending.length, 3, "the new model can request a line still in flight on the old model");
  pending[1]!({ status: "unreachable", detail: "old model failure" }); await settle();
  assert.deepEqual(marks.marksFor(line), [null]);
  marks.request(line); runTimers();
  assert.equal(pending.length, 3, "an old reply cannot clear the new model's in-flight marker");
  pending[2]!({ status: "ok", check: { lines: [second] } }); await settle();
  assert.deepEqual(marks.marksFor(line), [second]);
  marks.request(["A new verse"]); runTimers();
  const beforeDispose = marks.getSnapshot();
  marks.dispose();
  pending[3]!({ status: "setup" }); await settle();
  assert.deepEqual(marks.getSnapshot(), beforeDispose);
  marks.request(line); runTimers();
  pending[4]!({ status: "ok", check: { lines: [second] } }); await settle();
  assert.deepEqual(marks.marksFor(line), [second], "React StrictMode can run effects again after cleanup");
});

test("one whole-song request preserves cross-section model labels and hides old marks while a revised song is checked", async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const timers = new Map<number, () => void>();
  let serial = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    setTimeout: (run: () => void) => { timers.set(++serial, run); return serial; },
    clearTimeout: (id: number) => timers.delete(id),
  } });
  t.after(() => original ? Object.defineProperty(globalThis, "window", original) : Reflect.deleteProperty(globalThis, "window"));
  const runTimers = () => { const due = [...timers.values()]; timers.clear(); due.forEach((run) => run()); };
  const sent: string[][] = [];
  const pending: ((answer: LyricsCheckResponse) => void)[] = [];
  const marks = new LyricsMarks({ checkLyrics: ({ lines }: { lines: string[] }) => {
    sent.push(lines); return new Promise<LyricsCheckResponse>((resolve) => pending.push(resolve));
  } } as unknown as OdeApi);
  const whole = LyricsSections.parse("[Verse]\nlight\nblue\nnight\ntrue\n\n[Chorus]\nslow\nglow\nair\ncare").flatMap((section) => section.lines.filter(LyricsSections.isSung));
  const check = { lines: [..."ABABCCDD"].map((letter) => ({ words: [], rhyme: { letter, quality: "perfect" as const, part: "", sound: "model phonetic evidence" } })) };
  marks.request(whole); marks.request(whole); runTimers();
  assert.deepEqual(sent, [whole], "both sections reach the model together in one debounced request");
  pending[0]!({ status: "ok", check }); await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(marks.marksFor(whole).map((line) => line?.rhyme.letter).join(""), "ABABCCDD");
  const revised = [...whole.slice(0, -1), "home"];
  assert.ok(marks.marksFor(revised).every((line) => line === null), "unchanged lines cannot retain earlier context's rhyme groups");
  marks.request(revised); runTimers();
  const latest = [...whole.slice(0, -1), "stone"];
  marks.request(latest); runTimers();
  pending[1]!({ status: "ok", check }); await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(marks.marksFor(latest).every((line) => line === null), "a late older-song reply is ignored");
  pending[2]!({ status: "ok", check }); await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(marks.marksFor(latest)[4]?.rhyme.letter, "C");
});
