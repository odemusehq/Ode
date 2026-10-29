import { signed } from "./format";
import { median } from "./signal";

export interface TrackLevel {
  name: string;
  /** Peak level, dBFS (true peak when available). */
  peak: number;
  peakUnit?: "dBTP" | "dBFS";
  /** Integrated loudness, LUFS. */
  loudness: number;
}

/** The gain-staging problems levelCheck reports. */
export enum LevelIssue {
  Silent = "silent",
  /** The track sounds, and the stretch is too short or too quiet for a loudness reading. */
  Unmeasured = "loudness unmeasured",
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
    // Silence is a track without a peak; a track that sounds too briefly or too softly for a loudness reading keeps its peak checks.
    const sounding = tracks.filter((track) => Number.isFinite(track.peak));
    const measured = sounding.filter((track) => Number.isFinite(track.loudness));
    for (const track of tracks) {
      if (!sounding.includes(track)) {
        findings.push({ track: track.name, issue: LevelIssue.Silent, advice: `${track.name} is silent in this range.` });
        continue;
      }
      const finding = this.peakFinding(track);
      if (finding) findings.push(finding);
      if (!measured.includes(track)) {
        findings.push({
          track: track.name,
          issue: LevelIssue.Unmeasured,
          advice: `${track.name} peaks at ${signed(track.peak)} ${track.peakUnit ?? "dBFS"} here; integrated loudness is below the gates or the passage is too short. This is not silence.`,
        });
      }
    }
    findings.push(...this.balanceFindings(measured));
    return findings;
  }

  private peakFinding(track: TrackLevel): LevelFinding | null {
    const { clipDbfs, headroomDbfs, quietDbfs } = this.options;
    const peak = signed(track.peak);
    const unit = track.peakUnit ?? "dBFS";
    if (track.peak >= clipDbfs) {
      return {
        track: track.name,
        issue: LevelIssue.Clipping,
        advice: `${track.name} has a source peak of ${peak} ${unit}, near or above full scale. Inspect the exact signal and output format; this alone does not prove clipping in Live or at Main.`,
      };
    }
    if (track.peak > headroomDbfs) {
      return {
        track: track.name,
        issue: LevelIssue.LittleHeadroom,
        advice: `${track.name} has a source peak of ${peak} ${unit}. Check the actual processed output before deciding whether gain needs reducing; Main headroom is unmeasured.`,
      };
    }
    if (track.peak < quietDbfs) {
      return {
        track: track.name,
        issue: LevelIssue.TooQuiet,
        advice: `${track.name} has a low source peak of ${peak} ${unit}; that may be intentional. Judge its level in the processed mix before changing gain.`,
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
          advice: `${track.name} is ${difference.toFixed(0)} LU above the median independently measured source loudness. This does not establish mix balance: activity, faders, pan and processing differ.`,
        });
      } else if (-difference > this.options.quieterLu) {
        findings.push({
          track: track.name,
          issue: LevelIssue.MuchQuieter,
          advice: `${track.name} is ${(-difference).toFixed(0)} LU below the median independently measured source loudness. Audition its intended role before deciding whether anything is too quiet.`,
        });
      }
    }
    return findings;
  }

}

/** Gain-staging advice for a set of tracks (headroom, clipping risk, very low levels, balance). */
export function levelCheck(tracks: readonly TrackLevel[]): LevelFinding[] {
  return new LevelChecker().check(tracks);
}
