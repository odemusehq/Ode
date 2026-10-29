import "./host-globals";
import { initialize, type ActivationContext } from "@ableton-extensions/sdk";
import texts from "ode:texts";
import ui from "ode:ui";
import { BundledTexts } from "../../harness/texts";
import { OdeApp } from "../../server/app";
import { OdeConfig, type DialogView } from "../../shared/config";
import type { LivePointer } from "../../shared/live";
import { Describer } from "./describe";
import { describeError } from "./errors";
import { InProcessLive } from "./in-process-live";
import { LiveSet } from "./live-set";
import { LocationFinder } from "./locations";
import { ContextMenu, type DialogHost } from "./menu";
import { Notice } from "./notice";
import { createOperationRegistry } from "./ops";
import { PointerBuilder } from "./pointer";
import { ReferenceResolver } from "./refs";
import { API_VERSION, type Live } from "./sdk";

/** Ode inside Live: all of Ode in the extension's process, its dialogs on Live's right-click menus. */
class OdeExtension implements DialogHost {
  private app: OdeApp | null = null;

  constructor(private readonly live: Live) {}

  async start(): Promise<void> {
    const notice = new Notice(this.live.ui);
    const { storageDirectory, tempDirectory } = this.live.environment;
    if (!storageDirectory || !tempDirectory) {
      await notice.show("Ode needs its folders", "Ode keeps its settings and songs in the folders Live gives each extension. Restart Live, then open Ode again.");
      return;
    }
    const set = new LiveSet(this.live);
    try {
      const operations = createOperationRegistry({ live: this.live, set, refs: new ReferenceResolver(set), describe: new Describer(set) });
      const app = new OdeApp(new OdeConfig(storageDirectory, tempDirectory), new InProcessLive(operations), new BundledTexts(texts), ui);
      await app.start();
      this.app = app;
    } catch (error) {
      console.error(`Ode stopped while starting: ${describeError(error)}`);
      await notice.show("Ode stopped while starting", `${describeError(error)}. Restart Live to try again.`);
      return;
    }
    new ContextMenu(this.live, new PointerBuilder(this.live, set, new LocationFinder(set)), this, notice).register();
  }

  point(pointer: LivePointer | null): void {
    this.app?.selection.point(pointer);
  }

  async open(view: DialogView): Promise<void> {
    if (!this.app) return;
    const { width, height } = this.app.config.dialogs[view];
    await this.live.ui.showModalDialog(this.app.dialogUrl(view), width, height);
  }
}

export function activate(activation: ActivationContext): void {
  new OdeExtension(initialize(activation, API_VERSION)).start().catch((error: unknown) => console.error(`Ode stopped while starting: ${describeError(error)}`));
}
