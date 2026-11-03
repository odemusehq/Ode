import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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

const modelReply = (check: LyricsCheck) => ({ lines: check.lines.map(line => ({ ...line, words: line.words.map(word => ({ text: word.text,
  syllables: word.syllables.map((text, at) => ({ text, wordStress: word.wordStress![at], stress: word.stress[at], ipa: word.ipa![at] })) })) })) });

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
  const answer: LyricsCheck = { lines: [{ words: [{ text: "inside", syllables: ["in", "side"], stress: [0, 1], wordStress: [0, 1], ipa: ["ɪn", "saɪd"] }], review: [], rhyme: { letter: "A", quality: "perfect", part: "ide", sound: "aɪd" } }] };
  let configured = false;
  let failing = false;
  const requests: JsonRequest<LyricsCheck>[] = [];
  const makeModel = () => ({
    json: async (request: JsonRequest<LyricsCheck>) => {
      requests.push(request);
      if (failing) throw new Error("connect ECONNREFUSED");
      return request.parse(modelReply(answer));
    },
  });
  let model = makeModel();
  const services = {
    available: async () => ({ lyrics_check: configured }),
    chat: async () => model,
  };
  const texts = { read: async () => "Mark the lyrics as sung in {accent}.", list: async () => [] };
  const checker = new LyricsChecker(services as never, texts, { maxTokens: 6000, cacheSize: 10 });

  assert.deepEqual(await checker.check(["inside"], "uk"), { status: "setup" });
  configured = true;
  assert.deepEqual(await checker.check(["inside"], "uk"), { status: "ok", check: answer });
  assert.deepEqual(await checker.check(["inside"], "uk"), { status: "ok", check: answer });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.schema.additionalProperties, false);
  assert.equal(requests[0]?.system, "Mark the lyrics as sung in UK English.");
  model = makeModel();
  assert.deepEqual(await checker.check(["inside"], "uk"), { status: "ok", check: answer });
  assert.equal(requests.length, 2, "a changed provider/model adapter must not reuse the earlier model's marks");
  configured = false;
  assert.deepEqual(await checker.check(["inside"], "uk"), { status: "setup" });
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

test("the model supplies stress and pronunciation on each syllable, preserving both stress layers", async () => {
  const word = { text: "window", syllables: [{ text: "win", wordStress: 1, stress: 0, ipa: "wɪn" }, { text: "dow", wordStress: 0, stress: 1, ipa: "doʊ" }] };
  const rhyme = { letter: "", quality: "none", part: "", sound: "" };
  const model = { json: async (request: JsonRequest<LyricsCheck>) => {
    assert.equal((request.schema as any).properties.lines.minItems, 1);
    assert.equal((request.schema as any).properties.lines.maxItems, 1);
    const fields = (request.schema as any).properties.lines.items.properties.words.items;
    assert.deepEqual(fields.required, ["text", "syllables"]);
    assert.deepEqual(fields.properties.syllables.items.required, ["text", "wordStress", "stress", "ipa"]);
    return request.parse({ lines: [{ words: [word], rhyme, review: [] }] });
  } };
  const checker = new LyricsChecker({ available: async () => ({ lyrics_check: true }), chat: async () => model } as never,
    { read: async () => "Mark {accent}.", list: async () => [] }, { maxTokens: 6000, cacheSize: 10 });
  assert.deepEqual(await checker.check(["window"], "us"), { status: "ok", check: { lines: [{ words: [{ text: "window", syllables: ["win", "dow"], wordStress: [1, 0], stress: [0, 1], ipa: ["wɪn", "doʊ"] }], rhyme, review: [] }] } });
});

test("a malformed written division identifies the word that the model must correct", async () => {
  const model = { json: async (request: JsonRequest<LyricsCheck>) => request.parse({ lines: [{ words: [{ text: "Every",
    syllables: [{ text: "Ev", wordStress: 1, stress: 1, ipa: "ɛv" }, { text: "ry", wordStress: 0, stress: 0, ipa: "ri" }] }],
    rhyme: { letter: "", quality: "none", part: "", sound: "" }, review: [] }] }) };
  const checker = new LyricsChecker({ available: async () => ({ lyrics_check: true }), chat: async () => model } as never,
    { read: async () => "Mark {accent}.", list: async () => [] }, { maxTokens: 6000, cacheSize: 10 });
  const result = await checker.check(["Every"], "us");
  assert.equal(result.status, "unreachable");
  assert.ok(result.status === "unreachable" && /Every/.test(result.detail) && /line 1/.test(result.detail));
});

test("a lyric check cannot omit source words from an otherwise valid line", async () => {
  const model = { json: async (request: JsonRequest<LyricsCheck>) => request.parse({ lines: [{ words: [{ text: "inside",
    syllables: [{ text: "in", wordStress: 0, stress: 0, ipa: "ɪn" }, { text: "side", wordStress: 1, stress: 1, ipa: "saɪd" }] }],
    rhyme: { letter: "", quality: "none", part: "", sound: "" }, review: [] }] }) };
  const checker = new LyricsChecker({ available: async () => ({ lyrics_check: true }), chat: async () => model } as never,
    { read: async () => "Mark {accent}.", list: async () => [] }, { maxTokens: 6000, cacheSize: 10 });
  for (const line of ["back inside", "inside again", "outside"]) {
    const result = await checker.check([line], "us");
    assert.equal(result.status, "unreachable");
    assert.ok(result.status === "unreachable" && /source words/.test(result.detail) && /line 1/.test(result.detail));
  }
});

test("saved lyric annotations survive a checker restart and reuse only the exact interpretation context", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-lyrics-cache-")), file = join(root, "lyrics-checks.json");
  const answer: LyricsCheck = { lines: [{ words: [{ text: "inside", syllables: ["in", "side"], stress: [0, 1], wordStress: [0, 1], ipa: ["ɪn", "saɪd"] }], review: [], rhyme: { letter: "A", quality: "perfect", part: "ide", sound: "aɪd" } }] };
  let calls = 0, identity = "model-one", instruction = "Mark {accent}.";
  const model = { json: async (request: JsonRequest<LyricsCheck>) => { calls++; await new Promise(resolve => setImmediate(resolve)); return request.parse(modelReply(answer)); } };
  const services = { available: async () => ({ lyrics_check: true }), chat: async () => model, identity: () => identity };
  const texts = { read: async () => instruction, list: async () => [] };
  const create = () => new LyricsChecker(services as never, texts, { maxTokens: 6000, cacheSize: 10 }, file);
  try {
    const first = create();
    await Promise.all([first.check(["inside"], "uk"), first.check(["inside"], "uk")]);
    assert.equal(calls, 1, "reopening during a check must share the running assessment");
    const reopened = create();
    assert.deepEqual(await reopened.cached(["inside"], "uk"), answer);
    assert.deepEqual(await reopened.check(["inside"], "uk"), { status: "ok", check: answer });
    assert.equal(calls, 1, "reopening must not ask the model again");
    assert.equal(await reopened.cached(["outside"], "uk"), undefined);
    assert.equal(await reopened.cached(["inside"], "us"), undefined);
    identity = "model-two";
    assert.equal(await reopened.cached(["inside"], "uk"), undefined);
    identity = "model-one"; instruction = "Updated interpretation {accent}.";
    assert.equal(await reopened.cached(["inside"], "uk"), undefined);
    assert.equal((JSON.parse(await readFile(file, "utf8")) as unknown[]).length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a reopened editor starts with saved whole-song marks and never flashes another text's annotations", () => {
  const check: LyricsCheck = { lines: [{ words: [], rhyme: { letter: "A", quality: "perfect", part: "ide", sound: "aɪd" } }] };
  const marks = new LyricsMarks({} as OdeApi, { lines: ["inside"], check });
  assert.deepEqual(marks.marksFor(["inside"]), check.lines);
  marks.request(["inside"]);
  marks.dispose(); marks.request(["inside"]);
  assert.deepEqual(marks.marksFor(["inside"]), check.lines, "StrictMode cleanup must retain the saved assessment");
  assert.deepEqual(marks.marksFor(["outside"]), [null]);
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
  assert.equal(pending.length, 4, "React cleanup retains completed marks instead of starting another check");
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

test("linked body updates retain the author's other whitespace and blank lines", () => {
  const before = "\n[Verse]\n  Leave this alone  \n\n\n[Chorus]\nFire\n\n\n[Chorus]\nFire\n\n";
  const edited = before.replace("Fire", "Flame");
  assert.equal(LyricsSections.unifyLinked(before, edited), edited.replace("Fire", "Flame"));
});
