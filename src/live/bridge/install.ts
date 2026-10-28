import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { OdeConfig } from "../../shared/config";

/** Installs the Python bridge into the User Library's Remote Scripts folder, with its host and port. */
export class BridgeInstaller {
  constructor(private readonly config: OdeConfig) {}

  async install(): Promise<string> {
    const source = join(OdeConfig.repoDir, "src", "live", "bridge", "Ode");
    const target = join(this.config.abletonUserLibrary, "Remote Scripts", "Ode");
    await mkdir(target, { recursive: true });
    await cp(source, target, { recursive: true, filter: (path) => !path.includes("__pycache__") });
    const settings = { host: this.config.host, port: this.config.bridgePort };
    await writeFile(join(target, "config.json"), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return target;
  }
}

if (import.meta.main) {
  const target = await new BridgeInstaller(OdeConfig.load()).install();
  console.log(`Ode bridge installed: ${target}`);
  console.log("In Live: Settings → Link, Tempo & MIDI → choose Ode as a Control Surface.");
}
