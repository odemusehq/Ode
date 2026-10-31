import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createFalClient } from "@fal-ai/client";
import type { RoleConfig } from "../../shared/config";
import { decode } from "../../audio/decode";
import { encodeWav } from "../../audio/wav";
import type { SeparatedStems, StemSeparator } from "../capabilities";

interface FalSeparationResult {
  target: { url: string };
  residual: { url: string };
}

/** Stem separation with a text-prompted separation model hosted on fal (model id from .env). */
export class FalStemSeparator implements StemSeparator {
  constructor(private readonly role: RoleConfig) {}

  async separate(audioPath: string, describe: string, outDir: string, signal?: AbortSignal): Promise<SeparatedStems> {
    const fal = createFalClient({ credentials: this.role.apiKey, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([...(signal ? [signal] : []), ...(init?.signal ? [init.signal] : []), AbortSignal.timeout(120_000)]) }) });
    // Live renders in its own record file type, WAV or AIFF; the upload is always a WAV.
    const audioUrl = await fal.storage.upload(new Blob([encodeWav(await decode(audioPath))], { type: "audio/wav" }));
    const { data } = await fal.subscribe(this.role.model, {
      input: { audio_url: audioUrl, prompt: describe, output_format: "wav" },
      abortSignal: signal,
    });
    const result = data as FalSeparationResult;
    await mkdir(outDir, { recursive: true });
    const target = join(outDir, "target.wav");
    const rest = join(outDir, "rest.wav");
    await FalStemSeparator.download(result.target.url, target, signal);
    await FalStemSeparator.download(result.residual.url, rest, signal);
    return { target, rest };
  }

  private static async download(url: string, path: string, signal?: AbortSignal): Promise<void> {
    const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Downloading the separated audio failed (${response.status}).`);
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
  }
}
