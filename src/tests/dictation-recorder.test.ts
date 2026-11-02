import assert from "node:assert/strict";
import { test } from "node:test";
import { AudioFileDecoder } from "../audio/decode";
import { MicrophoneRecorder, encodeMonoWav } from "../ui/app/microphone";

test("dictation encodes real mono PCM WAV and refuses overlong or damaged speech", () => {
  const bytes = encodeMonoWav([Float32Array.from([1, -1, 0])], 24_000);
  const audio = new AudioFileDecoder().decode(bytes, "dictation.wav");
  assert.equal(audio.sampleRate, 24_000);
  assert.equal(audio.channels.length, 1);
  assert.ok(Math.abs(audio.channels[0]![0]! - 1) < 0.001);
  assert.ok(Math.abs(audio.channels[0]![1]! + 1) < 0.001);
  const complete = encodeMonoWav([new Float32Array(8_000 * 60.1)], 8_000);
  assert.equal(new AudioFileDecoder().inspect(complete, "dictation.wav").frames, 8_000 * 60.1);
  assert.throws(() => encodeMonoWav([new Float32Array(8_000 * 61)], 8_000), /60 seconds/);
  assert.throws(() => encodeMonoWav([Float32Array.from([0, Number.NaN])], 24_000), /unreadable/);
  assert.throws(() => encodeMonoWav([Float32Array.of(0), Float32Array.of(0)], 24_000), /unreadable/, "The serializer must not downmix channels itself.");
});

test("cancelling an unanswered microphone permission releases any stream granted later", async () => {
  let grant!: (stream: MediaStream) => void;
  let stopped = 0;
  const permission = new Promise<MediaStream>((resolve) => { grant = resolve; });
  const recorder = new MicrophoneRecorder(() => undefined, () => undefined, "dictation", () => permission);
  const starting = recorder.start();
  recorder.cancel();
  grant({ getTracks: () => [{ stop: () => { stopped++; } }] } as unknown as MediaStream);
  await assert.rejects(starting, { name: "AbortError" });
  assert.equal(stopped, 1);
});

test("music recording requests a microphone without speech processing", async () => {
  let grant!: (stream: MediaStream) => void, constraints: MediaStreamConstraints | undefined;
  const permission = new Promise<MediaStream>(resolve => { grant = resolve; });
  const recorder = new MicrophoneRecorder(() => undefined, () => undefined, "audio",
    requested => { constraints = requested; return permission; });
  const starting = recorder.start();
  recorder.cancel();
  grant({ getTracks: () => [{ stop: () => undefined }] } as unknown as MediaStream);
  await assert.rejects(starting, { name: "AbortError" });
  assert.deepEqual(constraints, { audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
});
