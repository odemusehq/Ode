import { t } from "../shared/i18n";
import type { OdeConfig } from "../shared/config";
import type { LiveConnections } from "../shared/live";
import { ResultKind, type UiEvent } from "../shared/events";
import { Mode } from "../shared/personalisation";
import { VersionAuthor } from "../shared/versions";
import { ProjectMap } from "../mneme/project-map";
import type { PreferencesStore } from "../mneme/preferences";
import type { SongStore, SongVersions } from "../mneme/song-store";
import type { ContextSummary } from "../mneme/summary";
import type { OdeRequest, RequestLifecycle } from "../harness/session";
import type { SelectionState } from "./selection";
import type { SnapshotReader } from "./snapshot-reader";
import { VersionRecorder, type RecordedVersion } from "./version-recorder";
import type { MutationReceipt } from "../shared/mutation-receipt";
import type { ProductionTaskStore } from "../mneme/production-task";
import { markPendingObservation } from "../mneme/pending-observation";

export interface RequestContextDeps {
  config: OdeConfig;
  live: LiveConnections;
  song: SongStore;
  reader: SnapshotReader;
  recorder: VersionRecorder;
  versions: SongVersions;
  summary: ContextSummary;
  prefs: PreferencesStore;
  selection: SelectionState;
  emit: (event: UiEvent) => void;
  production?: Pick<ProductionTaskStore, "read">;
}

const MODE_NOTES: Record<Mode, string> = {
  [Mode.Auto]:
    "Mode: Auto. Change what you are sure of. Ask (ask_musician) only when what the musician wants is unclear, and before deleting a part or rewriting a whole section.",
  [Mode.Manual]: "Mode: Manual. Musical and settings changes wait for the musician to Apply or Skip. Maintain the artist's local mneme database quietly as relevant evidence appears.",
};

/**
 * Everything around one request. Before it: read the Set, save the musician's hand edits as a version,
 * and build the hidden context (map, hand edits, mode, selection). After it: save Ode's change as a
 * version and show the result line. Why? is a reply request: it only explains, with the Set left unread and
 * unsaved; its answer goes under the result line.
 */
export class RequestContext implements RequestLifecycle {
  /** Per song, when its previous request read the Set; hand edits saved after it belong to the next request. */
  private readonly lastRequestAt = new Map<string, string>();

  constructor(private readonly deps: RequestContextDeps) {}

  /** Persist uncertainty before capture, so a closed/disconnected host cannot turn it into claimed hand edits. */
  async recover(interruptedRequests: readonly string[] = []): Promise<void> {
    if (interruptedRequests.length) await markPendingObservation(this.deps.song.dataDir, interruptedRequests);
    try { await this.flushPending(); }
    catch (error) {
      this.deps.emit({ type: "error", message: t("server.requestContext.interruptedChangesRemainUnverifiedOdeWillInspect", { message: (error instanceof Error ? error.message : String(error)) }) });
    }
  }

  /** Throws "Ode can't read the Set: …" when the Set is unreadable; the history then stays as it is. */
  async prepare(request: OdeRequest): Promise<{ hiddenContext: string }> {
    if (request.reply) return { hiddenContext: await this.replyContext(request.reply.versionId) };
    await this.flushPending();
    const song = this.deps.song.songId;
    const since = this.lastRequestAt.get(song) ?? (await this.lastOdeVersionTime());
    const recorded: RecordedVersion = request.again
      ? { snapshot: await this.deps.reader.read(), version: null, changes: [] }
      : await this.deps.recorder.handEdits();
    this.lastRequestAt.set(song, recorded.version?.time ?? new Date().toISOString());
    const parts = [
      await this.deps.summary.build(request.text),
      await this.productionPart(),
      MODE_NOTES[await this.deps.prefs.mode()],
      this.selectionPart(),
      request.again ? await this.againPart() : await this.handEditsPart(recorded, since),
      `Project map:\n${ProjectMap.encode(recorded.snapshot, this.deps.config.memory.mapMaxChars)}`,
    ].filter(Boolean);
    return { hiddenContext: RequestContext.wrap(parts) };
  }

  private async productionPart(): Promise<string> {
    const task = await this.deps.production?.read();
    if (!task) return "";
    const short = (text: string, size: number) => size <= 0 ? "" : text.length > size ? `${text.slice(0, size - 1)}…` : text;
    const limit = this.deps.config.memory.mapMaxChars;
    const footer = "\nRead production_task_read overview pages, then detail task/step/evidence for exact fields. Use production_task_patch for focused progress. Inspect current targets; never replay saved operations.";
    const header = `Saved production checkpoint (plan, not proof): ${task.id} · revision ${task.revision} · ${task.status}\nGoal: ${task.goal}\n`;
    const brief = `Brief: ${short(task.brief, Math.min(1200, Math.max(0, Math.floor(limit / 6))))}\n`;
    const stepLimit = Math.max(0, Math.floor((limit - header.length - brief.length - footer.length) / task.steps.length) - 1);
    const steps = task.steps.map((step) => {
      const refs = step.evidence.slice(0, 2).map((evidence) => evidence.kind === "version" ? `version:${evidence.versionId}` : `${evidence.kind}:${evidence.exchangeId}${evidence.kind === "tool" ? `/${evidence.toolCallId}` : ""}`)
        .filter((ref) => ref.length <= 150);
      return short(`${step.id} · ${step.status} · ${short(step.action, 120)}${step.blocker ? ` · blocked: ${short(step.blocker, 100)}` : ""}` +
        `${step.targetTags.length ? ` · tags: ${step.targetTags.slice(0, 3).map((tag) => short(tag, 40)).join(", ")}` : ""}${refs.length ? ` · ${refs.join(", ")}` : ""}`, stepLimit);
    }).join("\n");
    const text = header + brief + steps;
    return short(text, Math.max(0, limit - footer.length)) + footer.slice(0, limit);
  }

  /**
   * After the turn. A reply (Why?) emits only its answer. Otherwise what Ode changed is saved as a
   * version and the result line says what changed; when the request was stopped, what it changed so far is saved
   * too, so Undo works, and the line is "Stopped: …".
   */
  async finish(request: OdeRequest, reply: string, stopped: boolean, mutations = 1, receipts: readonly MutationReceipt[] = []): Promise<void | { versionId: string | null }> {
    if (request.reply) {
      const answer = reply.trim();
      if (!stopped && answer) this.deps.emit({ type: "answer", versionId: request.reply.versionId, text: answer });
      return;
    }
    if (mutations === 0) {
      await this.record(() => this.deps.recorder.handEdits());
      if (reply.trim()) this.deps.emit({ type: "result", text: reply.trim(), versionId: null, kind: ResultKind.Reply });
      return;
    }
    let versionId: string | null;
    try { versionId = stopped ? await this.finishStopped(request, receipts) : await this.finishChange(request, reply.trim(), receipts); }
    catch (error) { await markPendingObservation(this.deps.song.dataDir, [request.text]); throw error; }
    return { versionId };
  }

  private async finishChange(request: OdeRequest, reply: string, receipts: readonly MutationReceipt[]): Promise<string | null> {
    const recorded = await this.record(() => this.deps.recorder.odeChange(RequestContext.firstLine(reply), request.text, receipts));
    const version = recorded?.version ?? null;
    const text = reply || version?.summary || "";
    if (text) this.deps.emit({ type: "result", text, versionId: version?.id ?? null, kind: version ? ResultKind.Change : ResultKind.Reply });
    return version?.id ?? null;
  }

  private async finishStopped(request: OdeRequest, receipts: readonly MutationReceipt[]): Promise<string | null> {
    const { STOPPED } = VersionRecorder;
    const recorded = await this.record(() => this.deps.recorder.odeCutShort(STOPPED, request.text, receipts));
    const version = recorded?.version ?? null;
    const text = version ? version.summary : recorded ? t("server.requestContext.theSetStayedTheSame", { STOPPED: (STOPPED) }) : t("server.requestContext.message", { STOPPED: (STOPPED) });
    this.deps.emit({ type: "result", text, versionId: version?.id ?? null, kind: ResultKind.Stopped });
    return version?.id ?? null;
  }

  /** Recording failures propagate so the saved conversation cannot claim a complete receipt. */
  private record(save: () => Promise<RecordedVersion>): Promise<RecordedVersion> {
    return save();
  }

  /** Before ordinary hand edits are captured, retain the uncertain interval under its actual provenance. */
  private async flushPending(): Promise<void> {
    await this.deps.recorder.recoverPending(this.deps.song.dataDir);
  }

  /** When Ode last changed the song, as its history keeps it: the first request after Live starts again reads from there. */
  private async lastOdeVersionTime(): Promise<string | null> {
    return (await this.deps.versions.history.latestBy(VersionAuthor.Ode))?.time ?? null;
  }

  /** Why?: the change asked about, and how to answer. Live stays unread. */
  private async replyContext(versionId: string): Promise<string> {
    const version = await this.deps.versions.history.get(versionId);
    const asked = version.request ? ` The musician had asked: "${version.request}".` : "";
    return RequestContext.wrap([
      `Why?: the musician asks why you made your change "${version.summary}".${asked}`,
      `What it changed:\n${ProjectMap.describeChanges(version.changes)}`,
      "Answer in two or three plain sentences: what you did and why it suits the song. Leave the Set as it is.",
    ]);
  }

  /** The last explicit right-click target is context, not a default scope for every later request. */
  private selectionPart(): string {
    const pointer = this.deps.selection.pointer;
    return pointer
      ? `Last explicit "Ask Ode" target (may predate the current request): ${pointer.description} (${JSON.stringify(pointer.target)}). Infer its relevance from the conversation and inspect the current material.`
      : "No explicit right-click target. Infer the intended scope from the current request, conversation and fresh Set context.";
  }

  /** The hand edits saved since the previous request, each with when it was saved. */
  private async handEditsPart(recorded: RecordedVersion, since: string | null): Promise<string> {
    const versions =
      since === null
        ? recorded.version && recorded.changes.length > 0
          ? [recorded.version]
          : []
        : (await this.deps.versions.history.since(since, VersionAuthor.Musician)).filter((version) => version.changes.length > 0);
    if (versions.length === 0) return "Hand edits since the last request: zero.";
    const text = [
      "Hand edits since the last request (saved as versions):",
      ...versions.map((version) => `Saved at ${RequestContext.clock(version.time)}:\n${ProjectMap.describeChanges(version.changes)}`),
    ].join("\n");
    // Like the map, the hand edits stay within the size limit for what goes with each request.
    const limit = this.deps.config.memory.mapMaxChars;
    if (text.length <= limit) return text;
    const kept = text.slice(0, limit);
    return `${kept.slice(0, kept.lastIndexOf("\n"))}\n… and more: version_list and version_get have every change.`;
  }

  /** Again: the Set is already back to before Ode's last take. */
  private async againPart(): Promise<string> {
    const last = await this.deps.versions.history.latestBy(VersionAuthor.Ode);
    const previous = last ? ` ("${last.summary}")` : "";
    return `Again: the musician wants another take of this request. The verified, scoped changes from your last take${previous} have been undone. Other edits remain; read the current material before making a clearly different take in place.`;
  }

  private static wrap(parts: string[]): string {
    return `<ode-context>\n${parts.join("\n\n")}\n</ode-context>`;
  }

  private static firstLine(text: string): string {
    return (
      text
        .split("\n")
        .map((line) => line.trim())
        .find(Boolean) ?? ""
    );
  }

  private static clock(time: string): string {
    return new Date(time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
}
