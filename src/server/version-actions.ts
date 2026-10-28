import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { z } from "zod";
import type { DeviceCommand, LiveConnections } from "../shared/live";
import type { CopyResult } from "../shared/api";
import type { UiEvent } from "../shared/events";
import type { SetSnapshot } from "../shared/set-snapshot";
import { VersionAuthor, type RestoreResult, type Version, type VersionDetail, type VersionListItem } from "../shared/versions";
import type { SongStore, SongVersions } from "../mneme/song-store";
import { SessionBusyError, type OdeSession } from "../harness/session";
import type { SessionManager } from "../harness/session-manager";
import { RestoreRunner } from "./restore-runner";
import { SetReadError } from "./snapshot-reader";
import type { VersionRecorder } from "./version-recorder";

/** What the musician asked can't be done now; the message says why and what to do. */
export class RefusedError extends Error {}

export interface VersionActionsDeps {
  live: LiveConnections;
  song: SongStore;
  versions: SongVersions;
  recorder: VersionRecorder;
  sessions: SessionManager;
  emit: (event: UiEvent) => void;
}

/** Written into a copy of the project: the version the copy goes back to when it is first opened. */
const RESTORE_ON_OPEN = "restore-on-open.json";
const RestoreMarkerSchema = z.object({ versionId: z.string() });

const NOTHING_TO_UNDO = "There is no change by Ode to undo.";
const EDITED_SINCE =
  "You have changed the Set since Ode's last change. To go back further, restore a version in History.";
const NOTHING_TO_RETRY = "Again tries Ode's last change once more, and there is no change by Ode to try again.";

/** Characters that can't be part of a folder name on macOS or Windows. */
const UNSAFE_IN_FOLDER_NAMES = /[/\\:*?"<>|]/g;

/** What History, Undo and Again do with the versions of the whole Set. */
export class VersionActions {
  private openingCopy = false;
  private readonly runner: RestoreRunner;

  constructor(private readonly deps: VersionActionsDeps) {
    this.runner = new RestoreRunner(deps.live, deps.song);
  }

  private get history() {
    return this.deps.versions.history;
  }

  private get session(): OdeSession {
    return this.deps.sessions.current;
  }

  /**
   * The History list, newest first. Opening History first saves the musician's hand edits as a version, so
   * the list is current; when the Set can't be read (or Ode is changing it right now) the list is as it is.
   */
  async items(): Promise<VersionListItem[]> {
    if (!this.session.isBusy) await this.deps.recorder.handEdits().catch(() => undefined);
    return this.history.items();
  }

  /** Throws VersionNotFoundError for a version that isn't in this song's history. */
  detail(id: string): Promise<VersionDetail> {
    return this.history.detail(id);
  }

  name(id: string, name: string): Promise<VersionListItem> {
    return this.history.name(id, name);
  }

  /**
   * Goes back to a version the musician confirmed: saves their hand edits, puts the Set back from how it
   * is now, then deletes the versions after it. Throws when Ode is working or the Set can't be read.
   */
  restore(id: string): Promise<RestoreResult> {
    return this.restoreTo(id, (version) => `Restored the version from ${VersionActions.clock(version.time)}`);
  }

  /** Back to the version before Ode's last change, without asking; only right after a change by Ode. */
  async undo(): Promise<RestoreResult> {
    try {
      return await this.session.exclusive(async () => {
        const recorded = await this.deps.recorder.handEdits();
        const versions = await this.history.list();
        const latest = versions.at(-1);
        const previous = versions.at(-2);
        if (!latest || latest.author !== VersionAuthor.Ode || !previous) {
          return { restored: false, skipped: [recorded.changes.length > 0 ? EDITED_SINCE : NOTHING_TO_UNDO] };
        }
        this.deps.emit({ type: "progress", text: `Undoing: ${latest.summary}` });
        const outcome = await this.runner.putBack(recorded.snapshot, await this.history.snapshotAt(previous.id));
        if (!outcome.complete) return { restored: false, skipped: outcome.skipped };
        await this.history.truncateAfter(previous.id);
        this.deps.emit({ type: "versions-truncated", afterId: previous.id });
        this.deps.emit({ type: "result", text: `Undone: ${latest.summary}${VersionActions.notRestored(outcome.skipped)}`, versionId: null });
        return { restored: true, skipped: outcome.skipped };
      });
    } catch (error) {
      if (error instanceof SessionBusyError || error instanceof SetReadError) return { restored: false, skipped: [error.message] };
      throw error;
    }
  }

  /**
   * Another take of Ode's last change: puts the Set back to the version before it (keeping the history),
   * then runs the same request again. The put-back isn't saved as hand edits, so Ode's next version
   * shows the first take turning into the second.
   */
  async again(): Promise<void> {
    await this.session.exclusive(async () => {
      const recorded = await this.deps.recorder.handEdits();
      const versions = await this.history.list();
      const latest = versions.at(-1);
      const previous = versions.at(-2);
      if (!latest || latest.author !== VersionAuthor.Ode || !previous) {
        throw new RefusedError(recorded.changes.length > 0 ? EDITED_SINCE : NOTHING_TO_RETRY);
      }
      if (!latest.request) throw new RefusedError("Ode's last change doesn't say what was asked, so it can't be tried again.");
      this.deps.emit({ type: "progress", text: "Going back to before the last take" });
      const outcome = await this.runner.putBack(recorded.snapshot, await this.history.snapshotAt(previous.id));
      if (!outcome.complete) throw new RefusedError(outcome.skipped.join(" "));
      if (outcome.skipped.length > 0) this.deps.emit({ type: "progress", text: `Not put back: ${outcome.skipped.join(", ")}` });
      this.session.sendFirst({ text: latest.request, again: true });
    });
  }

  /** Undo or Again pressed on the Ode device (or the key or pad mapped to it in Live). */
  async command(command: DeviceCommand): Promise<void> {
    try {
      if (command.name === "again") {
        await this.again();
        return;
      }
      const result = await this.undo();
      if (!result.restored) this.deps.emit({ type: "error", message: result.skipped.join(" ") });
    } catch (error) {
      this.deps.emit({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Copies the project folder next to itself as "<folder> (<version name, or date and time>)" and marks
   * the version, so the copy goes back to it when it is opened in Live.
   */
  async copy(id: string): Promise<CopyResult> {
    const project = this.deps.song.projectDir;
    if (!project) throw new RefusedError("Save the Set first");
    const version = await this.history.get(id);
    const destination = await VersionActions.freeFolder(join(dirname(project), `${basename(project)} (${VersionActions.copyName(version)})`));
    await cp(project, destination, { recursive: true, errorOnExist: true, force: false });
    const dataDir = join(destination, relative(project, this.deps.song.dataDir));
    await mkdir(dataDir, { recursive: true });
    await writeFile(join(dataDir, RESTORE_ON_OPEN), `${JSON.stringify({ versionId: id }, null, 2)}\n`, "utf8");
    return { path: destination };
  }

  /**
   * A copy made from History goes back to its version the first time it is open with the extension and the
   * Ode device connected; the mark is deleted afterwards. Call it when a Set opens and when Live connects.
   */
  async restoreOnOpen(): Promise<void> {
    const { extension, device } = this.deps.live;
    if (this.openingCopy || !extension.connected() || !device.connected()) return;
    const file = join(this.deps.song.dataDir, RESTORE_ON_OPEN);
    const marker = await VersionActions.readMarker(file);
    if (!marker) return;
    this.openingCopy = true;
    try {
      const result = await this.restoreTo(marker.versionId, (version) => `This copy is back at the version from ${VersionActions.clock(version.time)}`);
      await rm(file, { force: true });
      if (!result.restored) this.deps.emit({ type: "error", message: `This copy couldn't go back to its version: ${result.skipped.join(" ")}` });
    } catch (error) {
      // Ode is working or Live dropped: the mark stays, and the next connection tries again.
      if (error instanceof SessionBusyError || error instanceof SetReadError) return;
      await rm(file, { force: true });
      this.deps.emit({ type: "error", message: `This copy couldn't go back to its version: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      this.openingCopy = false;
    }
  }

  private restoreTo(id: string, resultLine: (version: Version) => string): Promise<RestoreResult> {
    return this.session.exclusive(async () => {
      const version = await this.history.get(id);
      this.deps.emit({ type: "progress", text: `Going back to the version from ${VersionActions.clock(version.time)}` });
      const recorded = await this.deps.recorder.handEdits();
      const outcome = await this.runner.putBack(recorded.snapshot, await this.history.snapshotAt(id));
      if (!outcome.complete) return { restored: false, skipped: outcome.skipped };
      await this.history.truncateAfter(id);
      this.deps.emit({ type: "versions-truncated", afterId: id });
      this.deps.emit({ type: "result", text: `${resultLine(version)}${VersionActions.notRestored(outcome.skipped)}`, versionId: null });
      return { restored: true, skipped: outcome.skipped };
    });
  }

  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private static notRestored(skipped: string[]): string {
    return skipped.length > 0 ? ` · not restored: ${skipped.join(", ")}` : "";
  }

  private static clock(time: string): string {
    return new Date(time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  /** The version's name, or its date and time ("2026-10-28 22.38"), made safe for a folder name. */
  private static copyName(version: Version): string {
    const named = version.name?.replace(UNSAFE_IN_FOLDER_NAMES, "-").trim();
    if (named) return named;
    const time = new Date(version.time);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())} ${pad(time.getHours())}.${pad(time.getMinutes())}`;
  }

  /** The folder, or the same name followed by 2, 3 … when it is taken. */
  private static async freeFolder(path: string): Promise<string> {
    const taken = (candidate: string) => stat(candidate).then(() => true, () => false);
    if (!(await taken(path))) return path;
    let number = 2;
    while (await taken(`${path} ${number}`)) number += 1;
    return `${path} ${number}`;
  }

  private static async readMarker(file: string): Promise<z.infer<typeof RestoreMarkerSchema> | null> {
    try {
      return RestoreMarkerSchema.parse(JSON.parse(await readFile(file, "utf8")));
    } catch {
      return null;
    }
  }
}
