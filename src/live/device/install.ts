import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { OdeConfig } from "../../shared/config";
import { AmxdFile } from "./amxd";
import { DevicePatcher } from "./patcher";

/**
 * Installs the built Ode device in the User Library's Audio Effects presets, where Live's browser lists it. The
 * device's network script goes beside it, and the installed device names the script by its full path.
 */
export class DeviceInstaller {
  /** Where the device build writes its files. */
  static readonly builtDir = join(OdeConfig.repoDir, "src", "live", "device", "dist");
  static readonly deviceFile = "Ode.amxd";
  static readonly networkScript = "ode-device-node.js";

  constructor(private readonly config: OdeConfig) {}

  async install(): Promise<string> {
    const presets = join(this.config.abletonUserLibrary, "Presets", "Audio Effects", "Max Audio Effect");
    await mkdir(presets, { recursive: true });
    const script = join(presets, DeviceInstaller.networkScript);
    await copyFile(join(DeviceInstaller.builtDir, DeviceInstaller.networkScript), script);
    const patch = AmxdFile.unpack(await readFile(join(DeviceInstaller.builtDir, DeviceInstaller.deviceFile)));
    const built = JSON.stringify(DevicePatcher.networkLine(DeviceInstaller.networkScript));
    if (!patch.includes(built)) throw new Error("The built Ode device is out of date: run npm run build:device");
    const device = join(presets, DeviceInstaller.deviceFile);
    const installed = JSON.stringify(DevicePatcher.networkLine(script));
    await writeFile(device, AmxdFile.pack(patch.replace(built, () => installed)));
    return device;
  }
}
