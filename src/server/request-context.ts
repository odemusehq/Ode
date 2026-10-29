import type { OdeConfig } from "../shared/config";
import type { LiveConnections } from "../shared/live";
import { ResultKind, type UiEvent } from "../shared/events";
import { Mode } from "../shared/personalisation";
import { VersionAuthor, type Version } from "../shared/versions";
import { ProjectMap } from "../mneme/project-map";
import type { PreferencesStore } from "../mneme/preferences";
import type { SongVersions } from "../mneme/song-store";
import type { ContextSummary } from "../mneme/summary";
import type { OdeRequest, RequestLifecycle } from "../harness/session";
import type { SelectionState } from "./selection";
import type { SnapshotReader } from "./snapshot-reader";
import { VersionRecorder, type RecordedVersion } from "./version-recorder";

export interface PreparedRequest {
  /** What goes with the request for the agent only; it is never shown to the musician. */
  hiddenContext: string;
  /** The version that saved the musician's hand edits, or null when there were none. */
  handEdits: Version | null;
}

export interface RequestContextDeps {
  config: OdeConfig;
  live: LiveConnections;
  reader: SnapshotReader;
  recorder: VersionRecorder;
  versions: SongVersions;
  summary: ContextSummary;
  prefs: PreferencesStore;
  selection: SelectionState;
  emit: (event: UiEvent) => void;
}

const MODE_NOTES: Record<Mode, string> = {
  [Mode.Auto]:
    "Mode: Auto. Change what you are sure of. Ask (ask_musician) only when you can't tell what the musician wants, and before deleting a part or rewriting a whole section.",
  [Mode.Manual]: "Mode: Manual. Every change waits for the musician to Apply or Skip it.",
};

/**
 * Everything around one request. Before it: read the Set, save the musician's hand edits as a version,
 * and build the hidden context (map, hand edits, mode, selection). After it: save Ode's change as a
 * version, show the result line and play the bars it touched. Why? is a reply request: it reads nothing
 * before and saves nothing after; its answer goes under the result line.
 */
export class RequestContext implements RequestLifecycle {
  /** When the previous request read the Set; hand edits saved after it belong to the next request. */
  private lastRequestAt: string | null = null;

  constructor(private readonly deps: RequestContextDeps) {}

  /** Throws "Ode can't read the Set: …" when the Set can't be read; no version is saved then. */
  async prepare(request: OdeRequest): Promise<PreparedRequest> {
    if (request.reply) return { hiddenContext: await this.replyContext(request.reply.versionId), handEdits: null };
    const recorded: RecordedVersion = request.again
      ? { snapshot: await this.deps.reader.read(), version: null, changes: [] }
      : await this.deps.recorder.handEdits();
    const since = this.lastRequestAt;
    this.lastRequestAt = recorded.version?.time ?? new Date().toISOString();
    const parts = [
      await this.deps.summary.build(),
      MODE_NOTES[await this.deps.prefs.mode()],
      this.selectionPart(),
      request.again ? await this.againPart() : await this.handEditsPart(recorded, since),
      `Project map:\n${ProjectMap.encode(recorded.snapshot, this.deps.config.memory.mapMaxChars)}`,
    ].filter(Boolean);
    const handEdits = recorded.version && recorded.changes.length > 0 ? recorded.version : null;
    return { hiddenContext: RequestContext.wrap(parts), handEdits };
  }

  /**
   * After the turn. A reply (Why?) emits its answer and nothing else. Otherwise what Ode changed is saved as a
   * version and the result line says what changed and plays it; after Stop, what it changed so far is saved
   * too, so Undo works, but the line is "Stopped: …" and nothing plays.
   */
  async finish(request: OdeRequest, reply: string, aborted: boolean): Promise<void> {
    if (request.reply) {
      const answer = reply.trim();
      if (!aborted && answer) this.deps.emit({ type: "answer", versionId: request.reply.versionId, text: answer });
      return;
    }
    if (aborted) await this.finishStopped(request);
    else await this.finishChange(request, reply.trim());
    await this.deps.selection.refresh().catch(() => undefined);
  }

  private async finishChange(request: OdeRequest, reply: string): Promise<void> {
    const recorded = await this.record(() => this.deps.recorder.odeChange(RequestContext.firstLine(reply), request.text));
    const version = recorded?.version ?? null;
    const text = reply || version?.summary || "";
    if (text) this.deps.emit({ type: "result", text, versionId: version?.id ?? null, kind: version ? ResultKind.Change : ResultKind.Reply });
  }

  private async finishStopped(request: OdeRequest): Promise<void> {
    const { STOPPED } = VersionRecorder;
    const recorded = await this.record(() => this.deps.recorder.odeCutShort(STOPPED, request.text));
    const version = recorded?.version ?? null;
    const text = version ? version.summary : recorded ? `${STOPPED}: nothing changed` : `${STOPPED}.`;
    this.deps.emit({ type: "result", text, versionId: version?.id ?? null, kind: ResultKind.Stopped });
  }

  /** Saves a version; when that fails the musician sees why, and the result line goes on without it. */
  private async record(save: () => Promise<RecordedVersion>): Promise<RecordedVersion | null> {
    try {
      return await save();
    } catch (error) {
      this.deps.emit({ type: "error", message: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /** Why?: the change asked about, and how to answer. Nothing is read from Live. */
  private async replyContext(versionId: string): Promise<string> {
    const version = await this.deps.versions.history.get(versionId);
    const asked = version.request ? ` The musician had asked: "${version.request}".` : "";
    return RequestContext.wrap([
      `Why?: the musician asks why you made your change "${version.summary}".${asked}`,
      `What it changed:\n${ProjectMap.describeChanges(version.changes)}`,
      "Answer in two or three plain sentences: what you did and why it suits the song. Change nothing.",
    ]);
  }

  /** What the musician right-clicked to ask, or the whole song. */
  private selectionPart(): string {
    const pointer = this.deps.selection.pointer;
    return pointer
      ? `Pointed at with "Ask Ode": ${pointer.description} (${JSON.stringify(pointer.target)}).`
      : "Pointed at: the whole song.";
  }

  /** The hand edits saved since the previous request, each with when it was saved. */
  private async handEditsPart(recorded: RecordedVersion, since: string | null): Promise<string> {
    const versions =
      since === null
        ? recorded.version && recorded.changes.length > 0
          ? [recorded.version]
          : []
        : (await this.deps.versions.history.list()).filter(
            (version) => version.author === VersionAuthor.Musician && version.changes.length > 0 && version.time > since,
          );
    if (versions.length === 0) return "Hand edits since the last request: none.";
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
    const last = (await this.deps.versions.history.list()).filter((version) => version.author === VersionAuthor.Ode).at(-1);
    const previous = last ? ` ("${last.summary}")` : "";
    return `Again: the musician wants another take of this request. The Set is back to how it was before your last take${previous}. Make a clearly different take, in place.`;
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
