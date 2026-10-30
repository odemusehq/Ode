import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { LyricsText } from "../../mneme/lyrics-text";
import { SetWording } from "../../mneme/set-diff";
import { CREDITS_FILE, LYRICS_FILE } from "../../shared/api";
import { PersonalisationOverridesSchema } from "../../shared/personalisation";
import { ClipLinkSchema, CompositionSchema, CreditSchema, IntentSchema, SectionSchema, compositionStatus, validateComposition, type Credit, type LeadSheet } from "../../shared/song";
import { VersionAuthor } from "../../shared/versions";
import { defineTool, type AnyTool } from "../define";
import { historyTools } from "./history";
import { hookRetainTool } from "./hooks";
import { productionTaskTools } from "./production-task";
import { audioDeliveryTools } from "./audio-delivery";
import { SETTING_FIELDS, SettingValue } from "./settings";
import { memoryTools } from "./memory";

/**
 * The lead sheet as lead_sheet_update changes it: the format version and the lyrics stay outside it, and every field is
 * optional, without a default, so a field left out stays as it is.
 */
const LeadSheetPatchSchema = z
  .object({
    title: z.string(),
    intent: IntentSchema,
    settings: PersonalisationOverridesSchema,
    sections: z.array(SectionSchema),
    links: z.array(ClipLinkSchema),
    locked: z.array(z.string()),
    strictRhymes: z.array(z.string()),
    credits: z.array(CreditSchema),
    notes: z.array(z.string()),
    composition: CompositionSchema,
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
  strictRhymes: "sections with strict rhymes",
  credits: "credits",
  notes: "notes",
  composition: "musical plan",
};

/** The sheet's credits followed by the new ones it lacks, matched by role and name in any case. */
function mergedCredits(existing: Credit[], added: Credit[]): Credit[] {
  const key = (credit: Credit) => `${credit.role.trim().toLowerCase()}\n${credit.name.trim().toLowerCase()}`;
  const merged = [...existing];
  const known = new Set(existing.map(key));
  for (const credit of added) {
    if (known.has(key(credit))) continue;
    known.add(key(credit));
    merged.push(credit);
  }
  return merged;
}

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
      "Read the song's lead sheet: title, intent, settings, lyrics and revision, sections/chords, tagged clip links, locks, strictRhymes, credits, notes and optional composition (retained hooks, lyric phrase spans and section part activity). compositionStatus reports stale/missing bindings without discarding the plan; rechecked lists phrases from older revisions whose exact text still matches at the same current line. Source-tag hook hashes remain unverified until current clip notes are compared. Composition spans use section-relative quarter-note beats, so pickups can precede the section. Tempo, key and time signature come from Live.",
    input: {},
    run: async (_input, ctx) => {
      const sheet = await ctx.song.read();
      return { ...sheet, compositionStatus: compositionStatus(sheet) };
    },
  }),
  defineTool({
    name: "lead_sheet_update",
    changes: "memory",
    description:
      "Update the lead sheet's title, intent, settings, sections/chords, links, locked, strictRhymes, credits, notes or composition. Each supplied field replaces that field; send complete lists. composition retains chosen hook notes or a source tag+SHA-256 noteHash, phrase spans bound to existing sectionId and the exact lyrics_read line/text/revision, and each section's part roles/activity/constraints. Its spans are section-relative quarter-note beats; pickups are allowed only at nonnegative Arrangement positions. A new composition must have valid current bindings; later human edits leave it visible as stale until deliberately reconciled. It is musical direction, not task execution or a requirement to use a generator. Save lyrics with lyrics_write. Tempo changes use song_set_tempo; Live's key/scale/meter remain the musician's.",
    input: LeadSheetPatchSchema.shape,
    describe: (patch) => {
      const fields = (Object.keys(patch) as (keyof LeadSheetPatch)[]).filter((field) => patch[field] !== undefined);
      const words = fields.map((field) => (field === "title" && patch.title ? `title ${patch.title}` : SHEET_FIELD_WORDS[field]));
      return `Lead sheet · ${SetWording.list(words) || "unchanged"}`;
    },
    run: async (patch, ctx) => {
      if (patch.composition) validateComposition(patch.composition, { ...await ctx.song.read(), ...patch });
      return ctx.song.updateWithReceipt(patch);
    },
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
      'Save the song\'s lyrics. text: the whole new text, laid out as lyrics_read gives it (without the line numbers): one sung line per line, a blank line between stanzas, labels such as "[Chorus]" on their own lines; keep the labels and the layout, changing them only when the change is about them, and leave what the lead sheet\'s locked list names exactly as it is. Sections with the same label are linked copies: the save writes the copy you changed into the others, so change one copy (or all of them the same way). baseRevision: the revision of the text you edited, from lyrics_read. When the musician saved in between, both changes are merged line by line; where you both changed the same lines, the musician\'s lines are kept. Returns { revision, conflicts }: conflicts are the line numbers where the musician\'s lines were kept and yours set aside (say so in your result line); when the text saved differs from what you sent, lines gives it, numbered, to write your next change from. A save edited from a revision that is too old is refused: read the lyrics again and redo the change.',
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
      return { ...result, __odeReceipts: saved.receipt ? [saved.receipt] : [] };
    },
  }),
  ...memoryTools,
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
      'Store one of the musician\'s settings, used for every song: genre (text), spelling or pronunciation ("uk" or "us"), vocalRange ({ low, high } MIDI notes), loudnessTarget ({ lufs, truePeak }). source "said": the musician told you (their range, their accent, their genre, a loudness target); it becomes their own setting and replaces what was there. source "detected": you worked it out from their material, with a confidence (0–1); it is used until they say otherwise, and what they said always stays.',
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
    input: {
      credits: z
        .array(CreditSchema)
        .optional()
        .describe('Credits to add to the lead sheet, e.g. { role: "Written by", name }; a credit the sheet already holds stays once'),
    },
    describe: () => "Release · lyric sheet and credits",
    run: async ({ credits }, ctx) => {
      const saved = credits ? await ctx.song.updateWithReceipt({ credits: mergedCredits((await ctx.song.read()).credits, credits) }) : null;
      const sheet = saved ?? await ctx.song.read();
      const dir = ctx.song.releaseDir;
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, LYRICS_FILE), lyricSheet(sheet), "utf8");
      await writeFile(join(dir, CREDITS_FILE), `${JSON.stringify(sheet.credits, null, 2)}\n`, "utf8");
      return { files: [LYRICS_FILE, CREDITS_FILE], __odeReceipts: saved?.__odeReceipts ?? [] };
    },
  }),
  ...historyTools,
  hookRetainTool,
  ...productionTaskTools,
  ...audioDeliveryTools,
];
