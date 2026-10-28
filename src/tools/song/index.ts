import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { CreditSchema, LeadSheetSchema, type LeadSheet } from "../../shared/song";
import { defineTool, type AnyTool } from "../define";
import { historyTools } from "./history";

const PERSONALISATION_FIELDS = ["genre", "spelling", "pronunciation", "vocalRange", "loudnessTarget"] as const;

function lyricSheet(sheet: LeadSheet): string {
  const sections = sheet.sections
    .filter((section) => section.lines.length > 0)
    .map((section) => [`[${section.name}]`, ...section.lines.map((line) => line.text)].join("\n"));
  return `${sheet.title || "Untitled"}\n\n${sections.join("\n\n")}\n`;
}

export const songTools: AnyTool[] = [
  defineTool({
    name: "lead_sheet_read",
    changes: "none",
    alwaysLoad: true,
    description:
      "Read the song's lead sheet: title, what the song is about, song-level settings, tempo, key, time signature, sections (with their lyric lines and chords), links to clips and tracks Ode created (by tag), locked parts, credits and notes.",
    input: {},
    run: (_input, ctx) => ctx.song.read(),
  }),
  defineTool({
    name: "lead_sheet_update",
    changes: "memory",
    description:
      "Update the lead sheet. Give only the fields that change; each field you give replaces the old value (send the full list for sections, links, locked, credits and notes). Never change locked lines.",
    input: LeadSheetSchema.partial().shape,
    describe: (patch) => `Update the lead sheet: ${Object.keys(patch).join(", ")}.`,
    run: (patch, ctx) => ctx.song.update(patch as Partial<LeadSheet>),
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
      'Remember something about the artist. Use source "said" only when the musician told you; use "noticed" when their own material clearly shows it, with a confidence (0–1) and the evidence. Never record anything inferred from a person\'s name, gender, age or nationality.',
    input: {
      topic: z.string().min(1).describe('e.g. "vocal range", "rhyme taste", "dislikes"'),
      value: z.string().min(1),
      source: z.enum(["said", "noticed"]),
      confidence: z.number().min(0).max(1).optional(),
      evidence: z.string().optional().describe("What in the artist's material shows this"),
    },
    describe: ({ topic, value }) => `Remember about you — ${topic}: ${value}.`,
    run: ({ evidence, ...fact }, ctx) =>
      ctx.mneme.record({ ...fact, evidence: evidence ? { note: evidence, song: ctx.song.setId ?? undefined } : undefined }),
  }),
  defineTool({
    name: "memory_forget",
    changes: "memory",
    description: "Forget one thing Ode knows about the artist, by its id from memory_recall.",
    input: { id: z.string().min(1) },
    describe: () => "Forget one thing Ode knows about you.",
    run: async ({ id }, ctx) => ({ forgotten: await ctx.mneme.forget(id) }),
  }),
  defineTool({
    name: "memory_note_outcome",
    changes: "memory",
    description:
      'Count whether the musician kept or rejected a kind of suggestion (for example "near rhymes", "borrowed chords", "sparse drums"), so Ode learns their taste. Use the same habit name each time.',
    input: { habit: z.string().min(1), kept: z.boolean() },
    describe: ({ habit, kept }) => `Note that you ${kept ? "kept" : "rejected"} ${habit}.`,
    run: ({ habit, kept }, ctx) => ctx.mneme.noteOutcome(habit, kept),
  }),
  defineTool({
    name: "preferences_get",
    changes: "none",
    description:
      "Read the Personalisation settings (genre, spelling, pronunciation, vocal range, loudness target) as the musician set them or as Ode detected them, and the values in force for this song.",
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
      'Store a value Ode detected for a Personalisation setting left on "Detect": genre (text), spelling or pronunciation ("uk" or "us"), vocalRange ({ low, high } MIDI notes), loudnessTarget ({ lufs, truePeak }). Values the musician set themselves are never changed.',
    input: {
      field: z.enum(PERSONALISATION_FIELDS),
      value: z.unknown(),
      confidence: z.number().min(0).max(1),
    },
    describe: ({ field }) => `Store the detected ${field}.`,
    run: async ({ field, value, confidence }, ctx) => ctx.prefs.recordDetected(field, value as never, confidence),
  }),
  defineTool({
    name: "release_prepare",
    changes: "memory",
    description:
      "Write the release files into the project's Ode/release folder: the lyric sheet (from the lead sheet) and the credits. Cover art goes there too when created with cover_art_create. Returns the files written.",
    input: { credits: z.array(CreditSchema).optional().describe("Credits to add to the lead sheet, e.g. { role: \"Written by\", name }") },
    describe: () => "Write the release files (lyric sheet and credits).",
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
