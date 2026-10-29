import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { LyricsText } from "../../mneme/lyrics-text";
import { SetWording } from "../../mneme/set-diff";
import { PersonalisationOverridesSchema } from "../../shared/personalisation";
import { ClipLinkSchema, CreditSchema, IntentSchema, SectionSchema, type LeadSheet } from "../../shared/song";
import { VersionAuthor } from "../../shared/versions";
import { defineTool, type AnyTool } from "../define";
import { historyTools } from "./history";
import { SETTING_FIELDS, SettingValue } from "./settings";

/**
 * The lead sheet as lead_sheet_update changes it: everything but the format version and the lyrics, with no defaults,
 * so a field left out stays as it is.
 */
const LeadSheetPatchSchema = z
  .object({
    title: z.string(),
    intent: IntentSchema,
    settings: PersonalisationOverridesSchema,
    sections: z.array(SectionSchema),
    links: z.array(ClipLinkSchema),
    locked: z.array(z.string()),
    credits: z.array(CreditSchema),
    notes: z.array(z.string()),
  } satisfies Record<keyof Omit<LeadSheet, "version" | "lyrics" | "lyricsRevision">, z.ZodType>)
  .partial();
type LeadSheetPatch = z.infer<typeof LeadSheetPatchSchema>;

/** The lead sheet's fields in plain words, for the line shown when Ode changes them. */
const SHEET_FIELD_WORDS: Readonly<Record<keyof LeadSheetPatch, string>> = {
  title: "title",
  intent: "what the song is about",
  settings: "song settings",
  sections: "sections",
  links: "clip links",
  locked: "locked parts",
  credits: "credits",
  notes: "notes",
};

/** The lyric sheet of the release: the title, then the lyrics as they are written, labels included. */
function lyricSheet(sheet: LeadSheet): string {
  return `${sheet.title || "Untitled"}\n\n${sheet.lyrics.trim()}\n`;
}

export const songTools: AnyTool[] = [
  defineTool({
    name: "lead_sheet_read",
    changes: "none",
    alwaysLoad: true,
    description:
      "Read the song's lead sheet: title, what the song is about, song-level settings, the lyrics (one text, with its revision), sections (the song form with chords, by start beat and length), links to clips and tracks Ode created (by tag), locked parts, credits and notes. Tempo, key and time signature are Live's: read them from the project map or song_get.",
    input: {},
    run: (_input, ctx) => ctx.song.read(),
  }),
  defineTool({
    name: "lead_sheet_update",
    changes: "memory",
    description:
      "Update the lead sheet: title, intent (what the song is about), song-level settings, sections (the song form with chords), links, locked, credits and notes. Give only the fields that change; each field you give replaces the old value (send the full list for sections, links, locked, credits and notes). The lyrics are saved with lyrics_write; tempo, key and time signature are changed in Live (song_set_tempo, song_set_key, song_set_time_signature).",
    input: LeadSheetPatchSchema.shape,
    describe: (patch) => {
      const fields = (Object.keys(patch) as (keyof LeadSheetPatch)[]).filter((field) => patch[field] !== undefined);
      const words = fields.map((field) => (field === "title" && patch.title ? `title ${patch.title}` : SHEET_FIELD_WORDS[field]));
      return `Lead sheet · ${SetWording.list(words) || "no change"}`;
    },
    run: (patch, ctx) => ctx.song.update(patch),
  }),
  defineTool({
    name: "lyrics_read",
    changes: "none",
    alwaysLoad: true,
    description:
      'Read the song\'s lyrics, the one text the musician edits too: one sung line per line, a blank line between stanzas, and lines in square brackets (such as "[Chorus]") as labels that aren\'t sung. Returns { revision, lines }: every line of the text numbered from 1 ("3: I count the windows going by"), so a line is found by its number or by its label and place ("[Verse 2] line 3"). Read it right before changing the lyrics, and give its revision to lyrics_write.',
    input: {},
    run: async (_input, ctx) => {
      const lyrics = await ctx.lyrics.read();
      return { revision: lyrics.revision, lines: LyricsText.numbered(lyrics.text) };
    },
  }),
  defineTool({
    name: "lyrics_write",
    changes: "memory",
    description:
      'Save the song\'s lyrics. text: the whole new text, laid out as lyrics_read gives it (without the line numbers): one sung line per line, a blank line between stanzas, labels such as "[Chorus]" on their own lines; keep the labels and the layout unless the change is about them, change a repeated chorus in every copy, and never change what the lead sheet\'s locked list names. baseRevision: the revision of the text you edited, from lyrics_read. When the musician saved in between, both changes are merged line by line; where you both changed the same lines, the musician\'s lines are kept. Returns { revision, conflicts }: conflicts are the line numbers where the musician\'s lines were kept instead of yours (say so in your result line); when the text saved differs from what you sent, lines gives it, numbered, to write your next change from. A save edited from a revision that is too old is refused: read the lyrics again and redo the change.',
    input: {
      text: z.string().describe("The whole lyrics, one line per line"),
      baseRevision: z.number().int().min(0).describe("The revision lyrics_read gave for the text you edited"),
    },
    describe: ({ text, baseRevision }, names) => names.lyrics(text, baseRevision),
    run: async ({ text, baseRevision }, ctx) => {
      const saved = await ctx.lyrics.write(text, baseRevision, VersionAuthor.Ode);
      const result: { revision: number; conflicts: number[]; note?: string; lines?: string[] } = {
        revision: saved.revision,
        conflicts: saved.conflicts,
      };
      if (saved.conflicts.length > 0) {
        const where = `${saved.conflicts.length === 1 ? "line" : "lines"} ${SetWording.spans(saved.conflicts)}`;
        result.note = `The musician changed the same lines at the same time, so their lines were kept: ${where}.`;
      }
      if (saved.text !== LyricsText.normalize(text)) result.lines = LyricsText.numbered(saved.text);
      return result;
    },
  }),
  defineTool({
    name: "memory_recall",
    changes: "none",
    description:
      "Recall what Ode knows about the artist (vocal range, keys, tempos, chord vocabulary, lyric voice, sounds and plug-ins they like, mix preferences, dislikes), strongest first, plus how often they kept each kind of suggestion. Filter by a topic word if you like.",
    input: { topic: z.string().optional() },
    run: async ({ topic }, ctx) => ({ facts: await ctx.mneme.recall(topic), habits: await ctx.mneme.habitStrengths() }),
  }),
  defineTool({
    name: "memory_record",
    changes: "memory",
    description:
      'Remember something about the artist. Use source "said" only when the musician told you; use "noticed" when their own material clearly shows it, with a confidence (0–1) and the evidence. Never record anything inferred from a person\'s name, gender, age or nationality. Their vocal range, accent, genre and loudness target are settings: store those with preferences_set.',
    input: {
      topic: z.string().min(1).describe('e.g. "rhyme taste", "chord vocabulary", "dislikes"'),
      value: z.string().min(1),
      source: z.enum(["said", "noticed"]),
      confidence: z.number().min(0).max(1).optional(),
      evidence: z.string().optional().describe("What in the artist's material shows this"),
    },
    describe: ({ topic, value }) => `Remember about you · ${topic}: ${value}`,
    run: ({ evidence, ...fact }, ctx) =>
      ctx.mneme.record({ ...fact, evidence: evidence ? { note: evidence, song: ctx.song.songId || undefined } : undefined }),
  }),
  defineTool({
    name: "memory_forget",
    changes: "memory",
    description: "Forget one thing Ode knows about the artist, by its id from memory_recall.",
    input: { id: z.string().min(1) },
    describe: () => "Forget one thing Ode knows about you",
    run: async ({ id }, ctx) => ({ forgotten: await ctx.mneme.forget(id) }),
  }),
  defineTool({
    name: "memory_note_outcome",
    changes: "memory",
    description:
      'Count whether the musician kept or rejected a kind of suggestion (for example "near rhymes", "borrowed chords", "sparse drums"), so Ode learns their taste. Use the same habit name each time.',
    input: { habit: z.string().min(1), kept: z.boolean() },
    describe: ({ habit, kept }) => `Note that you ${kept ? "kept" : "rejected"} ${habit}`,
    run: ({ habit, kept }, ctx) => ctx.mneme.noteOutcome(habit, kept),
  }),
  defineTool({
    name: "preferences_get",
    changes: "none",
    description:
      "Read the musician's settings (genre, spelling, pronunciation, vocal range, loudness target) as they set them or as Ode detected them, and the values in force for this song.",
    input: {},
    run: async (_input, ctx) => {
      const preferences = await ctx.prefs.get();
      return { ...preferences, resolved: await ctx.prefs.effective(await ctx.song.read()) };
    },
  }),
  defineTool({
    name: "preferences_set",
    changes: "memory",
    description:
      'Store one of the musician\'s settings, used for every song: genre (text), spelling or pronunciation ("uk" or "us"), vocalRange ({ low, high } MIDI notes), loudnessTarget ({ lufs, truePeak }). source "said": the musician told you (their range, their accent, their genre, a loudness target); it becomes their own setting and replaces what was there. source "detected": you worked it out from their material, with a confidence (0–1); it is used until they say otherwise and never replaces what they said.',
    input: {
      field: z.enum(SETTING_FIELDS),
      value: z.unknown(),
      source: z.enum(["said", "detected"]),
      confidence: z.number().min(0).max(1).optional().describe("How sure you are (0–1); needed for a detected value"),
    },
    describe: ({ field, value, source }) => `${source === "said" ? "Your setting" : "Detected"} · ${SettingValue.words(field, value)}`,
    run: async ({ field, value, source, confidence }, ctx) => {
      const checked = SettingValue.check(field, value);
      if (source === "said") return ctx.prefs.setByMusician(field, checked as never);
      if (confidence === undefined) throw new Error("Give a confidence (0–1) for a detected value.");
      return ctx.prefs.recordDetected(field, checked as never, confidence);
    },
  }),
  defineTool({
    name: "release_prepare",
    changes: "memory",
    description:
      "Write the release files into the song's release folder: the lyric sheet (the title and the lyrics) and the credits. The cover art goes there too: make choices with cover_art_create and keep the musician's pick with cover_art_choose. Returns the files written.",
    input: { credits: z.array(CreditSchema).optional().describe('Credits to add to the lead sheet, e.g. { role: "Written by", name }') },
    describe: () => "Release · lyric sheet and credits",
    run: async ({ credits }, ctx) => {
      const sheet = credits ? await ctx.song.update({ credits: [...(await ctx.song.read()).credits, ...credits] }) : await ctx.song.read();
      const dir = ctx.song.releaseDir;
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "lyrics.txt"), lyricSheet(sheet), "utf8");
      await writeFile(join(dir, "credits.json"), `${JSON.stringify(sheet.credits, null, 2)}\n`, "utf8");
      return { folder: dir, files: ["lyrics.txt", "credits.json"] };
    },
  }),
  ...historyTools,
];
