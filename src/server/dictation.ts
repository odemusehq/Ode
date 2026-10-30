import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AudioFileDecoder } from "../music/audio/decode";
import type { Services } from "../services/types";

export const MAX_DICTATION_BYTES = 16 * 1024 * 1024;
export const MAX_DICTATION_SECONDS = 60.25;

export class DictationError extends Error {
  constructor(message: string, readonly status: 400 | 408 | 409 | 413 | 422 | 502 | 503) { super(message); }
}

/** Dictation is temporary speech input, never a library asset or a submitted chat request. */
export class Dictation {
  constructor(private readonly services: Pick<Services, "transcribe">, private readonly tempDir: string) {}

  static validate(bytes: Uint8Array): void {
    if (bytes.byteLength === 0) throw new DictationError("The recording is empty. Dictate a short message and try again.", 400);
    if (bytes.byteLength > MAX_DICTATION_BYTES) throw new DictationError("Dictation is limited to 16 MiB and one minute.", 413);
    try {
      const decoder = new AudioFileDecoder();
      const info = decoder.inspect(bytes, "Dictation");
      if (info.format !== "WAV" || info.encoding !== "signed int" || info.bitDepth < 16 || info.channels > 2 || info.sampleRate < 8000 || info.sampleRate > 192000) {
        throw new Error("Use mono or stereo PCM WAV recorded at 8–192 kHz.");
      }
      if (info.frames === 0) throw new Error("The recording has no audio frames.");
      if (info.frames / info.sampleRate > MAX_DICTATION_SECONDS) throw new Error("Dictation is limited to one minute.");
      // Validate sample data as well as container metadata before any service receives it.
      decoder.decode(bytes, "Dictation");
    } catch (error) {
      throw new DictationError(error instanceof Error ? error.message : "The recording is unreadable. Try dictating again.", 400);
    }
  }

  async transcribe(bytes: Uint8Array, signal?: AbortSignal, isCurrent?: () => boolean): Promise<string> {
    signal?.throwIfAborted();
    Dictation.validate(bytes);
    await mkdir(this.tempDir, { recursive: true });
    const directory = await mkdtemp(join(this.tempDir, "dictation-"));
    try {
      const path = join(directory, "speech.wav");
      await writeFile(path, bytes, { mode: 0o600 });
      signal?.throwIfAborted();
      if (isCurrent && !isCurrent()) throw new DictationError("The open song changed. Dictate again in the intended song.", 409);
      let text: string;
      try { text = (await this.services.transcribe(path, signal)).text.trim(); }
      catch (error) {
        if (signal?.aborted) throw new DictationError("Dictation cancelled.", 408);
        throw new DictationError("Transcription could not finish. Check the configured service and try again.", 502);
      }
      signal?.throwIfAborted();
      if (!text) throw new DictationError("No speech was recognised. Try dictating again.", 422);
      return text;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
