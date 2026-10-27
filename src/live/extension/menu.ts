import type { ArrangementSelection, ClipSlotSelection, ContextMenuScope, Handle } from "@ableton-extensions/sdk";
import type { LivePointer, LiveRequest, LiveResponse } from "../../shared/live";
import { describeError } from "./errors";
import { Labels } from "./labels";
import type { Notice } from "./notice";
import type { QueuedChanges } from "./ops/queued-changes";
import type { PointerBuilder } from "./pointer";
import type { Live, Version } from "./sdk";
import { CancelledError, ServerUnavailableError, type OdeServer } from "./server";

type Scope = ContextMenuScope<Version>;

/** Scopes whose right-click hands over one object. */
const OBJECT_SCOPES = [
  "AudioClip",
  "MidiClip",
  "AudioTrack",
  "MidiTrack",
  "ClipSlot",
  "Scene",
  "Simpler",
  "Sample",
  "DrumRack",
] as const satisfies readonly Scope[];

/** Scopes for a time selection in Arrangement View. */
const ARRANGEMENT_SCOPES = ["AudioTrack.ArrangementSelection", "MidiTrack.ArrangementSelection"] as const satisfies readonly Scope[];

/** Where "Ode: Apply changes" appears. */
const APPLY_SCOPES = ["MidiTrack", "AudioTrack", ...ARRANGEMENT_SCOPES] as const satisfies readonly Scope[];

enum CommandId {
  AskOde = "ode.askOde",
  ApplyChanges = "ode.applyChanges",
}

enum MenuTitle {
  AskOde = "Ask Ode",
  ApplyChanges = "Ode: Apply changes",
}

type ProgressUpdate = (text: string, progress?: number) => Promise<void>;

/** What applying the queued changes came to. */
class ApplyReport {
  constructor(
    readonly total: number,
    readonly failed: number,
  ) {}
}

/** A failure with words ready for the musician. */
class MusicianFacingError extends Error {
  constructor(
    readonly title: string,
    message: string,
  ) {
    super(message);
  }
}

/** Ode's entries in Live's right-click menus. */
export class ContextMenu {
  constructor(
    private readonly live: Live,
    private readonly pointers: PointerBuilder,
    private readonly server: OdeServer,
    private readonly changes: QueuedChanges,
    private readonly notice: Notice,
  ) {}

  register(): void {
    for (const scope of OBJECT_SCOPES) this.addAskOde(scope, (arg) => this.pointers.fromObject(scope, arg as Handle));
    this.addAskOde("ClipSlotSelection", (arg) => this.pointers.fromClipSlots("ClipSlotSelection", arg as ClipSlotSelection));
    for (const scope of ARRANGEMENT_SCOPES) {
      this.addAskOde(scope, (arg) => this.pointers.fromArrangement(scope, arg as ArrangementSelection));
    }
    this.live.commands.registerCommand(CommandId.ApplyChanges, () => void this.applyChanges());
    for (const scope of APPLY_SCOPES) this.addAction(scope, MenuTitle.ApplyChanges, CommandId.ApplyChanges);
  }

  private addAskOde(scope: Scope, point: (arg: unknown) => LivePointer): void {
    const command = `${CommandId.AskOde}.${scope}`;
    this.live.commands.registerCommand(command, (arg) => void this.askOde(() => point(arg)));
    this.addAction(scope, MenuTitle.AskOde, command);
  }

  private addAction(scope: Scope, title: MenuTitle, command: string): void {
    this.live.ui
      .registerContextMenuAction(scope, title, command)
      .catch((error: unknown) => console.error(`Ode could not add "${title}" to the ${scope} menu: ${describeError(error)}`));
  }

  /** Tells Ode what the musician right-clicked. */
  private async askOde(point: () => LivePointer): Promise<void> {
    let pointer: LivePointer;
    try {
      pointer = point();
    } catch (error) {
      console.error(`Ask Ode: ${describeError(error)}`);
      await this.notice.show("Ode can't tell what this is", "Describe what you mean in Ode's window instead.");
      return;
    }
    try {
      await this.server.sendPointer(pointer);
    } catch (error) {
      await this.showProblem(error);
    }
  }

  /** Applies the changes Ode queued while the connection was closed, then sends Ode the results. */
  private async applyChanges(): Promise<void> {
    let report: unknown;
    try {
      report = await this.live.ui.withinProgressDialog("Getting changes from Ode…", {}, (update, signal) =>
        this.applyPending(update, signal),
      );
    } catch (error) {
      await this.showProblem(error);
      return;
    }
    if (!(report instanceof ApplyReport)) return;
    if (report.total === 0) {
      await this.notice.show("Nothing to apply", "Ode has no changes waiting.");
    } else if (report.failed > 0) {
      await this.notice.show(
        "Some changes weren't applied",
        `${report.failed} of ${Labels.count(report.total, "change")} couldn't be applied. Ode has the details.`,
      );
    }
  }

  private async applyPending(update: ProgressUpdate, signal: AbortSignal): Promise<ApplyReport> {
    const requests = await this.server.takePendingChanges(signal);
    if (requests.length === 0) return new ApplyReport(0, 0);
    const cancelled = signal.aborted;
    const responses = cancelled ? ContextMenu.cancelled(requests) : await this.apply(requests, update);
    await update("Sending the results to Ode…", 95);
    await this.sendResults(responses);
    if (cancelled) throw new CancelledError("cancelled");
    return new ApplyReport(requests.length, responses.filter((response) => !response.ok).length);
  }

  private async sendResults(responses: readonly LiveResponse[]): Promise<void> {
    try {
      await this.server.sendResults(responses);
    } catch {
      throw new MusicianFacingError(
        "Ode didn't get the results",
        "The changes were applied in Live, but Ode didn't receive the results. Check Ode's window.",
      );
    }
  }

  private async apply(requests: readonly LiveRequest[], update: ProgressUpdate): Promise<LiveResponse[]> {
    const total = requests.length;
    await update(`Applying ${Labels.count(total, "change")}…`, 5);
    return this.changes.apply(requests, (applied) => update(`Applied ${applied} of ${total}…`, 5 + (85 * applied) / total));
  }

  private async showProblem(error: unknown): Promise<void> {
    if (error instanceof CancelledError) return;
    console.error(describeError(error));
    if (error instanceof MusicianFacingError) await this.notice.show(error.title, error.message);
    else if (error instanceof ServerUnavailableError) await this.notice.show("Ode isn't running", "Start Ode on this computer, then try again.");
    else await this.notice.show("Something went wrong", describeError(error));
  }

  private static cancelled(requests: readonly LiveRequest[]): LiveResponse[] {
    return requests.map((request) => ({ id: request.id, ok: false, error: "The musician cancelled this change in Live." }));
  }
}
