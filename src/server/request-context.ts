import type { OdeConfig } from "../shared/config";
import type { LiveConnections } from "../shared/live";
import type { UiEvent } from "../shared/events";
import { Mode } from "../shared/personalisation";
import type { SetSnapshot } from "../shared/set-snapshot";
import { VersionAuthor, type SetChange, type Version } from "../shared/versions";
import { ProjectMap } from "../mneme/project-map";
import type { PreferencesStore } from "../mneme/preferences";
import type { SongVersions } from "../mneme/song-store";
import type { ContextSummary } from "../mneme/summary";
import type { OdeRequest, RequestLifecycle } from "../harness/session";
import type { Listening } from "./listening";
import { SelectionState } from "./selection";
import type { SnapshotReader } from "./snapshot-reader";
import type { RecordedVersion, VersionRecorder } from "./version-recorder";

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
  listening: Listening;
  emit: (event: UiEvent) => void;
}

const MODE_NOTES: Record<Mode, string> = {
  [Mode.Auto]:
    "Mode: Auto. Change what you are sure of. Ask (ask_musician) only when you can't tell what the musician wants, and before deleting a part or rewriting a whole section.",
  [Mode.Manual]: "Mode: Manual. Every change to the Set waits for the musician to Apply or Skip it.",
  [Mode.LetMeHearIt]: "Mode: Let me hear it. Don't ask: apply your best guess straight away and say what you guessed in your result line.",
};

/**
 * Everything around one request. Before it: read the Set, save the musician's hand edits as a version,
 * and build the hidden context (map, hand edits, mode, selection). After it: save Ode's change as a
 * version, show the result line and play the bars it touched.
 */
export class RequestContext implements RequestLifecycle {
  /** When the previous request read the Set; hand edits saved after it belong to the next request. */
  private lastRequestAt: string | null = null;

  constructor(private readonly deps: RequestContextDeps) {}

  /** Throws "Ode can't read the Set: …" when the Set can't be read; no version is saved then. */
  async prepare(request: OdeRequest): Promise<PreparedRequest> {
    const recorded: RecordedVersion = request.again
      ? { snapshot: await this.deps.reader.read(), version: null, changes: [] }
      : await this.deps.recorder.handEdits();
    const since = this.lastRequestAt;
    this.lastRequestAt = recorded.version?.time ?? new Date().toISOString();
    const parts = [
      await this.deps.summary.build(),
      MODE_NOTES[await this.deps.prefs.mode()],
      this.selectionPart(recorded.snapshot),
      request.again ? await this.againPart() : await this.handEditsPart(recorded, since),
      this.livePart(),
      `Project map:\n${ProjectMap.encode(recorded.snapshot, this.deps.config.memory.mapMaxChars)}`,
    ].filter(Boolean);
    const handEdits = recorded.version && recorded.changes.length > 0 ? recorded.version : null;
    return { hiddenContext: `<ode-context>\n${parts.join("\n\n")}\n</ode-context>`, handEdits };
  }

  /** Saves what Ode changed as a version, emits the result line, then plays the bars it touched. */
  async finish(request: OdeRequest, reply: string): Promise<void> {
    let text = reply.trim();
    let versionId: string | null = null;
    let changes: SetChange[] = [];
    try {
      const recorded = await this.deps.recorder.odeChange(RequestContext.firstLine(text), request.text);
      versionId = recorded.version?.id ?? null;
      changes = recorded.changes;
      if (!text && recorded.version) text = recorded.version.summary;
    } catch (error) {
      this.deps.emit({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
    if (text) this.deps.emit({ type: "result", text, versionId });
    if (versionId) await this.deps.listening.playChanged(changes).catch(() => undefined);
    await this.deps.selection.refresh().catch(() => undefined);
  }

  private selectionPart(snapshot: SetSnapshot): string {
    const { selection } = snapshot;
    const lines = [
      `Selected in Live: ${SelectionState.describe(selection, snapshot)} (${JSON.stringify({ track: selection.track, clip: selection.clip })}).`,
    ];
    const pointer = this.deps.selection.pointer;
    if (pointer) lines.push(`Pointed at with "Ode…": ${pointer.description} (${JSON.stringify(pointer.target)}).`);
    return lines.join("\n");
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

  private livePart(): string {
    const { bridge } = this.deps.live;
    return bridge.connected() ? "" : "Live: the Ode bridge isn't connected, so plug-ins, presets and samples can't be loaded from Live's browser.";
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
