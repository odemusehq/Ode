import { t } from "../../shared/i18n";

import { z } from "zod";

import { SetWording } from "../../mneme/set-diff";

import { PersonalisationOverridesSchema } from "../../shared/personalisation";
import { ClipLinkSchema, CompositionSchema, CreditSchema, IntentSchema, SectionSchema, compositionStatus, validateComposition, type LeadSheet } from "../../shared/song";

import { defineTool, type AnyTool } from "../define";

import { SETTING_FIELDS, SettingValue } from "./settings";

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
  } satisfies Record<keyof Omit<LeadSheet, "version" | "lyrics" | "lyricsRevision" | "notation">, z.ZodType>)
  .partial();
type LeadSheetPatch = z.infer<typeof LeadSheetPatchSchema>;
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
export const songMemoryTools: AnyTool[] = [
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
      const words = fields.map((field) => (field === "title" && patch.title ? t("toolActivity.title", { title: patch.title }) : SHEET_FIELD_WORDS[field]));
      return t("toolActivity.leadSheet", { value: SetWording.list(words) || "unchanged" });
    },
    run: async (patch, ctx) => {
      if (patch.composition) validateComposition(patch.composition, { ...await ctx.song.read(), ...patch });
      return ctx.song.updateWithReceipt(patch);
    },
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
      'Store one of the musician\'s settings, used for every song: genre (text), spelling or pronunciation ("uk" or "us"), vocalRange ({ low, high } MIDI notes), loudnessTarget ({ lufs, truePeak }). source "said": the musician told you (their range, their accent, their genre, a loudness target); it becomes their own setting and replaces what was there. source "detected": you worked it out from their material, with a confidence (0–1); it is used until they say otherwise, and what they said always stays.',
    input: {
      field: z.enum(SETTING_FIELDS),
      value: z.unknown(),
      source: z.enum(["said", "detected"]),
      confidence: z.number().min(0).max(1).optional().describe("How sure you are (0–1); needed for a detected value"),
    },
    describe: ({ field, value, source }) => t("toolActivity.preferenceSource", { isSource: Boolean(source === "said"), field: SettingValue.words(field, value) }),
    run: async ({ field, value, source, confidence }, ctx) => {
      const checked = SettingValue.check(field, value);
      if (source === "said") return ctx.prefs.setByMusician(field, checked as never);
      if (confidence === undefined) throw new Error("Give a confidence (0–1) for a detected value.");
      return ctx.prefs.recordDetected(field, checked as never, confidence);
    },
  })
];
