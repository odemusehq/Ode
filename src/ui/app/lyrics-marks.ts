import type { LineCheck, LyricsCheck } from "../../shared/lyrics";
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
  detail: string;
  version: number;
}

/** One debounced whole-song assessment; rhyme letters never come from a different song context. */
export class LyricsMarks {
  private checked: { key: string; lines: LineCheck[] } | null = null;
  private activeKey: string | null = null;
  private timer: number | undefined;
  private asking = false;
  private readonly listeners = new Set<() => void>();
  private snapshot: MarksSnapshot = { status: SupportStatus.Ready, detail: "", version: 0 };
  private generation = 0;

  constructor(private readonly api: OdeApi, initial?: { lines: readonly string[]; check: LyricsCheck }) {
    if (initial) this.checked = { key: LyricsMarks.key(initial.lines), lines: initial.check.lines };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): MarksSnapshot => this.snapshot;

  /** Only the exact whole input can reuse marks; unchanged lines do not carry old rhyme identities. */
  marksFor(sung: readonly string[]): (LineCheck | null)[] {
    const lines = this.checked?.key === LyricsMarks.key(sung) ? this.checked.lines : [];
    return sung.map((_line, index) => lines[index] ?? null);
  }

  request(sung: readonly string[]): void {
    const key = LyricsMarks.key(sung);
    if (this.activeKey === key && (this.timer !== undefined || this.asking || this.checked?.key === key)) return;
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    this.activeKey = key;
    this.asking = false;
    const generation = ++this.generation;
    if (!sung.length || this.checked?.key === key) return;
    const lines = [...sung];
    this.timer = window.setTimeout(() => {
      this.timer = undefined;
      void this.check(key, lines, generation);
    }, UI_CONFIG.lyricsCheckDelayMs);
  }

  retry(): void {
    this.invalidate();
    this.checked = null;
    this.publish(SupportStatus.Ready, "");
  }

  dispose(): void {
    this.invalidate();
    this.listeners.clear();
  }

  private invalidate(): void {
    this.generation++;
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    this.asking = false;
    this.activeKey = null;
  }

  private async check(key: string, lines: string[], generation: number): Promise<void> {
    if (generation !== this.generation) return;
    this.asking = true;
    try {
      const answer = await this.api.checkLyrics({ lines });
      if (generation !== this.generation) return;
      if (answer.status === "ok") {
        this.checked = { key, lines: answer.check.lines };
        this.publish(SupportStatus.Ready, "");
      } else if (answer.status === "setup") {
        this.publish(SupportStatus.Setup, "");
      } else {
        this.publish(SupportStatus.Unreachable, answer.detail);
      }
    } catch (error) {
      if (generation === this.generation) this.publish(SupportStatus.Unreachable, errorMessage(error));
    } finally {
      if (generation === this.generation) this.asking = false;
    }
  }

  private publish(status: SupportStatus, detail: string): void {
    this.snapshot = { status, detail, version: this.snapshot.version + 1 };
    for (const listener of this.listeners) listener();
  }

  private static key(sung: readonly string[]): string { return JSON.stringify(sung); }
}
