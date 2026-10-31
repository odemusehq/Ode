import type { LineCheck } from "../../shared/lyrics";
import { errorMessage, type OdeApi } from "./api";
import { UI_CONFIG } from "./config";

export enum SupportStatus {
  Ready = "ready",
  /** Lyrics support still needs a provider or a key in Settings. */
  Setup = "setup",
  /** Lyrics support's model answered with an error, or stayed silent. */
  Unreachable = "unreachable",
}

export interface MarksSnapshot {
  status: SupportStatus;
  /** What went wrong, while Lyrics support is out of reach. */
  detail: string;
  /** Goes up whenever new marks arrive or the status changes. */
  version: number;
}

/**
 * Lyrics support's marks as the editor shows them. Each section is checked after a pause in its typing; answers are
 * kept by section and by line, so a line typed back, or one a linked copy shares, shows its marks at once.
 */
export class LyricsMarks {
  private readonly sections = new Map<string, LineCheck[]>();
  private readonly lines = new Map<string, LineCheck>();
  private readonly timers = new Map<string, number>();
  private readonly asking = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private snapshot: MarksSnapshot = { status: SupportStatus.Ready, detail: "", version: 0 };
  private generation = 0;

  constructor(private readonly api: OdeApi) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): MarksSnapshot => this.snapshot;

  /** The marks for each sung line: the section's own answer, else what is known of each line on its own. */
  marksFor(sung: readonly string[]): (LineCheck | null)[] {
    const whole = this.sections.get(LyricsMarks.key(sung));
    return sung.map((line, index) => whole?.[index] ?? this.lines.get(line) ?? null);
  }

  /** Checks a section's sung lines after a pause; a newer call for the same slot replaces the waiting one. */
  request(slot: string, sung: readonly string[]): void {
    window.clearTimeout(this.timers.get(slot));
    const key = LyricsMarks.key(sung);
    if (sung.length === 0 || this.sections.has(key)) return;
    const lines = [...sung];
    const generation = this.generation;
    this.timers.set(slot, window.setTimeout(() => {
      this.timers.delete(slot);
      void this.check(key, lines, generation);
    }, UI_CONFIG.lyricsCheckDelayMs));
  }

  /** A changed model starts with no marks or pending requests from its predecessor. */
  retry(): void {
    this.invalidate();
    this.publish(SupportStatus.Ready, "");
  }

  /** A replaced model or closed editor must not start its waiting checks. */
  dispose(): void {
    this.invalidate();
    this.listeners.clear();
  }

  private invalidate(): void {
    this.generation++;
    for (const timer of this.timers.values()) window.clearTimeout(timer);
    this.timers.clear();
    this.asking.clear();
    this.sections.clear();
    this.lines.clear();
  }

  private async check(key: string, lines: string[], generation: number): Promise<void> {
    if (generation !== this.generation || this.asking.has(key)) return;
    this.asking.add(key);
    try {
      const answer = await this.api.checkLyrics({ lines });
      if (generation !== this.generation) return;
      if (answer.status === "ok") {
        this.sections.set(key, answer.check.lines);
        answer.check.lines.forEach((line, index) => this.keepLine(lines[index] ?? "", line));
        this.publish(SupportStatus.Ready, "");
      } else if (answer.status === "setup") {
        this.publish(SupportStatus.Setup, "");
      } else {
        this.publish(SupportStatus.Unreachable, answer.detail);
      }
    } catch (error) {
      if (generation === this.generation) this.publish(SupportStatus.Unreachable, errorMessage(error));
    } finally {
      if (generation === this.generation) this.asking.delete(key);
    }
  }

  /** Keeps a line's marks, letting the oldest go past the limit. */
  private keepLine(line: string, check: LineCheck): void {
    this.lines.delete(line);
    this.lines.set(line, check);
    if (this.lines.size > UI_CONFIG.lyricsCheckLinesKept) {
      const oldest = this.lines.keys().next().value;
      if (oldest !== undefined) this.lines.delete(oldest);
    }
  }

  private publish(status: SupportStatus, detail: string): void {
    this.snapshot = { status, detail, version: this.snapshot.version + 1 };
    for (const listener of this.listeners) listener();
  }

  private static key(sung: readonly string[]): string {
    return sung.join("\n");
  }
}
