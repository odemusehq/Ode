import { decode } from "../music/audio/decode";
import { loudness } from "../music/audio/loudness";
import type { AudioData } from "../music/audio/types";
import { encodeWav, WavBitDepth } from "../music/audio/wav";

/** Music listening keeps source channels and sample rate; speech preparation remains separate. */
export class MusicAudio {
  async wav(path: string): Promise<Uint8Array<ArrayBuffer>> {
    return MusicAudio.encode(await decode(path));
  }

  async prepare(path: string) {
    const audio = await decode(path);
    return { bytes: MusicAudio.encode(audio), representation: { encoding: "PCM24 WAV", channels: audio.channels.length, sampleRate: audio.sampleRate, frames: audio.channels[0]?.length ?? 0, gainDb: -20 * Math.log10(MusicAudio.peak(audio)) } };
  }

  async comparison(a: string, b: string, levelMatch: boolean) {
    const [first, second] = await Promise.all([decode(a), decode(b)]);
    if (first.sampleRate !== second.sampleRate || first.channels.length !== second.channels.length) {
      throw new Error("Audio comparison needs matching sample rates and channel layouts; prepare matching files explicitly.");
    }
    const levels = [loudness(first).integrated, loudness(second).integrated];
    if (levelMatch && levels.some((level) => !Number.isFinite(level))) throw new Error("Loudness matching needs a measurable passage in both files.");
    const target = Math.min(...levels);
    const gains = levels.map((level) => levelMatch ? 10 ** ((target - level) / 20) : 1);
    const aFrames = first.channels[0]?.length ?? 0;
    const bFrames = second.channels[0]?.length ?? 0;
    const gap = Math.round(first.sampleRate * 0.5);
    const channels = first.channels.map((channel, index) => {
      const joined = new Float32Array(aFrames + gap + bFrames);
      joined.set(channel.map((sample) => sample * gains[0]!), 0);
      joined.set(second.channels[index]!.map((sample) => sample * gains[1]!), aFrames + gap);
      return joined;
    });
    const joinedAudio = { sampleRate: first.sampleRate, channels };
    return {
      bytes: MusicAudio.encode(joinedAudio),
      comparison: {
        method: "A then B in one WAV, separated by 0.5 seconds of silence",
        sampleRate: first.sampleRate,
        channels: channels.length,
        levelMatched: levelMatch,
        gainDb: gains.map((gain) => 20 * Math.log10(gain)),
        commonConversionGainDb: -20 * Math.log10(MusicAudio.peak(joinedAudio)),
        a: { startSeconds: 0, endSeconds: aFrames / first.sampleRate },
        b: { startSeconds: (aFrames + gap) / first.sampleRate, endSeconds: (aFrames + gap + bFrames) / first.sampleRate },
      },
    };
  }

  /** Uniform attenuation prevents integer clipping; relative stereo levels and full bandwidth remain. */
  private static encode(audio: AudioData): Uint8Array<ArrayBuffer> {
    const peak = MusicAudio.peak(audio);
    const channels = peak > 1 ? audio.channels.map((channel) => channel.map((sample) => sample / peak)) : audio.channels;
    return encodeWav({ sampleRate: audio.sampleRate, channels }, WavBitDepth.Int24);
  }

  private static peak(audio: AudioData): number {
    let peak = 1;
    for (const channel of audio.channels) for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
    return peak;
  }
}
