import { WavEncoder } from "./wav";

const MICROPHONE: MediaTrackConstraints = { channelCount: 1, echoCancellation: true, noiseSuppression: true };

/**
 * Records the microphone between two presses of Listen, then hands the take over as a mono 16-bit WAV:
 * the browser records it, the Web Audio API decodes it to samples, and WavEncoder writes the file.
 */
export class SpeechRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  /** The microphone is being opened; a second start waits for this one instead of opening it again. */
  private starting: Promise<void> | null = null;
  /** Goes up on cancel, so a microphone that opens after it is closed straight away. */
  private session = 0;

  start(): Promise<void> {
    if (this.recorder) return Promise.resolve();
    if (!this.starting) {
      this.starting = this.open().finally(() => {
        this.starting = null;
      });
    }
    return this.starting;
  }

  /** Stops recording and returns the take as a WAV file; at once when the recorder already stopped on its own. */
  async stop(): Promise<Blob> {
    const recorder = this.recorder;
    if (!recorder) throw new Error("nothing is being recorded");
    if (recorder.state !== "inactive") {
      const stopped = new Promise<void>((resolve) => recorder.addEventListener("stop", () => resolve(), { once: true }));
      recorder.stop();
      await stopped;
    }
    this.release();
    const take = new Blob(this.chunks, { type: recorder.mimeType });
    this.chunks = [];
    if (take.size === 0) throw new Error("nothing was recorded");
    return SpeechRecorder.toWav(take);
  }

  /** Stops without keeping the take. */
  cancel(): void {
    this.session += 1;
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.release();
    this.chunks = [];
  }

  private async open(): Promise<void> {
    if (!navigator.mediaDevices) throw new Error("this window has no access to a microphone");
    const session = this.session;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: MICROPHONE });
    if (session !== this.session) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    const recorder = new MediaRecorder(stream);
    this.chunks = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    });
    recorder.start();
    this.stream = stream;
    this.recorder = recorder;
  }

  private release(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.recorder = null;
  }

  private static async toWav(take: Blob): Promise<Blob> {
    const context = new AudioContext();
    try {
      return WavEncoder.monoWav(await context.decodeAudioData(await take.arrayBuffer()));
    } finally {
      void context.close();
    }
  }
}
