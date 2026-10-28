import type { MelodySetting } from "../shared/lyrics";
import type { LeadSheet, Section } from "../shared/song";
import { analyzeLyrics } from "../music";
import { MelodyFitter } from "../music/prosody/melody-fitter";
import { Meter } from "../music/prosody/meter";
import type { PreferencesStore } from "../mneme/preferences";
import { SetLookup, type FoundClip } from "./set-lookup";
import type { SnapshotReader } from "./snapshot-reader";

/** Lead-sheet links whose role names the melody. */
const MELODY_ROLE = /melody|topline|vocal|lead/i;

/** Set to melody couldn't run; the message says what the musician can do. */
export class MelodyError extends Error {}

/**
 * "Set to melody" in the Lyrics tab: a section's lines under the notes of the melody clip, which is the clip
 * selected in Live, or else a clip the lead sheet links as the melody.
 */
export class MelodySettings {
  constructor(
    private readonly reader: SnapshotReader,
    private readonly prefs: PreferencesStore,
  ) {}

  async forSection(sectionId: string): Promise<MelodySetting> {
    const snapshot = await this.reader.read();
    const sheet = snapshot.sheet;
    const section = sheet?.sections.find((candidate) => candidate.id === sectionId);
    if (!sheet || !section) throw new MelodyError("That section isn't in the lead sheet any more.");
    const found = MelodySettings.melodyClip(new SetLookup(snapshot), sheet, section);
    if (!found) throw new MelodyError("Select the clip with the melody in Live first.");
    const notes = MelodyFitter.melodyIn(found.clip, found.arranged, section.startBeat, section.lengthBeats);
    if (notes.length === 0) throw new MelodyError(`The selected clip has no notes in ${section.name}.`);
    const accent = (await this.prefs.effective(sheet)).pronunciation;
    const analysis = analyzeLyrics(section.lines.map((line) => line.text), accent);
    const lines = section.lines.flatMap((line, index) => {
      const lineAnalysis = analysis.lines[index];
      return lineAnalysis ? [{ id: line.id, text: line.text, analysis: lineAnalysis }] : [];
    });
    const { numerator, denominator } = snapshot.transport.signature;
    return {
      section: section.id,
      clip: `${found.track.name} · clip ${found.clip.name || "without a name"}`,
      lengthBeats: section.lengthBeats,
      lines: new MelodyFitter(new Meter(numerator, denominator)).fit(lines, notes, section.lengthBeats),
    };
  }

  /** The selected MIDI clip when it has notes; else a clip, or a track's Arrangement clip in the section, linked as the melody. */
  private static melodyClip(lookup: SetLookup, sheet: LeadSheet, section: Section): FoundClip | undefined {
    const selected = lookup.snapshot.selection.clip ? lookup.clip(lookup.snapshot.selection.clip) : undefined;
    if (selected?.clip.kind === "midi" && (selected.clip.notes?.length ?? 0) > 0) return selected;
    const end = section.startBeat + section.lengthBeats;
    for (const link of sheet.links.filter((candidate) => MELODY_ROLE.test(candidate.role))) {
      const clip = lookup.clip({ tag: link.tag });
      if (clip?.clip.kind === "midi") return clip;
      const track = lookup.track({ tag: link.tag });
      const arranged = track && SetLookup.arrangedClips(track).find((candidate) => candidate.kind === "midi" && candidate.startTime < end && candidate.endTime > section.startBeat);
      if (track && arranged) return { track, clip: arranged, arranged: true };
    }
    return undefined;
  }
}
