import { signed } from "./format";
import { median } from "./signal";
import { sumDb } from "./units";

export interface TrackLevel {
  name: string;
  /** Peak level, dBFS (true peak when available). */
  peak: number;
  /** Integrated loudness, LUFS. */
  loudness: number;
}

/** The gain-staging problems levelCheck reports. */
export enum LevelIssue {
  Silent = "silent",
  Clipping = "clipping",
  LittleHeadroom = "little headroom",
  TooQuiet = "too quiet",
  MuchLouder = "much louder than the rest",
  MuchQuieter = "much quieter than the rest",
  HotMix = "hot mix",
}

export interface LevelFinding {
  /** The track concerned, or null for the tracks as a whole. */
  track: string | null;
  issue: LevelIssue;
  advice: string;
}

export interface LevelCheckOptions {
  /** Peaks at or above this are clipping or about to, dBFS. */
  clipDbfs: number;
  /** Peaks above this leave too little headroom, dBFS. */
  headroomDbfs: number;
  /** Peaks below this are low enough to raise, dBFS. */
  quietDbfs: number;
  /** Gain-staging window for track peaks while mixing, dBFS. */
  targetPeak: { low: number; high: number };
  /** A track this far above or below the median loudness gets a balance note, LU. */
  louderLu: number;
  quieterLu: number;
  /** Tracks summing louder than this leave the Master little headroom, LUFS. */
  hotMixLufs: number;
}

export const DEFAULT_LEVEL_OPTIONS: Readonly<LevelCheckOptions> = {
  clipDbfs: -0.1,
  headroomDbfs: -3,
  quietDbfs: -30,
  targetPeak: { low: -12, high: -6 },
  louderLu: 8,
  quieterLu: 15,
  hotMixLufs: -12,
};

/** Gain-staging review of a set of tracks: clipping, headroom, very low levels, balance and the summed level. */
export class LevelChecker {
  private readonly options: LevelCheckOptions;

  constructor(options: Partial<LevelCheckOptions> = {}) {
    this.options = { ...DEFAULT_LEVEL_OPTIONS, ...options };
  }

  check(tracks: readonly TrackLevel[]): LevelFinding[] {
    const findings: LevelFinding[] = [];
    const audible = tracks.filter((track) => Number.isFinite(track.peak) && Number.isFinite(track.loudness));
    for (const track of tracks) {
      if (!audible.includes(track)) {
        findings.push({ track: track.name, issue: LevelIssue.Silent, advice: `${track.name} has no audio in this range.` });
        continue;
      }
      const finding = this.peakFinding(track);
      if (finding) findings.push(finding);
    }
    findings.push(...this.balanceFindings(audible));
    const hot = this.hotMixFinding(audible);
    if (hot) findings.push(hot);
    return findings;
  }

  private peakFinding(track: TrackLevel): LevelFinding | null {
    const { clipDbfs, headroomDbfs, quietDbfs, targetPeak } = this.options;
    const peak = signed(track.peak);
    if (track.peak >= clipDbfs) {
      return {
        track: track.name,
        issue: LevelIssue.Clipping,
        advice: `${track.name} peaks at ${peak} dBFS, so it clips or is about to: turn its clip gain down by about ${(track.peak - targetPeak.high).toFixed(0)} dB so it peaks near ${targetPeak.high} dBFS.`,
      };
    }
    if (track.peak > headroomDbfs) {
      return {
        track: track.name,
        issue: LevelIssue.LittleHeadroom,
        advice: `${track.name} peaks at ${peak} dBFS, leaving little headroom for plug-ins and the Master: lower its clip gain by about ${(track.peak - targetPeak.high).toFixed(0)} dB.`,
      };
    }
    if (track.peak < quietDbfs) {
      return {
        track: track.name,
        issue: LevelIssue.TooQuiet,
        advice: `${track.name} peaks at only ${peak} dBFS: raise its clip gain by about ${(targetPeak.low - track.peak).toFixed(0)} dB so compressors and saturators see a healthy level (peaks between ${targetPeak.low} and ${targetPeak.high} dBFS).`,
      };
    }
    return null;
  }

  private balanceFindings(tracks: readonly TrackLevel[]): LevelFinding[] {
    if (tracks.length < 3) return [];
    const reference = median(tracks.map((track) => track.loudness));
    const findings: LevelFinding[] = [];
    for (const track of tracks) {
      const difference = track.loudness - reference;
      if (difference > this.options.louderLu) {
        findings.push({
          track: track.name,
          issue: LevelIssue.MuchLouder,
          advice: `${track.name} is ${difference.toFixed(0)} LU louder than the middle of the other tracks before its fader: check it isn't swamping the mix, and trim its gain rather than pulling every other fader up.`,
        });
      } else if (-difference > this.options.quieterLu) {
        findings.push({
          track: track.name,
          issue: LevelIssue.MuchQuieter,
          advice: `${track.name} is ${(-difference).toFixed(0)} LU quieter than the middle of the other tracks before its fader: it may get lost unless it is meant to sit far back; raise its clip gain if you find the fader pushed high.`,
        });
      }
    }
    return findings;
  }

  private hotMixFinding(tracks: readonly TrackLevel[]): LevelFinding | null {
    if (tracks.length < 2) return null;
    const sum = sumDb(tracks.map((track) => track.loudness));
    if (sum <= this.options.hotMixLufs) return null;
    return {
      track: null,
      issue: LevelIssue.HotMix,
      advice: `Together these tracks add up to roughly ${sum.toFixed(0)} LUFS before faders, which leaves the Master little headroom: bring clip gains or faders down so the mix peaks around ${this.options.targetPeak.high} dBFS before mastering.`,
    };
  }
}

/** Gain-staging advice for a set of tracks (headroom, clipping risk, very low levels, balance). */
export function levelCheck(tracks: readonly TrackLevel[]): LevelFinding[] {
  return new LevelChecker().check(tracks);
}
