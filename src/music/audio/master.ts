import { FrequencyBands } from "./bands";
import { signed } from "./format";
import { FrequencyRegion } from "./regions";
import { ToneProfile } from "./tone";
import type { LoudnessTarget } from "../../shared/personalisation";

export interface MasterMeasure {
  /** Integrated loudness, LUFS. */
  integrated: number;
  /** True peak, dBTP. */
  truePeak: number;
  /** Highest short-term loudness, LUFS. */
  shortTermMax: number;
  /** Loudness range, LU. */
  range: number;
  /** Band levels in dB, as returned by spectrum(). */
  spectrum: number[];
}

export interface MasterCheckResult {
  ok: boolean;
  advice: string[];
}

export interface MasterCheckOptions {
  /** Integrated loudness passes within this many LU of the target. */
  toleranceLu: number;
  /** Loudness ranges outside this window get a note, LU. */
  narrowRangeLu: number;
  wideRangeLu: number;
  /** Tilt (dB per octave, third-octave levels from 100 Hz to 10 kHz) steeper than darkTilt sounds dull, flatter than brightTilt sounds bright, compared with most commercial masters. */
  darkTilt: number;
  brightTilt: number;
  /** A region this far above the tilt line stands out, dB. */
  buildUpDb: number;
}

export const DEFAULT_MASTER_OPTIONS: Readonly<MasterCheckOptions> = {
  toleranceLu: 1,
  narrowRangeLu: 3,
  wideRangeLu: 15,
  darkTilt: -5,
  brightTilt: -1,
  buildUpDb: 4,
};

/** Hints for regions that stand out above the tilt line. */
const BUILD_UP_HINTS: Partial<Record<FrequencyRegion, string>> = {
  [FrequencyRegion.Bass]: "the bass region (60–250 Hz) stands out and may sound boomy: check the kick and bass balance, or try a gentle low-shelf cut",
  [FrequencyRegion.LowMids]: "there is a build-up in the low mids (250–500 Hz) that can sound muddy: try a wide 1–2 dB cut there",
  [FrequencyRegion.HighMids]: "the high mids (2–4 kHz) stand out and can sound harsh on loud playback: try a gentle cut there, or check the brightest tracks",
  [FrequencyRegion.Presence]: "the presence region (4–6 kHz) stands out and can sound edgy or sibilant: check vocals and cymbals, or try a gentle cut there",
};

/** Compares Master readings with a loudness target and adds plain tonal-balance hints from the spectrum. */
export class MasterChecker {
  private readonly options: MasterCheckOptions;

  constructor(options: Partial<MasterCheckOptions> = {}) {
    this.options = { ...DEFAULT_MASTER_OPTIONS, ...options };
  }

  check(measure: MasterMeasure, target: LoudnessTarget): MasterCheckResult {
    if (!Number.isFinite(measure.integrated)) {
      return {
        ok: false,
        advice: ["No audio was measured: check that the song played during the measurement."],
      };
    }
    const advice: string[] = [];
    const loudnessOk = this.checkLoudness(measure, target, advice);
    const peakOk = this.checkTruePeak(measure, target, advice);
    this.checkRange(measure, advice);
    this.checkTone(measure, advice);
    return { ok: loudnessOk && peakOk, advice };
  }

  private checkLoudness(measure: MasterMeasure, target: LoudnessTarget, advice: string[]): boolean {
    const difference = measure.integrated - target.lufs;
    if (Math.abs(difference) <= this.options.toleranceLu) {
      advice.push(`Integrated loudness ${signed(measure.integrated)} LUFS is on target (${target.lufs} LUFS).`);
      return true;
    }
    if (difference > 0) {
      advice.push(
        `Integrated loudness ${signed(measure.integrated)} LUFS is ${difference.toFixed(1)} LU above the ${target.lufs} LUFS target: streaming services will turn it down by that much, so ease the limiter's gain by about ${difference.toFixed(1)} dB and keep the punch.`,
      );
    } else {
      advice.push(
        `Integrated loudness ${signed(measure.integrated)} LUFS is ${(-difference).toFixed(1)} LU below the ${target.lufs} LUFS target: raise the limiter's gain by about ${(-difference).toFixed(1)} dB, watching the true peak.`,
      );
    }
    return false;
  }

  private checkTruePeak(measure: MasterMeasure, target: LoudnessTarget, advice: string[]): boolean {
    if (measure.truePeak <= target.truePeak) {
      advice.push(`True peak ${signed(measure.truePeak)} dBTP is at or below the ${target.truePeak} dBTP ceiling.`);
      return true;
    }
    advice.push(
      `True peak ${signed(measure.truePeak)} dBTP is above the ${target.truePeak} dBTP ceiling: set the limiter's ceiling to ${target.truePeak} dB (true-peak mode if it has one), or lower it a little further, since encoding to lossy formats can add overs.`,
    );
    return false;
  }

  private checkRange(measure: MasterMeasure, advice: string[]): void {
    if (!(measure.range > 0)) return;
    if (measure.range < this.options.narrowRangeLu) {
      advice.push(
        `Loudness range is only ${measure.range.toFixed(1)} LU: the master may sound flat and over-compressed; ease the limiter or bus compression if it lacks punch.`,
      );
    } else if (measure.range > this.options.wideRangeLu) {
      advice.push(
        `Loudness range is ${measure.range.toFixed(1)} LU, which is wide: quiet passages may get lost on phones and in cars; gentle bus compression can help if that matters for this release.`,
      );
    }
  }

  private checkTone(measure: MasterMeasure, advice: string[]): void {
    const tone = new ToneProfile(measure.spectrum, new FrequencyBands(measure.spectrum.length));
    if (tone.silent) return;
    const tilt = tone.tilt;
    if (tilt < this.options.darkTilt) {
      advice.push(
        `The spectrum falls by ${(-tilt).toFixed(1)} dB per octave, darker than most commercial masters: compare with a reference track, and try a gentle high shelf (+1 to +2 dB above about 8 kHz) if it sounds dull.`,
      );
    } else if (tilt > this.options.brightTilt) {
      advice.push(
        `The spectrum is unusually flat towards the highs (${signed(tilt)} dB per octave), brighter than most commercial masters: compare with a reference track, and tame the top end if it sounds thin or harsh.`,
      );
    }
    for (const [region, hint] of Object.entries(BUILD_UP_HINTS) as [FrequencyRegion, string][]) {
      if (tone.deviation(region) > this.options.buildUpDb) advice.push(`Tonal balance: ${hint}.`);
    }
  }
}

/** Checks Master readings against a loudness target: ok when integrated loudness is within ±1 LU and the true peak is at or below the ceiling. */
export function masterCheck(measure: MasterMeasure, target: LoudnessTarget): MasterCheckResult {
  return new MasterChecker().check(measure, target);
}
