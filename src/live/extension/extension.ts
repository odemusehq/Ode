import { initialize, type ActivationContext } from "@ableton-extensions/sdk";
import { OdeConnection } from "./connection";
import { Describer } from "./describe";
import { LiveSet } from "./live-set";
import { LocationFinder } from "./locations";
import { ContextMenu } from "./menu";
import { Notice } from "./notice";
import { createOperationRegistry } from "./ops";
import { QueuedChanges } from "./ops/queued-changes";
import { PointerBuilder } from "./pointer";
import { ReferenceResolver } from "./refs";
import { API_VERSION, type Live } from "./sdk";
import { OdeServer } from "./server";
import { ServerSettings } from "./settings";

/** Ode inside Live: right-click actions, and a connection that runs operations for Ode's server. */
class OdeExtension {
  private readonly menu: ContextMenu;
  private readonly connection: OdeConnection;

  constructor(live: Live) {
    const set = new LiveSet(live);
    const operations = createOperationRegistry({ live, set, refs: new ReferenceResolver(set), describe: new Describer(set) });
    const settings = new ServerSettings(live.environment.storageDirectory);
    this.menu = new ContextMenu(
      live,
      new PointerBuilder(live, set, new LocationFinder(set)),
      new OdeServer(settings),
      new QueuedChanges(live, operations),
      new Notice(live.ui),
    );
    this.connection = new OdeConnection(settings, operations);
  }

  start(): void {
    this.menu.register();
    this.connection.start();
  }
}

export function activate(activation: ActivationContext): void {
  new OdeExtension(initialize(activation, API_VERSION)).start();
}
