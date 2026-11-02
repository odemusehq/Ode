import { t } from "../../shared/i18n";
import { MAX_MICROPHONE_SECONDS as MAX_SECONDS } from "../../shared/api";
export type RecordingKind = "dictation" | "audio";

/** Feature detection only: permission and the browser's actual recording/decoding can still fail. */
export function microphoneSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined" && typeof AudioContext !== "undefined" && typeof OfflineAudioContext !== "undefined";
}

/** PCM WAV bytes, independent of a browser's chosen compressed recording container. */
export function encodeMonoWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array<ArrayBuffer> {
  const first = channels[0];
  if (channels.length !== 1 || !first?.length || !Number.isInteger(sampleRate) || sampleRate < 1 || sampleRate > 192_000 ||
    channels.some((channel) => channel.length !== first.length || channel.some((sample) => !Number.isFinite(sample)))) {
    throw new Error(t("dictation.unreadableAudio"));
  }
  if (first.length > Math.floor(sampleRate * (MAX_SECONDS + 0.25))) throw new Error(t("dictation.tooLong"));
  const frames = first.length;
  const bytes = new Uint8Array(44 + frames * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((letter, index) => view.setUint8(offset + index, letter.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + frames * 2, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, frames * 2, true);
  for (let frame = 0; frame < frames; frame++) {
    view.setInt16(44 + frame * 2, Math.round(Math.max(-1, Math.min(1, first[frame]!)) * 0x7fff), true);
  }
  return bytes;
}

/** One explicit microphone recording, with cancellation even while the browser's permission prompt is pending. */
export class MicrophoneRecorder {
  private cancelled = false;
  private started = false;
  private finishing = false;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private capture: Promise<Blob> | null = null;
  private rejectCapture: (error: unknown) => void = () => undefined;

  constructor(
    private readonly onLimit: () => void,
    private readonly onError: (error: Error) => void,
    private readonly kind: RecordingKind = "dictation",
    private readonly getMedia = (constraints: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(constraints),
  ) {}

  async start(): Promise<void> {
    if (this.started) throw new Error(t("dictation.newRecordingRequired"));
    this.started = true;
    const speech = this.kind === "dictation";
    const stream = await this.getMedia({ audio: { channelCount: 1, echoCancellation: speech, noiseSuppression: speech,
      ...(!speech ? { autoGainControl: false } : {}) } });
    if (this.cancelled) { stream.getTracks().forEach((track) => track.stop()); throw MicrophoneRecorder.aborted(); }
    this.stream = stream;
    try {
      const recorder = new MediaRecorder(stream);
      this.recorder = recorder;
      const chunks: Blob[] = [];
      this.capture = new Promise((resolve, reject) => {
        this.rejectCapture = reject;
        recorder.ondataavailable = (event) => { if (!this.cancelled && event.data.size) chunks.push(event.data); };
        recorder.onstop = () => this.cancelled ? reject(MicrophoneRecorder.aborted()) : resolve(new Blob(chunks, { type: recorder.mimeType }));
        recorder.onerror = () => {
          const error = new Error(t("dictation.recordingFailed"));
          reject(error);
          this.cancel();
          this.onError(error);
        };
      });
      // A recording can fail before Finish is pressed; its error is also reported through onError.
      void this.capture.catch(() => undefined);
      recorder.start();
      this.timer = setTimeout(this.onLimit, MAX_SECONDS * 1_000);
    } catch (error) { this.cancel(); throw error; }
  }

  async finish(): Promise<File> {
    if (this.cancelled) throw MicrophoneRecorder.aborted();
    if (!this.recorder || !this.capture || this.finishing) throw new Error(t("dictation.notReady"));
    this.finishing = true;
    this.clearTimer();
    const capture = this.capture;
    let context: AudioContext | null = null;
    try {
      if (this.recorder.state !== "inactive") this.recorder.stop();
      this.releaseTracks();
      // stop fires after the final dataavailable event; a partial compressed chunk is not a complete recording.
      const blob = await capture;
      if (this.cancelled) throw MicrophoneRecorder.aborted();
      if (!blob.size) throw new Error(t("dictation.emptyRecording"));
      const sampleRate = this.kind === "audio" ? 48_000 : 24_000;
      try { context = new AudioContext({ sampleRate }); }
      catch { context = new AudioContext(); }
      this.context = context;
      const audio = await context.decodeAudioData(await blob.arrayBuffer());
      if (this.cancelled) throw MicrophoneRecorder.aborted();
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) throw new Error(t("dictation.unreadableAudio"));
      if (audio.duration > MAX_SECONDS + 0.25) throw new Error(t("dictation.tooLong"));
      // The browser performs channel mixing and sample-rate conversion through its native audio graph.
      const output = new OfflineAudioContext(1, Math.ceil(audio.duration * sampleRate), sampleRate);
      const source = output.createBufferSource();
      source.buffer = audio;
      source.connect(output.destination);
      source.start();
      const mono = await output.startRendering();
      if (this.cancelled) throw MicrophoneRecorder.aborted();
      const bytes = encodeMonoWav([mono.getChannelData(0)], mono.sampleRate);
      return new File([bytes], this.kind === "audio" ? t("chat.audioFileName") : "dictation.wav", { type: "audio/wav" });
    } finally {
      this.releaseTracks();
      if (context && context.state !== "closed") await context.close().catch(() => undefined);
      this.context = null;
      this.recorder = null;
    }
  }

  cancel(): void {
    this.cancelled = true;
    this.clearTimer();
    this.rejectCapture(MicrophoneRecorder.aborted());
    if (this.recorder && this.recorder.state !== "inactive") {
      try { this.recorder.stop(); } catch { /* Tracks are still released when a browser rejects stop. */ }
    }
    this.releaseTracks();
    if (this.context && this.context.state !== "closed") void this.context.close().catch(() => undefined);
  }

  private clearTimer(): void { if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }
  private releaseTracks(): void { this.stream?.getTracks().forEach((track) => track.stop()); this.stream = null; }
  private static aborted(): DOMException { return new DOMException(t("dictation.cancelled"), "AbortError"); }
}
