import type { ArrangementSelection, ClipSlotSelection, ContextMenuScope, Handle } from "@ableton-extensions/sdk";
import { DialogView } from "../../shared/config";
import type { LivePointer } from "../../shared/live";
import { describeError } from "./errors";
import type { Notice } from "./notice";
import type { PointerBuilder } from "./pointer";
import type { Live, Version } from "./sdk";

type Scope = ContextMenuScope<Version>;

/** What the menu needs from Ode: to hear what the musician pointed at, and to open its dialogs. */
export interface DialogHost {
  point(pointer: LivePointer): Promise<void>;
  open(view: DialogView): Promise<void>;
}

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

/** Where Ode's own dialogs appear: on track headers and scenes. */
const DIALOG_SCOPES = ["MidiTrack", "AudioTrack", "Scene"] as const satisfies readonly Scope[];

enum CommandId {
  AskOde = "ode.askOde",
  Lyrics = "ode.lyrics",
  History = "ode.history",
  Settings = "ode.settings",
}

enum MenuTitle {
  AskOde = "Ask Ode",
  Lyrics = "Ode: Lyrics",
  History = "Ode: History",
  Settings = "Ode: Settings",
}

/** Ode's entries in Live's right-click menus: Ask Ode on whatever the musician points at, and Ode's dialogs. */
export class ContextMenu {
  constructor(
    private readonly live: Live,
    private readonly pointers: PointerBuilder,
    private readonly host: DialogHost,
    private readonly notice: Notice,
  ) {}

  register(): void {
    for (const scope of OBJECT_SCOPES) this.addAskOde(scope, (arg) => this.pointers.fromObject(scope, arg as Handle));
    this.addAskOde("ClipSlotSelection", (arg) => this.pointers.fromClipSlots("ClipSlotSelection", arg as ClipSlotSelection));
    for (const scope of ARRANGEMENT_SCOPES) {
      this.addAskOde(scope, (arg) => this.pointers.fromArrangement(scope, arg as ArrangementSelection));
    }
    this.addDialog(CommandId.Lyrics, MenuTitle.Lyrics, DialogView.Lyrics);
    this.addDialog(CommandId.History, MenuTitle.History, DialogView.History);
    this.addDialog(CommandId.Settings, MenuTitle.Settings, DialogView.Settings);
  }

  private addAskOde(scope: Scope, point: (arg: unknown) => LivePointer): void {
    const command = `${CommandId.AskOde}.${scope}`;
    this.live.commands.registerCommand(command, (arg) => void this.askOde(() => point(arg)));
    this.addAction(scope, MenuTitle.AskOde, command);
  }

  private addDialog(command: CommandId, title: MenuTitle, view: DialogView): void {
    this.live.commands.registerCommand(command, () => void this.show(view));
    for (const scope of DIALOG_SCOPES) this.addAction(scope, title, command);
  }

  private addAction(scope: Scope, title: MenuTitle, command: string): void {
    this.live.ui
      .registerContextMenuAction(scope, title, command)
      .catch((error: unknown) => console.error(`Ode could not add "${title}" to the ${scope} menu: ${describeError(error)}`));
  }

  /** Tells Ode what the musician right-clicked, then opens Ask Ode, where the musician can also describe it in words. */
  private async askOde(point: () => LivePointer): Promise<void> {
    try {
      await this.host.point(point());
    } catch (error) {
      console.error(`Ask Ode: ${describeError(error)}`);
    }
    await this.show(DialogView.Ask);
  }

  private async show(view: DialogView): Promise<void> {
    try {
      await this.host.open(view);
    } catch (error) {
      console.error(`Ode's ${view} dialog: ${describeError(error)}`);
      await this.notice.show("Ode's dialog stayed closed", describeError(error));
    }
  }
}
