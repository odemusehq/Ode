import type { LivePointer, LiveStatus } from "../shared/live";
import type { LeadSheet } from "../shared/song";
import type { ResolvedPersonalisation } from "../shared/personalisation";
import type { Mneme } from "./artist";
import type { PreferencesStore } from "./preferences";
import type { SongStore } from "./song-store";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** The short summary of the artist, the song and the settings given to the model before each request. */
export class ContextSummary {
  constructor(
    private readonly mneme: Mneme,
    private readonly song: SongStore,
    private readonly prefs: PreferencesStore,
    private readonly maxChars: number,
  ) {}

  async build(live: LiveStatus, pointer: LivePointer | null): Promise<string> {
    const sheet = await this.song.read();
    const settings = await this.prefs.effective(sheet);
    const sections = [
      await this.artistPart(),
      this.songPart(sheet),
      this.settingsPart(settings),
      this.livePart(live, pointer),
    ].filter(Boolean);
    const text = `<ode-context>\n${sections.join("\n\n")}\n</ode-context>`;
    return text.length <= this.maxChars ? text : `${text.slice(0, this.maxChars - 20)}\n…\n</ode-context>`;
  }

  private async artistPart(): Promise<string> {
    const facts = (await this.mneme.recall()).slice(0, 12);
    const habits = (await this.mneme.habitStrengths()).filter((habit) => habit.outcomes >= 2).slice(0, 6);
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
    const sections = sheet.sections.map((section) => `${section.name} (${section.lengthBeats} beats, ${section.lines.length} lines)`).join(", ");
    return [
      header,
      intent && `Intent: ${intent}`,
      sections && `Sections: ${sections}`,
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

  private livePart(live: LiveStatus, pointer: LivePointer | null): string {
    const state = [
      `extension ${live.extension ? "connected" : "not connected"}`,
      `Ode device ${live.device ? "connected" : "not connected"}`,
      `bridge ${live.bridge ? "connected" : "not connected"}`,
    ].join(", ");
    return [`Live: ${state}.`, pointer && `The musician pointed at: ${pointer.description}`].filter(Boolean).join("\n");
  }
}
