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
import type { LyricsCheck } from "../shared/lyrics";
import { LyricsSections } from "../shared/lyrics-sections";
import { MarkLayout } from "../ui/views/mark-layout";

const SONG = "[Verse 1]\nI kept the window open wide\n\n[Chorus]\nso leave the light on\nwait for me\n\n[Verse 2]\nthe neighbours say\n\n[Chorus]\nso leave the light on\nwait for me";

test("Lyrics support runs on Muse Spark 1.3 at minimal effort, with its own key or the Meta key Ode holds", async () => {
  const settings = new SettingsStore(await mkdtemp(join(tmpdir(), "ode-lyrics-")), ProviderCatalog.bundled);
  const roles = new ModelRoles(settings, ProviderCatalog.bundled);
  await settings.update({ provider: "modal", model: "muse-spark-open", key: "modal-key", metaKey: "meta-key", services: {} });
  const reused = (await roles.roles()).lyrics_check;
  assert.deepEqual([reused.provider, reused.model, reused.effort, reused.apiKey], ["meta", "muse-spark-1.3", "minimal", "meta-key"]);

  const own = await settings.update({ provider: "modal", model: "muse-spark-open", lyrics: { provider: "meta", model: "muse-wonder-1.0", key: "own" }, services: {} });
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

test("a section check sends the strict schema, comes from the cache the second time, and says when setup or the model is missing", async () => {
  const answer: LyricsCheck = { lines: [{ words: [{ text: "inside", syllables: ["in", "side"], stress: [0, 1] }], rhyme: { letter: "A", quality: "perfect", part: "ide" } }] };
  let configured = false;
  let failing = false;
  const requests: JsonRequest<LyricsCheck>[] = [];
  const services = {
    available: async () => ({ lyrics_check: configured }),
    chat: async () => ({
      json: async (request: JsonRequest<LyricsCheck>) => {
        requests.push(request);
        if (failing) throw new Error("connect ECONNREFUSED");
        return request.parse(answer);
      },
    }),
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
    rhyme: { letter: "A", quality: "near", part: "ide" },
  };
  const runs = MarkLayout.runs(line, check);
  assert.equal(runs.map((run) => run.text).join(""), line);
  const side = runs.find((run) => run.text === "side");
  assert.deepEqual(side?.syllable, { barBefore: true, stressed: true });
  assert.deepEqual(side?.rhyme, [1, 4]);
  assert.equal(MarkLayout.count(check), 3);
});
