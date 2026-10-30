import { EXTENSION_OPS } from "../shared/live";
import type { MutationReceipt } from "../shared/mutation-receipt";
import { ProductionEvidenceSchema } from "../shared/production-task";
import type { ConversationStore } from "./conversations";
import type { ProductionEvidenceVerifier } from "./production-task";
import type { SongStore, SongVersions } from "./song-store";
import { VersionNotFoundError } from "./version-history";
import type { ToolObservations } from "./tool-observations";

export interface ProductionEvidenceDeps {
  song: Pick<SongStore, "songId">;
  observations: Pick<ToolObservations, "find">;
  versions: Pick<SongVersions, "history">;
  conversations: Pick<ConversationStore, "log">;
  /** Usually the registry's find(name). Built-in bookkeeping exclusions always apply. */
  isRelevantTool?: (name: string) => boolean;
}

const HOST_AND_SONG_TOOLS = new Set<string>([...EXTENSION_OPS, "lead_sheet_read", "lead_sheet_update", "lyrics_read", "lyrics_write", "project_map_get"]);

/** Verifies factual source and scope. It does not judge the music or prove a historical result is current. */
export class ProductionEvidence {
  constructor(private readonly deps: ProductionEvidenceDeps) {}

  readonly verify: ProductionEvidenceVerifier = async (input, songId, step) => {
    const parsed = ProductionEvidenceSchema.safeParse(input);
    if (!parsed.success || this.deps.song.songId !== songId) return false;
    const evidence = parsed.data;
    const targets = [...new Set([...step.targetTags, ...evidence.targets])];
    // Capture song-bound handles before awaiting: a newly opened song must never supply an old task's evidence.
    const history = this.deps.versions.history;
    const conversation = this.deps.conversations.log(songId);
    switch (evidence.kind) {
      case "tool": {
        const [observation, exchanges] = await Promise.all([
          this.deps.observations.find(evidence.exchangeId, evidence.toolCallId),
          conversation.all(),
        ]);
        if (!observation?.ok || observation.songId !== songId || !exchanges.some((exchange) => exchange.id === evidence.exchangeId)) return false;
        if (!this.relevant(observation.name)) return false;
        // Older mix checks inferred every requested tag, including tracks they could not render.
        if (observation.name === "mix_check" && observation.targetScope !== "explicit") return false;
        return ProductionEvidence.covers(observation.targets, targets);
      }
      case "version": {
        let version;
        try { version = await history.get(evidence.versionId); }
        catch (error) { if (error instanceof VersionNotFoundError) return false; throw error; }
        const receipts = version.recovery?.receipts.filter((receipt) => ProductionEvidence.ownReceipt(receipt, songId)) ?? [];
        if (receipts.length === 0) return false;
        const actualTargets = receipts.flatMap((receipt) => {
          if (receipt.kind !== "midi-notes") return [];
          // A sheet link to a tag does not prove a write to that host object; positional refs are not guessed.
          if ("tag" in receipt.clip) return [receipt.clip.tag];
          return "tag" in receipt.clip.track ? [receipt.clip.track.tag] : [];
        });
        return ProductionEvidence.covers(actualTargets, targets);
      }
      case "musician": {
        const exchange = (await conversation.all()).find((entry) => entry.id === evidence.exchangeId);
        if (!exchange?.request.includes(evidence.quote)) return false;
        return targets.every((target) => evidence.quote.includes(target));
      }
    }
  };

  private relevant(name: string): boolean {
    if (/^(?:production_|memory_|preferences_|version_|settings_)/.test(name) || name === "ask_musician") return false;
    return this.deps.isRelevantTool?.(name) ?? HOST_AND_SONG_TOOLS.has(name);
  }

  private static covers(actual: readonly string[], required: readonly string[]): boolean {
    const covered = new Set(actual);
    return required.every((target) => covered.has(target));
  }

  private static ownReceipt(receipt: MutationReceipt, songId: string): boolean {
    if (receipt.kind === "unverified") return false;
    if (receipt.kind === "midi-notes") return true;
    if (receipt.songId !== songId) return false;
    if (receipt.kind === "lyrics") return true;
    return Object.keys(receipt.after).some((field) => !["version", "lyricsRevision", "settings"].includes(field));
  }
}
