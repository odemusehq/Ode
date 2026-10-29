import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createFalClient, type FalClient } from "@fal-ai/client";
import type { RoleConfig } from "../../shared/config";
import { decode } from "../../music/audio/decode";
import { encodeWav } from "../../music/audio/wav";
import type { SeparatedStems, StemSeparator } from "../capabilities";

interface FalSeparationResult {
  target: { url: string };
  residual: { url: string };
}

/** Stem separation with a text-prompted separation model hosted on fal (model id from .env). */
export class FalStemSeparator implements StemSeparator {
  private readonly fal: FalClient;

  constructor(private readonly role: RoleConfig) {
    this.fal = createFalClient({ credentials: role.apiKey });
  }

  async separate(audioPath: string, describe: string, outDir: string): Promise<SeparatedStems> {
    // Live renders in its own record file type, WAV or AIFF; the upload is always a WAV.
    const audioUrl = await this.fal.storage.upload(new Blob([encodeWav(await decode(audioPath))], { type: "audio/wav" }));
    const { data } = await this.fal.subscribe(this.role.model, {
      input: { audio_url: audioUrl, prompt: describe, output_format: "wav" },
    });
    const result = data as FalSeparationResult;
    await mkdir(outDir, { recursive: true });
    const target = join(outDir, "target.wav");
    const rest = join(outDir, "rest.wav");
    await FalStemSeparator.download(result.target.url, target);
    await FalStemSeparator.download(result.residual.url, rest);
    return { target, rest };
  }

  private static async download(url: string, path: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Couldn't download the separated audio (${response.status}).`);
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
  }
}
