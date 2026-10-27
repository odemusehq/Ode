import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Host and port of Ode's local server. */
export class ServerAddress {
  constructor(
    readonly host: string,
    readonly port: number,
  ) {}

  httpUrl(path: string): string {
    return `http://${this.host}:${this.port}${path}`;
  }

  socketUrl(path: string): string {
    return `ws://${this.host}:${this.port}${path}`;
  }
}

interface AddressOverride {
  readonly host?: string;
  readonly port?: number;
}

/**
 * Where to reach Ode's server: the host and port from Ode's configuration, written into the
 * bundle when it is built, unless config.json in the extension's storage folder gives others.
 */
export class ServerSettings {
  private static readonly OVERRIDE_FILE = "config.json";
  private static readonly REBUILD =
    "This build of the Ode extension doesn't know where Ode's server is. Rebuild it with npm run build:extension.";

  private readonly configured: ServerAddress;

  constructor(private readonly storageDirectory: string | undefined) {
    this.configured = new ServerAddress(ServerSettings.builtHost(), ServerSettings.builtPort());
  }

  /** Read on every call, so a changed config.json applies from the next connection. */
  async address(): Promise<ServerAddress> {
    const override = await this.readOverride();
    return new ServerAddress(override.host ?? this.configured.host, override.port ?? this.configured.port);
  }

  private async readOverride(): Promise<AddressOverride> {
    if (!this.storageDirectory) return {};
    const path = join(this.storageDirectory, ServerSettings.OVERRIDE_FILE);
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch {
      return {};
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`Ode ignored ${path}: it is not valid JSON`);
      return {};
    }
    if (typeof data !== "object" || data === null) return {};
    const { host, port } = data as { host?: unknown; port?: unknown };
    return {
      host: typeof host === "string" && host.trim() ? host.trim() : undefined,
      port: ServerSettings.isPort(port) ? port : undefined,
    };
  }

  private static builtHost(): string {
    const host = process.env.ODE_HOST;
    if (!host) throw new Error(ServerSettings.REBUILD);
    return host;
  }

  private static builtPort(): number {
    const port = Number(process.env.ODE_PORT);
    if (!ServerSettings.isPort(port)) throw new Error(ServerSettings.REBUILD);
    return port;
  }

  private static isPort(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value > 0 && value < 65536;
  }
}
