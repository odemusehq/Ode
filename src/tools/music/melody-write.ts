import { z } from "zod";
import { KeyFinder } from "../../music/harmony/key-finder";
import { MusicalKey } from "../../music/harmony/musical-key";
import { hookNotesInRange, melodyNoteHash, writeLyricPhrases, type MelodyPhrase } from "../../music/melody/lyric-phrases";
import { Contour, MAX_DENSITY, MIN_DENSITY, Register, type MelodyPlan } from "../../music/melody/melody-plan";
import { writeMelody } from "../../music/melody/melody-writer";
import { analyzeLine } from "../../music/phonetics/line-analyzer";
import { LyricsText } from "../../mneme/lyrics-text";
import { SetLookup } from "../../server/set-lookup";
import type { Note } from "../../shared/live";
import { TYPICAL_VOCAL_RANGE } from "../../shared/personalisation";
import { RetainedHookSchema, type RetainedHook } from "../../shared/song";
import { defineTool, type ToolContext } from "../define";
import { MelodyPhraseInput, describeSyllables } from "./line-on-notes";
import { ChordsInput, KeyInput, MAX_BARS, RangeInput, SeedInput, TimeSignatureInput } from "./schemas";
import { quarterBeatsPerBar, requireTimeSignature, songDefaults } from "./song-defaults";

const MAX_MOTIF_BARS = 8;

/** Source hashes are checked against freshly read notes; a saved tag alone never proves a hook is current. */
async function resolveHooks(hooks: RetainedHook[], ctx: ToolContext): Promise<RetainedHook[]> {
  const resolved: RetainedHook[] = [];
  for (const hook of hooks) {
    if (!hook.source) { resolved.push(hook); continue; }
    const snapshot = await ctx.snapshots.read();
    const matches = new SetLookup(snapshot).allTracks.flatMap((track) => SetLookup.clipsOf(track)).filter((clip) => clip.tag === hook.source!.tag);
    if (matches.length !== 1) throw new Error(`Hook ${hook.id}: source tag ${hook.source.tag} is missing or ambiguous. Read the intended clip and update the hook explicitly.`);
    const source = await ctx.live.extension.call<{ notes: Note[] }>("midi_clip_get_notes", { clip: { tag: hook.source.tag } });
    const notes = hookNotesInRange(source.notes, hook.source.startBeat ?? 0, hook.lengthBeats);
    if (melodyNoteHash(notes) !== hook.source.noteHash.toLowerCase()) throw new Error(`Hook ${hook.id}: its source notes changed. Reconcile the chosen hook before generating from it.`);
    if (hook.notes && melodyNoteHash(hook.notes) !== hook.source.noteHash.toLowerCase()) throw new Error(`Hook ${hook.id}: retained notes and its source hash disagree. Choose which version to keep explicitly.`);
    resolved.push(RetainedHookSchema.parse({ ...hook, notes }));
  }
  return resolved;
}

export const melodyWriteTool = defineTool({
  name: "melody_write",
  description: [
    "Draft editable melody/topline/hook MIDI from a musical brief, or set lyric lines over chosen phrase spans.",
    "Inputs: bars or lengthBeats (quarter-note beats); contour; register; density; optional chords/key/range/timeSignature/seed.",
    "Lyrics without phrases use the former equal whole-bar allocation. phrases gives explicit {line (1-based supplied lyric line), startBeat, lengthBeats, motifId?, hookId?} for unequal/sub-bar spans and pickups. All clip coordinates must be nonnegative; beatOffset says where clip zero falls in the meter.",
    "A shared motifId repeats the first chosen phrase across lines with proportionally scaled timing. motifBars with lyrics repeats a shared motif of that many bars in whole statements; incompatible lengths are refused. Different words are aligned to the repeated notes, with splits and melismas reported.",
    "retainedHooks holds {id,lengthBeats,notes} or a verified source {tag,noteHash}; hookId preserves exact pitch/rhythm/performance fields and refuses a lyric that requires splitting or a span/range that cannot hold it. Revise a hook explicitly when desired; use direct note tools for ideas outside this helper.",
    "Alternatively sectionId uses the current lead-sheet composition's bound lyric phrases, chords and retained hooks. Supply clipStartBeat (Arrangement position) early enough to include pickups; stale selected lyric bindings are refused without deleting the plan.",
    "Returns {notes,noteHash,key,range,beatsPerBar,lengthBeats,phrases?,retainedHooks?,clipStartBeat?}. Each written phrase includes its actual notes, chosen syllables, split/melisma indices and alignment whose note indices address returned notes. noteHash is SHA-256 over canonical complete note fields for retaining a source. This is a draft, not listening or proof of musical quality; check and apply in Live.",
  ].join(" "),
  input: {
    bars: z.number().int().min(1).max(MAX_BARS).optional().describe("Clip length in whole bars; alternatively give lengthBeats or sectionId."),
    lengthBeats: z.number().positive().optional().describe("Explicit clip length in quarter-note beats, including pickup space."),
    beatOffset: z.number().optional().describe("Metrical position of clip beat zero; default clipStartBeat for a saved section, otherwise 0."),
    sectionId: z.string().min(1).optional().describe("Use this existing section's current composition phrase bindings and chords."),
    clipStartBeat: z.number().min(0).optional().describe("Arrangement position of the clip to create; for sectionId, move it earlier to include pickups."),
    contour: z.enum(Contour).describe("Overall shape of a newly drafted line."),
    register: z.enum(Register).describe("Where newly drafted notes sit in the range."),
    density: z.number().min(MIN_DENSITY).max(MAX_DENSITY).describe("Notes per beat for a newly drafted melody."),
    motifBars: z.number().int().min(1).max(MAX_MOTIF_BARS).optional().describe("Bars per repeated motif; works with lyrics and instrumental drafts."),
    chords: ChordsInput.optional(),
    lyrics: z.array(z.string()).optional().describe("Sung lines; explicit phrases address these from 1. Omit when using sectionId."),
    phrases: z.array(MelodyPhraseInput).min(1).optional(),
    retainedHooks: z.array(RetainedHookSchema).optional(),
    range: RangeInput.optional(),
    key: KeyInput.optional(),
    timeSignature: TimeSignatureInput.optional(),
    seed: SeedInput,
  },
  changes: "none",
  async run(input, ctx) {
    const defaults = await songDefaults(ctx);
    const signature = requireTimeSignature(input.timeSignature ?? defaults.timeSignature);
    const beatsPerBar = quarterBeatsPerBar(signature);
    const range = input.range ?? defaults.vocalRange ?? TYPICAL_VOCAL_RANGE;
    let chords = input.chords ?? [];
    let lines = input.lyrics ?? [];
    let phrases: MelodyPhrase[] | undefined = input.phrases;
    let hooks = input.retainedHooks ?? [];
    let clipStartBeat = input.clipStartBeat;
    let sectionLength: number | undefined;
    let bindings: { lyricsRevision: number; rechecked: string[] } | undefined;
    if (input.sectionId) {
      if (input.lyrics || input.phrases) throw new Error("sectionId reads its saved lyric bindings; use explicit lyrics/phrases instead when deliberately drafting another plan.");
      const sheet = await ctx.song.read();
      const matches = sheet.sections.filter((part) => part.id === input.sectionId);
      const section = matches[0];
      if (!section || matches.length !== 1) throw new Error(`Section ${input.sectionId} is missing or ambiguous in the lead sheet.`);
      const saved = sheet.composition?.phrases.filter((phrase) => phrase.sectionId === section.id) ?? [];
      if (saved.length === 0) throw new Error("That section has no saved lyric phrase spans. Plan them, or supply lyrics and phrases explicitly.");
      const textLines = sheet.lyrics.split(/\r\n|\r|\n/);
      if (saved.some((phrase) => textLines[phrase.line - 1] !== phrase.text)) {
        throw new Error("This section's lyric phrase bindings are stale. Read the current lyrics and reconcile those spans before generating.");
      }
      bindings = { lyricsRevision: sheet.lyricsRevision, rechecked: saved.filter((phrase) => phrase.lyricsRevision !== sheet.lyricsRevision).map((phrase) => phrase.id) };
      clipStartBeat ??= section.startBeat;
      sectionLength = section.startBeat + section.lengthBeats - clipStartBeat;
      lines = saved.map((phrase) => phrase.text);
      phrases = saved.map((phrase, index) => ({ line: index + 1, startBeat: section.startBeat + phrase.startBeat - clipStartBeat!,
        lengthBeats: phrase.lengthBeats, motifId: phrase.motifId, hookId: phrase.hookId }));
      if (!input.chords) chords = section.chords.map((chord) => ({ ...chord, beat: section.startBeat + chord.beat - clipStartBeat! }));
      if (!input.retainedHooks) hooks = sheet.composition?.hooks ?? [];
    } else if (input.clipStartBeat !== undefined && input.beatOffset === undefined) {
      // Explicit Arrangement placement also gives a concrete metrical origin.
      clipStartBeat = input.clipStartBeat;
    }
    const barLength = input.bars === undefined ? undefined : input.bars * beatsPerBar;
    if (barLength !== undefined && input.lengthBeats !== undefined && Math.abs(barLength - input.lengthBeats) > 1e-6) throw new Error("bars and lengthBeats name different clip lengths; choose the intended length.");
    const lengthBeats = input.lengthBeats ?? barLength ?? sectionLength;
    if (lengthBeats === undefined || lengthBeats <= 0 || !Number.isFinite(lengthBeats) || lengthBeats > MAX_BARS * beatsPerBar) throw new Error(`Give a positive clip length no longer than ${MAX_BARS} bars.`);
    if (input.motifBars !== undefined && input.motifBars * beatsPerBar > lengthBeats + 1e-6) throw new Error("motifBars exceeds the clip length. Choose the intended motif length explicitly.");
    const key = input.key ?? defaults.key ?? new KeyFinder().find(chords).spec;
    const plan: MelodyPlan = { bars: lengthBeats / beatsPerBar, lengthBeats, beatOffset: input.beatOffset ?? clipStartBeat ?? 0,
      signature, contour: input.contour, register: input.register, density: input.density, motifBars: input.motifBars, seed: input.seed, key };
    if (!phrases) lines = lines.map((line) => line.trim()).filter(LyricsText.isSung);
    else if (lines.some((line) => !LyricsText.isSung(line))) throw new Error("Explicit phrases address sung lines only; leave labels and blank lines out of lyrics.");
    if (lines.length === 0) {
      if (phrases || hooks.length > 0) throw new Error("Phrase spans and retainedHooks need sung lyric lines; write an instrumental hook directly with the note tools.");
      const notes = writeMelody(plan, chords, range);
      return { notes, noteHash: melodyNoteHash(notes), key: { ...key, name: MusicalKey.from(key).label }, range, beatsPerBar, lengthBeats, ...(clipStartBeat === undefined ? {} : { clipStartBeat }) };
    }
    if (!phrases) {
      const wholeBars = lengthBeats / beatsPerBar;
      if (!Number.isInteger(wholeBars) || lines.length > wholeBars) throw new Error("The automatic lyric allocation needs at least one whole bar per line. Give explicit phrase spans for unequal or shorter lines.");
      phrases = lines.map((_line, index) => {
        const firstBar = Math.floor(index * wholeBars / lines.length);
        return { line: index + 1, startBeat: firstBar * beatsPerBar, lengthBeats: (Math.floor((index + 1) * wholeBars / lines.length) - firstBar) * beatsPerBar };
      });
    }
    const usedHooks = new Set(phrases.flatMap((phrase) => phrase.hookId ? [phrase.hookId] : []));
    hooks = await resolveHooks(hooks.filter((hook) => usedHooks.has(hook.id)), ctx);
    const result = writeLyricPhrases(plan, chords, range, lines.map((text) => ({ text, analysis: analyzeLine(text, defaults.accent) })), phrases, hooks);
    return { ...result, accent: defaults.accent, ...(bindings ? { bindings } : {}), noteHash: melodyNoteHash(result.notes), phrases: result.phrases.map((phrase) => ({ ...phrase, syllables: describeSyllables(phrase.syllables) })),
      retainedHooks: hooks.map((hook) => ({ ...hook, noteHash: melodyNoteHash(hook.notes!) })),
      key: { ...key, name: MusicalKey.from(key).label }, range, beatsPerBar, lengthBeats, ...(clipStartBeat === undefined ? {} : { clipStartBeat }) };
  },
});
