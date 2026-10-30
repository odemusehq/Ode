import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { encodeWav, WavBitDepth } from "../music/audio/wav";
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
    if (request.startBeat === undefined && request.prerollBeats) throw new Error("Pre-roll needs an Arrangement start beat.");
    if (!this.catalogue?.sources.some((item) => item.id === request.sourceId)) throw new Error("Read the available Max audio sources before selecting a capture source.");
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
      if (job && typeof input === "object" && input !== null && "id" in input && input.id === job.command.id) this.fail(new Error("Invalid Max audio message; the capture was cancelled."));
      throw new MaxWindowError("Invalid Max audio message.", 409);
    }
    const message: MaxAudioMessage = parsed.data;
    if (!job || message.id !== job.command.id) throw new MaxWindowError("That Max audio job is no longer waiting.");
    if (job.session && job.session !== session) throw new MaxWindowError("That Max audio job belongs to another session.", 403);
    job.session = session;
    job.acknowledged = true;
    try {
      if (message.kind === "error") throw new Error(message.error);
      if (job.finishing) throw new Error("The Max audio capture is already being completed.");
      if (job.command.kind === "sources") {
        if (message.kind !== "sources") throw new Error("Max must return the requested source catalogue.");
        if (new Set(message.sources.map((item) => item.id)).size !== message.sources.length) throw new Error("Max returned duplicate audio source identities.");
        this.catalogue = { catalogueId: message.catalogueId, sources: message.sources, host: message.host };
        this.finish(job, this.catalogue);
        return;
      }
      if (message.kind === "begin") {
        if (job.pcm || message.catalogueId !== job.command.catalogueId || message.sourceId !== job.command.sourceId) throw new Error("Max audio source identity changed before capture.");
        if (message.frames > Math.ceil(job.command.durationSeconds * message.sampleRate) + MAX_AUDIO.chunkFrames) throw new Error("Max audio capture exceeds the requested duration.");
        job.pcm = { sampleRate: message.sampleRate, frames: message.frames, offset: 0,
          channels: [new Float32Array(message.frames), new Float32Array(message.frames)] };
        return;
      }
      const pcm = job.pcm;
      if (!pcm) throw new Error("Max must begin the PCM transfer before sending samples.");
      if (message.kind === "chunk") {
        const count = message.channels[0].length;
        if (message.offset !== pcm.offset || message.channels[1].length !== count || pcm.offset + count > pcm.frames) throw new Error("Max audio chunk offset, order or channel length is invalid.");
        for (let channel = 0; channel < 2; channel++) {
          // Finite doubles can still overflow float32; reject those rather than writing Infinity.
          if (message.channels[channel]!.some((value) => !Number.isFinite(Math.fround(value)))) throw new Error("Max audio samples must be finite float32 values.");
          pcm.channels[channel]!.set(message.channels[channel]!, pcm.offset);
        }
        pcm.offset += count;
        return;
      }
      if (message.kind !== "complete" || message.frames !== pcm.frames || pcm.offset !== pcm.frames) throw new Error("Max audio transfer is incomplete or has a different frame count.");
      const catalogue = this.catalogue;
      const selectedId = job.command.sourceId;
      const selected = catalogue?.sources.find((item) => item.id === selectedId);
      if (!catalogue || !selected || catalogue.catalogueId !== job.command.catalogueId) throw new Error("The Max audio catalogue changed during capture.");
      job.finishing = true;
      const bytes = encodeWav({ sampleRate: pcm.sampleRate, channels: pcm.channels }, WavBitDepth.Float32);
      const filePath = join(this.tempDir, `ode-max-${randomUUID()}.wav`);
      try {
        await mkdir(this.tempDir, { recursive: true });
        await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
        this.window.verifySession(session);
        if (this.pending !== job || job.signal?.aborted) throw new Error("The Max audio capture was cancelled.");
        const written = await readFile(filePath);
        this.window.verifySession(session);
        if (this.pending !== job || job.signal?.aborted) throw new Error("The Max audio capture was cancelled.");
        if (!written.equals(bytes)) throw new Error("The completed Max audio file changed while it was published.");
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
    this.fail(new Error("The Max device disconnected or changed; audio capture was cancelled."), false);
  }

  private ready(signal?: AbortSignal): void {
    signal?.throwIfAborted();
    if (!this.window.supportsAudio) throw new Error("Load the updated Ode Max device to capture audio.");
    if (this.pending) throw new Error("Ode is already capturing or reading Max audio sources. Wait for it to finish.");
  }

  private queue(command: Pending["command"], timeout: number, signal?: AbortSignal): Promise<MaxAudioSources | MaxAudioResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error("The Max audio request timed out; its partial capture was discarded.")), timeout);
      timer.unref?.();
      const job: Pending = { command, resolve, reject, timer, signal, acknowledged: false };
      this.pending = job;
      if (signal) {
        job.abort = () => this.fail(new Error("The Max audio request was cancelled."));
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
}
