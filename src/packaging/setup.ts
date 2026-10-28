import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { BridgeInstaller } from "../live/bridge/install";
import { DeviceInstaller } from "../live/device/install";
import { OdeConfig } from "../shared/config";

const run = promisify(execFile);

/**
 * Sets up a downloaded release of Ode once npm has installed its packages (`npm run setup`): makes .env, puts the
 * Ode device and the Ode Control Surface in the User Library, and shows the Live extension in Finder.
 */
class ReleaseSetup {
  private readonly settings = join(OdeConfig.repoDir, ".env");
  private readonly extension = join(OdeConfig.repoDir, "Ode.ablx");

  async run(): Promise<void> {
    const created = await this.createSettings();
    const config = OdeConfig.load();
    const device = await new DeviceInstaller(config).install();
    const bridge = await new BridgeInstaller(config).install();
    await run("open", ["-R", this.extension]);
    if (created) await run("open", ["-t", this.settings]);
    console.log(
      [
        `Ode device: ${device}`,
        `Ode Control Surface: ${bridge}`,
        `Settings: ${this.settings}${created ? " (add your model keys and save it)" : ""}`,
        "",
        "In Live:",
        "1. Settings → Extensions: drop Ode.ablx on the page (Finder shows it). Leave Developer Mode off.",
        "2. Settings → Link, Tempo & MIDI: choose Ode as a Control Surface.",
        "3. Put the Ode device on the Main track: User Library → Presets → Audio Effects → Max Audio Effect.",
        "",
        "Then run npm start in this folder whenever you use Ode.",
      ].join("\n"),
    );
  }

  /** Copies .env.example to .env unless there is one; true when it made one. */
  private async createSettings(): Promise<boolean> {
    try {
      await copyFile(join(OdeConfig.repoDir, ".env.example"), this.settings, constants.COPYFILE_EXCL);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }
  }
}

await new ReleaseSetup().run();
