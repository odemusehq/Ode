import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { OdeConfig } from "../../shared/config";
import { LIVE_SOCKET_PATHS } from "../../shared/live";
import { DevicePatcher } from "./patcher";

/** Builds the Ode device (Ode.amxd) and installs it in the User Library's Audio Effects presets. */
class DeviceBuilder {
  private readonly sourceDir = join(OdeConfig.repoDir, "src", "live", "device");
  private readonly outDir = join(this.sourceDir, "dist");

  constructor(private readonly config: OdeConfig) {}

  async build(): Promise<string> {
    await mkdir(this.outDir, { recursive: true });
    const nodeScript = await this.buildNetworkSide();
    const liveCode = await this.buildLiveSide();
    const patcher = new DevicePatcher({ liveCode, nodeScript, uiUrl: this.config.serverUrl }).build();
    const device = join(this.outDir, "Ode.amxd");
    await writeFile(device, DeviceBuilder.amxd(JSON.stringify(patcher, null, "\t")));
    return this.install(device);
  }

  private async buildNetworkSide(): Promise<string> {
    const outfile = join(this.outDir, "ode-device-node.js");
    const socketUrl = `ws://${this.config.host}:${this.config.port}${LIVE_SOCKET_PATHS.device}`;
    await esbuild.build({
      entryPoints: [join(this.sourceDir, "node", "device-socket.ts")],
      outfile,
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "node22",
      external: ["max-api"],
      define: { "process.env.ODE_DEVICE_SOCKET_URL": JSON.stringify(socketUrl) },
      logLevel: "warning",
    });
    return outfile;
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
    ].join("\n");
  }

  private async install(device: string): Promise<string> {
    const presets = join(this.config.abletonUserLibrary, "Presets", "Audio Effects", "Max Audio Effect");
    await mkdir(presets, { recursive: true });
    const installed = join(presets, "Ode.amxd");
    await copyFile(device, installed);
    return installed;
  }

  /** A Max for Live device file: "ampf" header, device type, meta chunk, then the patch (null-terminated). */
  private static amxd(patch: string): Buffer {
    const body = Buffer.from(`${patch}\n\0`, "utf8");
    const header = Buffer.alloc(32);
    header.write("ampf", 0, "ascii");
    header.writeUInt32LE(4, 4);
    header.write("aaaa", 8, "ascii");
    header.write("meta", 12, "ascii");
    header.writeUInt32LE(4, 16);
    header.writeUInt32LE(0, 20);
    header.write("ptch", 24, "ascii");
    header.writeUInt32LE(body.length, 28);
    return Buffer.concat([header, body]);
  }
}

const installed = await new DeviceBuilder(OdeConfig.load()).build();
console.log(`Ode device installed: ${installed}`);
