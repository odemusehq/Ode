import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createFalClient, type FalClient } from "@fal-ai/client";
import type { RoleConfig } from "../shared/config";
import { Provider } from "./providers";

interface SeparationResult {
  target: { url: string };
  residual: { url: string };
}

/** Stem separation with Meta SAM Audio, hosted on fal (model id from ODE_STEM_SEPARATION_MODEL). */
export class StemSeparation {
  private readonly fal: FalClient;

  constructor(private readonly role: RoleConfig) {
    if (role.provider !== Provider.Fal) throw new Error(`Stem separation supports the "fal" provider, not "${role.provider}".`);
    this.fal = createFalClient({ credentials: role.apiKey });
  }

  async separate(audioPath: string, describe: string, outDir: string): Promise<{ target: string; rest: string }> {
    const upload = new Blob([await readFile(audioPath)], { type: "audio/wav" });
    const audioUrl = await this.fal.storage.upload(upload);
    const { data } = await this.fal.subscribe(this.role.model, {
      input: { audio_url: audioUrl, prompt: describe, output_format: "wav" },
    });
    const result = data as SeparationResult;
    await mkdir(outDir, { recursive: true });
    const target = join(outDir, "target.wav");
    const rest = join(outDir, "rest.wav");
    await StemSeparation.download(result.target.url, target);
    await StemSeparation.download(result.residual.url, rest);
    return { target, rest };
  }

  private static async download(url: string, path: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Couldn't download the separated audio (${response.status}).`);
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
  }
}
