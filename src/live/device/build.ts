import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { OdeConfig } from "../../shared/config";
import { LIVE_SOCKET_PATHS } from "../../shared/live";
import { AmxdFile } from "./amxd";
import { DeviceInstaller } from "./install";
import { DevicePatcher } from "./patcher";

/** Builds the Ode device (Ode.amxd) and its network script; run directly, it also installs them in the User Library. */
export class DeviceBuilder {
  private readonly sourceDir = join(OdeConfig.repoDir, "src", "live", "device");
  private readonly outDir = DeviceInstaller.builtDir;

  constructor(private readonly config: OdeConfig) {}

  async build(): Promise<string> {
    await mkdir(this.outDir, { recursive: true });
    await this.buildNetworkSide();
    const liveCode = await this.buildLiveSide();
    const patcher = new DevicePatcher({ liveCode, nodeScript: DeviceInstaller.networkScript, uiUrl: this.config.serverUrl }).build();
    const device = join(this.outDir, DeviceInstaller.deviceFile);
    await writeFile(device, AmxdFile.pack(JSON.stringify(patcher, null, "\t")));
    return device;
  }

  private async buildNetworkSide(): Promise<void> {
    const socketUrl = `ws://${this.config.host}:${this.config.port}${LIVE_SOCKET_PATHS.device}`;
    await esbuild.build({
      entryPoints: [join(this.sourceDir, "node", "device-socket.ts")],
      outfile: join(this.outDir, DeviceInstaller.networkScript),
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "node22",
      external: ["max-api"],
      define: { "process.env.ODE_DEVICE_SOCKET_URL": JSON.stringify(socketUrl) },
      logLevel: "warning",
    });
  }

  private async buildLiveSide(): Promise<string> {
    const result = await esbuild.build({
      entryPoints: [join(this.sourceDir, "live", "device-main.ts")],
      bundle: true,
      write: false,
      format: "iife",
      globalName: "OdeDeviceBundle",
      platform: "neutral",
      target: "es2022",
      logLevel: "warning",
    });
    const bundle = result.outputFiles[0]?.text ?? "";
    // Max calls top-level functions named after the messages the v8 object receives.
    return [
      bundle,
      "inlets = 1;",
      "outlets = 2;",
      "function bang() { OdeDeviceBundle.device.start(); }",
      "function request(json) { OdeDeviceBundle.device.request(json); }",
      "function hello() { OdeDeviceBundle.device.hello(); }",
      "function command(name) { OdeDeviceBundle.device.command(name); }",
    ].join("\n");
  }
}

if (import.meta.main) {
  const config = OdeConfig.load();
  await new DeviceBuilder(config).build();
  console.log(`Ode device installed: ${await new DeviceInstaller(config).install()}`);
}
