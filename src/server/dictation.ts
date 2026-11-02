import { t } from "../shared/i18n";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AudioFileDecoder } from "../audio/decode";
import type { Transcript } from "../services/types";
import { MAX_MICROPHONE_SECONDS } from "../shared/api";

export const MAX_DICTATION_BYTES = 16 * 1024 * 1024;
export const MAX_DICTATION_SECONDS = MAX_MICROPHONE_SECONDS + 0.25;

export class DictationError extends Error {
  constructor(message: string, readonly status: 400 | 408 | 409 | 413 | 422 | 502 | 503) { super(message); }
}

/** Dictation is temporary speech input, never a library asset or a submitted chat request. */
export class Dictation {
  constructor(private readonly services: { transcribe(path: string, signal?: AbortSignal): Promise<Transcript> }, private readonly tempDir: string) {}

  static validate(bytes: Uint8Array): void {
    if (bytes.byteLength === 0) throw new DictationError(t("server.dictation.theRecordingIsEmptyDictateAShort"), 400);
    if (bytes.byteLength > MAX_DICTATION_BYTES) throw new DictationError(t("server.dictation.sizeAndDurationLimit"), 413);
    try {
      const decoder = new AudioFileDecoder();
      const info = decoder.inspect(bytes, t("server.dictation.recording"));
      if (info.format !== "WAV" || info.encoding !== "signed int" || info.bitDepth !== 16 || info.channels !== 1 || ![16000, 24000].includes(info.sampleRate)) {
        throw new Error(t("server.dictation.useMonoOrStereoPCMWAVRecorded"));
      }
      if (info.frames === 0) throw new Error(t("server.dictation.theRecordingHasNoAudioFrames"));
      if (info.frames / info.sampleRate > MAX_DICTATION_SECONDS) throw new Error(t("server.dictation.durationLimit"));
    } catch (error) {
      throw new DictationError(error instanceof Error ? error.message : t("server.dictation.theRecordingIsUnreadableTryDictatingAgain"), 400);
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
      if (isCurrent && !isCurrent()) throw new DictationError(t("server.dictation.theOpenSongChangedDictateAgainIn"), 409);
      let text: string;
      try { text = (await this.services.transcribe(path, signal)).text.trim(); }
      catch (error) {
        if (signal?.aborted) throw new DictationError(t("server.dictation.dictationCancelled"), 408);
        throw new DictationError(t("server.dictation.transcriptionCouldNotFinishCheckTheConfigured"), 502);
      }
      signal?.throwIfAborted();
      if (!text) throw new DictationError(t("server.dictation.noSpeechWasRecognisedTryDictatingAgain"), 422);
      return text;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
