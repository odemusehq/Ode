import { t } from "../../shared/i18n";
import "./host-globals";
import { initialize, type ActivationContext } from "@ableton-extensions/sdk";
import texts from "ode:texts";
import ui from "ode:ui";
import { BundledTexts } from "../../harness/texts";
import { OdeApp } from "../../server/app";
import { OdeConfig, type DialogView } from "../../shared/config";
import type { LivePointer } from "../../shared/live";
import { Describer } from "./describe";
import { MaxWindow, MaxWindowMissingError } from "./max-window";
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

/** Ode runs in the extension process; its Max device hosts the floating chat window. */
class OdeExtension implements DialogHost {
  private app: OdeApp | null = null;
  private window: MaxWindow | null = null;

  constructor(private readonly live: Live) {}

  async start(): Promise<void> {
    const notice = new Notice(this.live.ui);
    const { storageDirectory, tempDirectory } = this.live.environment;
    if (!storageDirectory || !tempDirectory) {
      await notice.show(t("live.foldersTitle"), t("live.foldersMessage"));
      return;
    }
    const set = new LiveSet(this.live);
    try {
      const operations = createOperationRegistry({ live: this.live, set, refs: new ReferenceResolver(set), describe: new Describer(set) });
      const app = new OdeApp(new OdeConfig(storageDirectory, tempDirectory), new InProcessLive(operations), new BundledTexts(texts), ui);
      await app.start();
      this.app = app;
      this.window = new MaxWindow(this.live, app.maxWindow, app.windowPort);
      this.window.start();
    } catch (error) {
      console.error(`Ode stopped while starting: ${describeError(error)}`);
      await notice.show(t("live.startupTitle"), t("live.startupMessage", { error: describeError(error) }));
      return;
    }
    new ContextMenu(this.live, new PointerBuilder(this.live, set, new LocationFinder(set)), this, notice).register();
  }

  point(pointer: LivePointer | null): void {
    this.app?.selection.point(pointer);
  }

  async open(view: DialogView): Promise<void> {
    if (!this.app || !this.window) return;
    try { await this.window.open(view); }
    catch (error) {
      const missing = error instanceof MaxWindowMissingError && error.reason === "missing";
      const message = missing
        ? t("live.deviceInstructions")
        : error instanceof MaxWindowMissingError ? error.message : t("live.windowUnavailable");
      await new Notice(this.live.ui).show(missing ? t("live.deviceTitle") : t("live.windowClosedTitle"), message, undefined, 300);
    }
  }
}

export function activate(activation: ActivationContext): void {
  new OdeExtension(initialize(activation, API_VERSION)).start().catch((error: unknown) => console.error(`Ode stopped while starting: ${describeError(error)}`));
}
