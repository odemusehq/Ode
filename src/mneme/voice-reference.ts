import { mkdir, open, readFile, readdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { z } from "zod";
import { encodeWav, WavBitDepth } from "../music/audio/wav";
import { AudioFileDecoder } from "../music/audio/decode";
import { MusicAudio, audioHash } from "../services/music-audio";
import { JsonFile } from "./json-file";

/** Where the recording came from in the Arrangement, kept with the artist's consent. */
const VoiceSourceSchema = z.object({ track: z.record(z.string(), z.unknown()), start: z.number().finite().min(0), end: z.number().finite().positive() })
  .refine(({ start, end }) => end > start, "The voice recording needs a nonempty source range.");
export type VoiceSource = z.infer<typeof VoiceSourceSchema>;
const HASH = z.string().regex(/^[a-f0-9]{64}$/);
const RECORDING = /^reference-[a-f0-9-]{36}\.wav$/;
const LegacyConsentSchema = z.object({ version: z.undefined().optional(), agreed: z.literal(true), time: z.iso.datetime(), source: VoiceSourceSchema }).strict();
const ConsentSchema = LegacyConsentSchema.extend({ version: z.literal(2), recording: z.string().regex(RECORDING), sha256: HASH,
  bytes: z.number().int().positive(), inputSha256: HASH });
type Consent = z.infer<typeof ConsentSchema> | z.infer<typeof LegacyConsentSchema>;

export interface VoiceReferenceEvidence {
  consentBinding: "hash-bound" | "legacy-positive-unbound";
  agreedAt: string;
  source: VoiceSource;
  inputSha256?: string;
  cleanupError?: string;
  reference: ReturnType<AudioFileDecoder["inspect"]> & { sha256: string; bytes: number };
  note: string;
}

interface VoiceState { queue: Promise<unknown>; revocation: AbortController }
const states = new Map<string, VoiceState>();

/** Positive consent and its recording stay in persistent storage; each synthesis uses a private frozen copy. */
export class VoiceReference {
  private readonly state: VoiceState;

  constructor(private readonly folder: string) {
    const key = resolve(folder);
    this.state = states.get(key) ?? { queue: Promise.resolve(), revocation: new AbortController() };
    states.set(key, this.state);
  }

  private get consent(): string { return join(this.folder, "consent.json"); }

  async ready(): Promise<boolean> {
    try { await this.read(this.state.revocation.signal); return true; }
    catch { return false; }
  }

  /** Publish the new consent last; an interrupted replacement leaves the previous valid reference in place. */
  save(render: string, input: VoiceSource, signal?: AbortSignal): Promise<VoiceReferenceEvidence> {
    const source = VoiceSourceSchema.parse(input);
    const active = this.signal(signal);
    return this.enqueue(async () => {
      active.throwIfAborted();
      const frozen = await MusicAudio.freeze(render);
      const { audio } = MusicAudio.decode(frozen);
      if (!audio.channels[0]?.length) throw new Error("The voice recording has no sample frames.");
      if (!Number.isInteger(audio.sampleRate) || audio.sampleRate * audio.channels.length * 4 > 0xffffffff) throw new Error("Export the voice recording with an integer sample rate representable in PCM WAV.");
      const bytes = encodeWav(audio, WavBitDepth.Float32);
      active.throwIfAborted();
      await mkdir(this.folder, { recursive: true, mode: 0o700 });
      const recording = `reference-${randomUUID()}.wav`, path = join(this.folder, recording);
      let published = false;
      let created = false;
      try {
        const file = await open(path, "wx", 0o600);
        created = true;
        try { await file.writeFile(bytes); await file.sync(); }
        finally { await file.close(); }
        active.throwIfAborted();
        const consent = ConsentSchema.parse({ version: 2, agreed: true, time: new Date().toISOString(), source,
          recording, sha256: audioHash(bytes), bytes: bytes.length, inputSha256: frozen.source.sha256 });
        await JsonFile.writeAtomically(this.consent, `${JSON.stringify(consent, null, 2)}\n`, 0o600, active);
        published = true;
        // Existing synthesis reads a separate frozen copy, so old generations are no longer needed here.
        const evidence = this.evidence(consent, bytes);
        if (!active.aborted) {
          try { await this.removeRecordings(recording); }
          catch (error) { evidence.cleanupError = `The new reference was saved, but removing older recordings failed: ${error instanceof Error ? error.message : String(error)}`; }
        }
        return evidence;
      } finally {
        if (created && !published) await rm(path, { force: true });
      }
    });
  }

  /** A later save/clear cannot change the bytes being uploaded by this synthesis call. */
  async withRecording<T>(path: string, use: (path: string, evidence: VoiceReferenceEvidence, signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const active = this.signal(signal);
    const captured = await this.read(active);
    active.throwIfAborted();
    let created = false;
    try {
      const file = await open(path, "wx", 0o600);
      created = true;
      try { await file.writeFile(captured.bytes); }
      finally { await file.close(); }
      active.throwIfAborted();
      if (await readFile(this.consent, "utf8") !== captured.consentText) throw new Error("The saved voice consent changed before synthesis. Read the current reference again.");
      active.throwIfAborted();
      return await use(path, captured.evidence, active);
    } finally { if (created) await rm(path, { force: true }); }
  }

  /** Revocation cancels existing local leases before removing the consent and retained recordings. */
  clear(): Promise<void> {
    this.state.revocation.abort();
    this.state.revocation = new AbortController();
    return this.enqueue(async () => {
      await rm(this.consent, { force: true });
      await this.removeRecordings();
    });
  }

  private async read(signal: AbortSignal) {
    await this.state.queue;
    signal.throwIfAborted();
    const consentText = await readFile(this.consent, "utf8");
    const raw = JSON.parse(consentText);
    const consent: Consent = raw.version === undefined ? LegacyConsentSchema.parse(raw) : ConsentSchema.parse(raw);
    const path = join(this.folder, consent.version === 2 ? consent.recording : "reference.wav");
    const bytes = await readFile(path);
    const metadata = new AudioFileDecoder().inspect(bytes, "saved voice reference");
    if (metadata.format !== "WAV" || !metadata.frames) throw new Error("The saved voice reference must be a nonempty WAV recording.");
    new AudioFileDecoder().decode(bytes, "saved voice reference", { rejectNonfinite: true });
    if (consent.version === 2 && (audioHash(bytes) !== consent.sha256 || bytes.length !== consent.bytes)) throw new Error("The voice reference no longer matches its saved consent.");
    signal.throwIfAborted();
    if (await readFile(this.consent, "utf8") !== consentText) throw new Error("The saved voice consent changed during the read.");
    signal.throwIfAborted();
    return { bytes, consentText, evidence: this.evidence(consent, bytes) };
  }

  private evidence(consent: Consent, bytes: Uint8Array): VoiceReferenceEvidence {
    const bound = consent.version === 2;
    return { consentBinding: bound ? "hash-bound" : "legacy-positive-unbound", agreedAt: consent.time, source: consent.source,
      ...(bound ? { inputSha256: consent.inputSha256 } : {}),
      reference: { ...new AudioFileDecoder().inspect(bytes, "voice reference"), sha256: audioHash(bytes), bytes: bytes.length },
      note: bound ? "These exact reference bytes match saved positive consent; this does not verify the speaker's identity or ownership."
        : "Legacy positive consent is present; it did not record an earlier source hash. The dispatched bytes are frozen and identified, while historical byte binding and speaker identity remain unverified." };
  }

  private signal(signal?: AbortSignal): AbortSignal {
    return signal ? AbortSignal.any([signal, this.state.revocation.signal]) : this.state.revocation.signal;
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.state.queue.then(work, work);
    this.state.queue = run.catch(() => undefined);
    return run;
  }

  private async removeRecordings(keep?: string): Promise<void> {
    let names: string[];
    try { names = await readdir(this.folder); }
    catch (error) { if (JsonFile.isMissing(error)) return; throw error; }
    for (const name of names) if (name !== keep && (name === "reference.wav" || RECORDING.test(name))) await rm(join(this.folder, name), { force: true });
  }
}
