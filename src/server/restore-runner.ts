import type { LiveConnections } from "../shared/live";
import type { SetSnapshot } from "../shared/set-snapshot";
import type { LeadSheet } from "../shared/song";
import type { LyricsStore } from "../mneme/lyrics-store";
import { SetDiff } from "../mneme/set-diff";
import type { SongStore } from "../mneme/song-store";
import { RestorePlanner, type PlannedCall } from "./restore-planner";

export interface PutBack {
  /** False when a step failed and the rest wasn't applied. */
  complete: boolean;
  skipped: string[];
}

/**
 * Puts the Set back to a version: plans the Live calls from the Set as it is, runs them step by step, then writes back
 * the lead sheet: its lyrics as a new revision of the shared lyrics, the rest as the lead sheet itself.
 */
export class RestoreRunner {
  constructor(
    private readonly live: LiveConnections,
    private readonly song: Pick<SongStore, "update">,
    private readonly lyrics: Pick<LyricsStore, "replace">,
  ) {}

  /**
   * Plans the changes from the Set as it is to the target version and applies them step by step, then writes back
   * the version's lead sheet (lyrics, chords, sections), keeping the musician's song settings.
   */
  async putBack(current: SetSnapshot, target: SetSnapshot): Promise<PutBack> {
    const plan = new RestorePlanner(current).plan(SetDiff.between(current, target));
    const skipped = [...plan.skipped];
    for (const step of plan.steps) {
      const failed = await this.runStep(step);
      if (failed.length === 0) continue;
      skipped.push(...failed);
      if (!step.every((call) => RestorePlanner.isEdit(call.op))) {
        return { complete: false, skipped: [...skipped, "The rest of the restore was not applied."] };
      }
    }
    if (target.sheet) await this.writeSheet(target.sheet);
    return { complete: true, skipped };
  }

  /**
   * The version's lead sheet without the musician's song settings (the store keeps the lyrics as they are), then its
   * lyrics when they differ from the lyrics now, as a new revision, so an open lyrics editor takes or merges them.
   */
  private async writeSheet(sheet: LeadSheet): Promise<void> {
    const { settings: _settings, version: _version, lyrics, lyricsRevision: _revision, ...rest } = sheet;
    const stored = await this.song.update(rest);
    if (stored.lyrics !== lyrics) await this.lyrics.replace(lyrics);
  }

  /**
   * Runs one step as one undo step. Returns what failed, in words. Edits that fail as a group are tried one by one,
   * so one refused value leaves the rest to go ahead.
   */
  private async runStep(step: PlannedCall[]): Promise<string[]> {
    const failed: string[] = [];
    try {
      await this.run(step);
    } catch (error) {
      if (!step.every((call) => RestorePlanner.isEdit(call.op))) return [RestoreRunner.messageOf(error)];
      for (const call of step) {
        await this.run([call]).catch((single: unknown) => failed.push(`${call.label} (${RestoreRunner.messageOf(single)})`));
      }
    }
    return failed;
  }

  private async run(calls: PlannedCall[]): Promise<void> {
    const { extension } = this.live;
    const [only] = calls;
    if (calls.length === 1 && only) await extension.call(only.op, only.args);
    else await extension.call("apply_as_one_undo_step", { calls: calls.map(({ op, args }) => ({ op, args })) });
  }

  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
