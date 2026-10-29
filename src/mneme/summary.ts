import type { MemorySettings } from "../shared/config";
import type { LeadSheet } from "../shared/song";
import type { ResolvedPersonalisation } from "../shared/personalisation";
import { noteName } from "../shared/notes";
import type { Mneme } from "./artist";
import { LyricsText } from "./lyrics-text";
import type { PreferencesStore } from "./preferences";
import type { SongStore } from "./song-store";

/** The short summary of the artist, the song and the settings that goes with each request. */
export class ContextSummary {
  constructor(
    private readonly mneme: Mneme,
    private readonly song: SongStore,
    private readonly prefs: PreferencesStore,
    private readonly settings: MemorySettings,
  ) {}

  async build(): Promise<string> {
    const sheet = await this.song.read();
    const settings = await this.prefs.effective(sheet);
    const text = [await this.artistPart(), this.songPart(sheet), this.settingsPart(settings)].filter(Boolean).join("\n\n");
    const { summaryMaxChars } = this.settings;
    return text.length <= summaryMaxChars ? text : `${text.slice(0, summaryMaxChars - 1)}…`;
  }

  private async artistPart(): Promise<string> {
    const { summaryFacts, summaryHabits, habitMinOutcomes } = this.settings;
    const facts = (await this.mneme.recall()).slice(0, summaryFacts);
    const habits = (await this.mneme.habitStrengths()).filter((habit) => habit.outcomes >= habitMinOutcomes).slice(0, summaryHabits);
    const lines = facts.map((fact) => `- ${fact.topic}: ${fact.value} (${fact.source === "said" ? "you said" : `noticed, ${Math.round(fact.confidence * 100)}%`})`);
    const habitLines = habits.map((habit) => `- ${habit.name}: kept ${Math.round(habit.preference * 100)}% of the time`);
    if (lines.length === 0 && habitLines.length === 0) return "Artist: nothing known yet.";
    return ["Artist:", ...lines, ...(habitLines.length ? ["Habits:", ...habitLines] : [])].join("\n");
  }

  private songPart(sheet: LeadSheet): string {
    const header = `Song: ${sheet.title || "untitled"}`;
    const intent = Object.entries(sheet.intent)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join("; ");
    const sections = sheet.sections.map((section) => `${section.name} (${section.lengthBeats} beats)`).join(", ");
    const sung = LyricsText.sung(sheet.lyrics).length;
    return [
      header,
      intent && `Intent: ${intent}`,
      sections && `Sections: ${sections}`,
      `Lyrics: ${sung === 0 ? "none yet" : `${sung} sung ${sung === 1 ? "line" : "lines"} (revision ${sheet.lyricsRevision})`}`,
      sheet.locked.length > 0 && `Locked (never change): ${sheet.locked.join("; ")}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private settingsPart(settings: ResolvedPersonalisation): string {
    const range = settings.vocalRange ? `${noteName(settings.vocalRange.low)}–${noteName(settings.vocalRange.high)}` : "not known";
    return [
      "Settings:",
      `- genre: ${settings.genre ?? "not known"}`,
      `- spelling: ${settings.spelling.toUpperCase()} English; pronunciation: ${settings.pronunciation.toUpperCase()} English`,
      `- vocal range: ${range}`,
      `- loudness target: ${settings.loudnessTarget.lufs} LUFS integrated, ${settings.loudnessTarget.truePeak} dBTP true peak`,
    ].join("\n");
  }
}
