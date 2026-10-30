import { t } from "../shared/i18n";
import type { LiveConnections } from "../shared/live";
import type { SetSnapshot } from "../shared/set-snapshot";
import type { LeadSheet } from "../shared/song";
import type { LyricsStore } from "../mneme/lyrics-store";
import { SetDiff } from "../mneme/set-diff";
import type { SongStore } from "../mneme/song-store";
import { RestorePlanner, type PlannedCall } from "./restore-planner";
import { SetLookup } from "./set-lookup";
import type { ExtensionOpArgs, ExtensionOpResults } from "../shared/live-ops";
import { restoreStepExplains } from "./restore-change-scope";

export interface PutBack {
  /** False when a step failed and the rest was skipped. */
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
    private readonly song: Pick<SongStore, "update"> & Partial<Pick<SongStore, "restoreFields" | "songId">>,
    private readonly lyrics: Pick<LyricsStore, "replace"> & Partial<Pick<LyricsStore, "revert">>,
    private readonly readFresh?: () => Promise<SetSnapshot>,
  ) {}

  /**
   * Plans the changes from the Set as it is to the target version and applies them step by step, then writes back
   * the version's lead sheet (lyrics, chords, sections), keeping the musician's song settings.
   */
  async putBack(current: SetSnapshot, target: SetSnapshot): Promise<PutBack> {
    const plan = new RestorePlanner(current).plan(SetDiff.between(current, target));
    const skipped = [...plan.skipped];
    if (plan.blocked?.length) return { complete: false, skipped: [...skipped, ...plan.blocked] };
    let last = current;
    for (const step of plan.steps) {
      if (this.readFresh) {
        const fresh = await this.readFresh();
        if (SetDiff.between(last, fresh).length) return { complete: false, skipped: [...skipped, t("server.restoreRunner.theSetChangedWhileTheRestoreWas")] };
        last = fresh;
      }
      const failed = await this.runStep(step, last);
      if (failed.length === 0) {
        if (this.readFresh) {
          const actual = await this.readFresh();
          const unexpected = SetDiff.between(last, actual).filter((change) => !step.some((call) => restoreStepExplains(call, change, last, step)));
          if (unexpected.length) return { complete: false, skipped: [...skipped,
            t("server.restoreRunner.theSetChangedOutsideTheRestoreStep", { details: (unexpected.map((change) => change.label).join("; ")) })] };
          last = actual;
        }
        continue;
      }
      skipped.push(...failed);
      return { complete: false, skipped: [...skipped, t("server.restoreRunner.theRestOfTheRestoreWasSkipped")] };
    }
    if (target.sheet && current.sheet) {
      try { skipped.push(...await this.writeSheet(target.sheet, current.sheet)); }
      catch (error) { return { complete: false, skipped: [...skipped, RestoreRunner.messageOf(error)] }; }
    }
    return { complete: true, skipped };
  }

  /**
   * The version's lead sheet without the musician's song settings (the store keeps the lyrics as they are), then its
   * lyrics when they differ from the lyrics now, as a new revision, so an open lyrics editor takes or merges them.
   */
  private async writeSheet(sheet: LeadSheet, base: LeadSheet): Promise<string[]> {
    const expected: Partial<LeadSheet> = {}, replacement: Partial<LeadSheet> = {};
    const fields = new Set([...Object.keys(base), ...Object.keys(sheet)] as (keyof LeadSheet)[]);
    for (const field of fields) {
      if (["settings", "version", "lyrics", "lyricsRevision"].includes(field) || JSON.stringify(base[field]) === JSON.stringify(sheet[field])) continue;
      Object.assign(expected, { [field]: structuredClone(base[field]) });
      Object.assign(replacement, { [field]: structuredClone(sheet[field]) });
    }
    if (Object.keys(replacement).length) {
      if (!this.song.restoreFields) throw new Error(t("server.restoreRunner.guardedLeadSheetRecoveryIsUnavailableTheSheet"));
      await this.song.restoreFields(expected, replacement);
    }
    if (base.lyrics === sheet.lyrics) return [];
    if (!this.lyrics.revert) throw new Error(t("server.restoreRunner.mergingLyricRecoveryIsUnavailableTheLyrics"));
    // The inverse writer merges against the text seen before host work; later musician lines win.
    const result = await this.lyrics.revert({ kind: "lyrics", songId: this.song.songId ?? "", before: sheet.lyrics, after: base.lyrics, beforeRevision: sheet.lyricsRevision, afterRevision: base.lyricsRevision });
    return result.conflicts.length ? [t("server.restoreRunner.laterLyricEditsWereKeptOnLines", { details: (result.conflicts.join(", ")) })] : [];
  }

  /**
   * Runs a planned step once. A failed group may have partially changed the host; replaying individual writes
   * would use stale expectations and can overwrite intervening work.
   */
  private async runStep(step: PlannedCall[], before: SetSnapshot): Promise<string[]> {
    const guarded = structuredClone(step);
    try {
      if (this.readFresh) for (const call of guarded) if (call.op === "midi_clip_set_notes") {
        const args = call.args as ExtensionOpArgs["midi_clip_set_notes"];
        const expected = new SetLookup(before).clip(args.clip)?.clip.notes;
        const read = await this.live.extension.call<ExtensionOpResults["midi_clip_get_notes"]>("midi_clip_get_notes", { clip: args.clip });
        if (!read.guardedRecovery || !read.recoveryToken || JSON.stringify(read.notes) !== JSON.stringify(expected)) return [t("server.restoreRunner.theMIDIClipChangedOrTheExtension")];
        args.expected = { token: read.recoveryToken, notes: read.notes };
      }
    } catch (error) {
      return [RestoreRunner.messageOf(error)];
    }
    try {
      await this.run(guarded);
    } catch (error) {
      return [RestoreRunner.messageOf(error), t("server.restoreRunner.theFailedStepWasNotRetriedBecause")];
    }
    return [];
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
