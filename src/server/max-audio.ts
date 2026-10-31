import { t } from "../shared/i18n";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { encodeWav, WavBitDepth } from "../audio/wav";
import { MAX_AUDIO, type MaxAudioCommand, type MaxAudioMessage, type MaxAudioRequest, type MaxAudioResult, type MaxAudioSources } from "../shared/max-audio";
import { MaxWindowError, type MaxWindowBridge } from "./max-window";

const text = z.string().min(1).max(512);
const source = z.object({ id: text, name: text, kind: z.enum(["device", "track", "group", "return", "main"]),
  stage: z.enum(["device-input", "pre-fx", "post-fx", "post-mixer"]), trackName: text.optional() }).strict();
const host = z.object({ trackName: text, deviceName: text }).strict();
const timing = z.object({ startedBeat: z.number().nullable(), endedBeat: z.number().nullable(),
  prerollBeats: z.number().min(0).max(64), rangeUncertainty: z.string().min(1).max(1000) }).strict();
const id = z.uuid();
const samples = z.array(z.number()).min(1).max(MAX_AUDIO.chunkFrames);
const messageSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sources"), id, catalogueId: text, sources: z.array(source).max(MAX_AUDIO.maxSources), host }).strict(),
  z.object({ kind: z.literal("begin"), id, catalogueId: text, sourceId: text, sampleRate: z.number().int().min(8000).max(384000),
    channels: z.literal(2), frames: z.number().int().min(1).max(MAX_AUDIO.maxFrames) }).strict(),
  z.object({ kind: z.literal("chunk"), id, offset: z.number().int().min(0), channels: z.tuple([samples, samples]) }).strict(),
  z.object({ kind: z.literal("pcm"), id, offset: z.number().int().min(0), data: z.string().min(4).max(Math.ceil(MAX_AUDIO.pcmChunkFrames * 8 / 3) * 4) }).strict(),
  z.object({ kind: z.literal("complete"), id, frames: z.number().int().min(1).max(MAX_AUDIO.maxFrames), timing }).strict(),
  z.object({ kind: z.literal("error"), id, error: z.string().min(1).max(1000) }).strict(),
]);
const requestSchema = z.object({ sourceId: text, durationSeconds: z.number().positive().max(MAX_AUDIO.maxDurationSeconds),
  startBeat: z.number().min(0).optional(), prerollBeats: z.number().min(0).max(64).optional() }).strict();

interface Pending {
  command: Exclude<MaxAudioCommand, { kind: "cancel" }>;
  resolve: (result: MaxAudioSources | MaxAudioResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  abort?: () => void;
  signal?: AbortSignal;
  session?: string;
  acknowledged: boolean;
  pcm?: { sampleRate: number; frames: number; offset: number; channels: [Float32Array, Float32Array] };
  finishing?: boolean;
}

/** One bounded job in the paired device. Only this service chooses and writes output paths. */
export class MaxAudioCapture {
  private pending: Pending | null = null;
  private catalogue: MaxAudioSources | null = null;
  private cancellation: MaxAudioCommand | null = null;
  private readonly window: MaxWindowBridge;
  private readonly tempDir: string;

  constructor({ tempDir, window }: { tempDir: string; window: MaxWindowBridge }) {
    this.tempDir = tempDir;
    this.window = window;
    window.attachAudio(this);
  }

  async sources(signal?: AbortSignal): Promise<MaxAudioSources> {
    this.ready(signal);
    this.catalogue = null;
    return this.queue({ kind: "sources", id: randomUUID() }, 10_000, signal) as Promise<MaxAudioSources>;
  }

  async capture(input: MaxAudioRequest, signal?: AbortSignal): Promise<MaxAudioResult> {
    this.ready(signal);
    const request = requestSchema.parse(input);
    if (request.startBeat === undefined && request.prerollBeats) throw new Error(t("server.maxAudio.preRollNeedsAnArrangementStartBeat"));
    if (!this.catalogue?.sources.some((item) => item.id === request.sourceId)) throw new Error(t("server.maxAudio.readTheAvailableMaxAudioSourcesBefore"));
    return this.queue({ kind: "capture", id: randomUUID(), catalogueId: this.catalogue.catalogueId, ...request },
      request.durationSeconds * 1000 + Math.min(request.prerollBeats ?? 0, request.startBeat ?? 0) * 3000 + 120_000,
      signal) as Promise<MaxAudioResult>;
  }

  poll(): MaxAudioCommand | null {
    if (this.cancellation) { const command = this.cancellation; this.cancellation = null; return command; }
    return this.pending && !this.pending.acknowledged ? this.pending.command : null;
  }

  /** The private Max session authenticates a known job, never an arbitrary file or Live operation. */
  async receive(session: string, input: unknown): Promise<void> {
    this.window.verifySession(session);
    const job = this.pending;
    const parsed = messageSchema.safeParse(input);
    if (!parsed.success) {
      if (job && typeof input === "object" && input !== null && "id" in input && input.id === job.command.id) this.fail(new Error(t("server.maxAudio.invalidMaxAudioMessageTheCaptureWas")));
      throw new MaxWindowError(t("server.maxAudio.invalidMaxAudioMessage"), 409);
    }
    const message: MaxAudioMessage = parsed.data;
    if (!job || message.id !== job.command.id) throw new MaxWindowError(t("server.maxAudio.thatMaxAudioJobIsNoLonger"));
    if (job.session && job.session !== session) throw new MaxWindowError(t("server.maxAudio.thatMaxAudioJobBelongsToAnother"), 403);
    job.session = session;
    job.acknowledged = true;
    try {
      if (message.kind === "error") throw new Error(message.error);
      if (job.finishing) throw new Error(t("server.maxAudio.theMaxAudioCaptureIsAlreadyBeing"));
      if (job.command.kind === "sources") {
        if (message.kind !== "sources") throw new Error(t("server.maxAudio.maxMustReturnTheRequestedSourceCatalogue"));
        if (new Set(message.sources.map((item) => item.id)).size !== message.sources.length) throw new Error(t("server.maxAudio.maxReturnedDuplicateAudioSourceIdentities"));
        this.catalogue = { catalogueId: message.catalogueId, sources: message.sources, host: message.host };
        this.finish(job, this.catalogue);
        return;
      }
      if (message.kind === "begin") {
        if (job.pcm || message.catalogueId !== job.command.catalogueId || message.sourceId !== job.command.sourceId) throw new Error(t("server.maxAudio.maxAudioSourceIdentityChangedBeforeCapture"));
        if (message.frames > Math.ceil(job.command.durationSeconds * message.sampleRate) + MAX_AUDIO.chunkFrames) throw new Error(t("server.maxAudio.maxAudioCaptureExceedsTheRequestedDuration"));
        job.pcm = { sampleRate: message.sampleRate, frames: message.frames, offset: 0,
          channels: [new Float32Array(message.frames), new Float32Array(message.frames)] };
        this.progress(job);
        return;
      }
      const pcm = job.pcm;
      if (!pcm) throw new Error(t("server.maxAudio.maxMustBeginThePCMTransferBefore"));
      if (message.kind === "chunk" || message.kind === "pcm") {
        let channels: readonly (readonly number[] | Float32Array)[];
        if (message.kind === "pcm") {
          const bytes = Buffer.from(message.data, "base64");
          if (!bytes.length || bytes.length % 8 || bytes.toString("base64") !== message.data) throw new Error(t("server.maxAudio.maxAudioChunkOffsetOrderOrChannel"));
          const count = bytes.length / 8;
          channels = [new Float32Array(count), new Float32Array(count)];
          for (let frame = 0; frame < count; frame++) for (let channel = 0; channel < 2; channel++) (channels[channel] as Float32Array)[frame] = bytes.readFloatLE(frame * 8 + channel * 4);
        } else channels = message.channels;
        const count = channels[0]!.length;
        if (message.offset !== pcm.offset || channels[1]!.length !== count || pcm.offset + count > pcm.frames) throw new Error(t("server.maxAudio.maxAudioChunkOffsetOrderOrChannel"));
        for (let channel = 0; channel < 2; channel++) {
          // Finite doubles can still overflow float32; reject those rather than writing Infinity.
          if (channels[channel]!.some((value) => !Number.isFinite(Math.fround(value)))) throw new Error(t("server.maxAudio.maxAudioSamplesMustBeFiniteFloat32"));
          pcm.channels[channel]!.set(channels[channel]!, pcm.offset);
        }
        pcm.offset += count;
        this.progress(job);
        return;
      }
      if (message.kind !== "complete" || message.frames !== pcm.frames || pcm.offset !== pcm.frames) throw new Error(t("server.maxAudio.maxAudioTransferIsIncompleteOrHas"));
      const catalogue = this.catalogue;
      const selectedId = job.command.sourceId;
      const selected = catalogue?.sources.find((item) => item.id === selectedId);
      if (!catalogue || !selected || catalogue.catalogueId !== job.command.catalogueId) throw new Error(t("server.maxAudio.theMaxAudioCatalogueChangedDuringCapture"));
      job.finishing = true;
      const bytes = encodeWav({ sampleRate: pcm.sampleRate, channels: pcm.channels }, WavBitDepth.Float32);
      const filePath = join(this.tempDir, `ode-max-${randomUUID()}.wav`);
      try {
        await mkdir(this.tempDir, { recursive: true });
        await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
        this.window.verifySession(session);
        if (this.pending !== job || job.signal?.aborted) throw new Error(t("server.maxAudio.theMaxAudioCaptureWasCancelled"));
        const written = await readFile(filePath);
        this.window.verifySession(session);
        if (this.pending !== job || job.signal?.aborted) throw new Error(t("server.maxAudio.theMaxAudioCaptureWasCancelled"));
        if (!written.equals(bytes)) throw new Error(t("server.maxAudio.theCompletedMaxAudioFileChangedWhile"));
        const { kind: _kind, id: _id, catalogueId: _catalogueId, ...requested } = job.command;
        this.finish(job, { path: filePath, sha256: createHash("sha256").update(written).digest("hex"), bytes: written.length,
          frames: pcm.frames, sampleRate: pcm.sampleRate, channels: 2, durationSeconds: pcm.frames / pcm.sampleRate,
          source: selected, host: catalogue.host, timing: message.timing, requested });
      } catch (error) { await rm(filePath, { force: true }); throw error; }
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      if (this.pending === job) this.fail(failure);
      throw new MaxWindowError(failure.message);
    }
  }

  invalidate(): void {
    this.catalogue = null;
    this.cancellation = null;
    this.fail(new Error(t("server.maxAudio.theMaxDeviceDisconnectedOrChangedAudio")), false);
  }

  private ready(signal?: AbortSignal): void {
    signal?.throwIfAborted();
    if (!this.window.supportsAudio) throw new Error(t("server.maxAudio.loadTheUpdatedOdeMaxDeviceTo"));
    if (this.pending) throw new Error(t("server.maxAudio.odeIsAlreadyCapturingOrReadingMax"));
  }

  private queue(command: Pending["command"], timeout: number, signal?: AbortSignal): Promise<MaxAudioSources | MaxAudioResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error(t("server.maxAudio.theMaxAudioRequestTimedOutIts"))), timeout);
      timer.unref?.();
      const job: Pending = { command, resolve, reject, timer, signal, acknowledged: false };
      this.pending = job;
      if (signal) {
        job.abort = () => this.fail(new Error(t("server.maxAudio.theMaxAudioRequestWasCancelled")));
        signal.addEventListener("abort", job.abort, { once: true });
        if (signal.aborted) job.abort();
      }
    });
  }

  private finish(job: Pending, result: MaxAudioSources | MaxAudioResult): void {
    this.clear(job);
    job.resolve(result);
  }

  private fail(error: Error, sendCancel = true): void {
    const job = this.pending;
    if (!job) return;
    if (sendCancel) this.cancellation = { kind: "cancel", id: job.command.id };
    this.clear(job);
    job.reject(error);
  }

  private clear(job: Pending): void {
    clearTimeout(job.timer);
    if (job.abort) job.signal?.removeEventListener("abort", job.abort);
    if (this.pending === job) this.pending = null;
  }

  /** Once recording is complete, allow ordered transfer progress without a song-length cutoff. */
  private progress(job: Pending): void {
    clearTimeout(job.timer);
    job.timer = setTimeout(() => this.fail(new Error(t("server.maxAudio.theMaxAudioRequestTimedOutIts"))), 60_000);
  }
}
