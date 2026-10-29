import { FrequencyBands, formatFrequency, nominalFrequency } from "./bands";
import { TrackRole, roleFromName } from "./track-role";

export interface TrackSpectrum {
  name: string;
  /** Band levels in dB, as SpectrumAnalyzer gives them. */
  spectrum: number[];
}

export interface MaskingPair {
  tracks: [string, string];
  /** The shared band, e.g. "63–80 Hz". */
  band: string;
  advice: string;
}

export interface MaskingOptions {
  /** A band is strong for a track when it is within this many dB of the track's loudest band. */
  strongWithinDb: number;
  /** Two tracks compete in a band when their levels there are within this many dB of each other. */
  levelMatchDb: number;
  /** Bands quieter than this never count, dB. */
  floorDb: number;
  /** Most pairs reported, worst first. */
  maxPairs: number;
}

export const DEFAULT_MASKING_OPTIONS: Readonly<MaskingOptions> = {
  strongWithinDb: 10,
  levelMatchDb: 12,
  floorDb: -80,
  maxPairs: 8,
};

/** Below this the low end is shared by sidechaining or EQ, never by panning, Hz. */
const LOW_END_LIMIT_HZ = 120;
/** Where a vocal's body and intelligibility sit; other tracks make room for it here, Hz. */
const VOCAL_RANGE = { low: 200, high: 5000 };
/** A gentle corrective cut, dB. */
const SUGGESTED_CUT_DB = { min: 2, max: 3 };

interface TrackProfile {
  name: string;
  role: TrackRole;
  levels: readonly number[];
  peak: number;
}

interface SharedRun {
  first: number;
  last: number;
  /** Larger when both tracks sit near their loudest level across more bands. */
  severity: number;
  /** Total distance below each track's loudest band over the run, dB. */
  gapA: number;
  gapB: number;
}

/** Finds pairs of tracks that are strong in the same frequency bands and says how to separate them. */
export class MaskingDetector {
  private readonly options: MaskingOptions;

  constructor(
    private readonly bands: FrequencyBands,
    options: Partial<MaskingOptions> = {},
  ) {
    this.options = { ...DEFAULT_MASKING_OPTIONS, ...options };
  }

  detect(tracks: readonly TrackSpectrum[]): MaskingPair[] {
    const profiles: TrackProfile[] = tracks.map((track) => ({
      name: track.name,
      role: roleFromName(track.name),
      levels: track.spectrum,
      peak: track.spectrum.reduce((peak, level) => Math.max(peak, level), -Infinity),
    }));
    const found: { pair: MaskingPair; severity: number }[] = [];
    profiles.forEach((a, i) => {
      for (const b of profiles.slice(i + 1)) {
        const run = this.worstSharedRun(a, b);
        if (run) found.push({ pair: this.describe(a, b, run), severity: run.severity });
      }
    });
    return found
      .sort((x, y) => y.severity - x.severity)
      .slice(0, this.options.maxPairs)
      .map((entry) => entry.pair);
  }

  /** How far a band sits below the track's loudest band, or null when the band is not strong for it. */
  private gap(profile: TrackProfile, band: number): number | null {
    const level = profile.levels[band];
    if (level === undefined || level < this.options.floorDb) return null;
    const gap = profile.peak - level;
    return gap <= this.options.strongWithinDb ? gap : null;
  }

  private worstSharedRun(a: TrackProfile, b: TrackProfile): SharedRun | null {
    let worst: SharedRun | null = null;
    let current: SharedRun | null = null;
    for (let band = 0; band <= this.bands.count; band++) {
      const gapA = band < this.bands.count ? this.gap(a, band) : null;
      const gapB = band < this.bands.count ? this.gap(b, band) : null;
      const levelA = a.levels[band] ?? -Infinity;
      const levelB = b.levels[band] ?? -Infinity;
      const shared = gapA !== null && gapB !== null && Math.abs(levelA - levelB) <= this.options.levelMatchDb;
      if (shared) {
        current ??= { first: band, last: band, severity: 0, gapA: 0, gapB: 0 };
        current.last = band;
        current.severity += 2 * this.options.strongWithinDb - gapA - gapB;
        current.gapA += gapA;
        current.gapB += gapB;
        continue;
      }
      if (current && (!worst || current.severity > worst.severity)) worst = current;
      current = null;
    }
    return worst;
  }

  private describe(a: TrackProfile, b: TrackProfile, run: SharedRun): MaskingPair {
    const centre = Math.sqrt(this.bands.band(run.first).centre * this.bands.band(run.last).centre);
    const range = this.bands.rangeLabel(run.first, run.last);
    const [keep, cut] = this.whoKeepsTheBand(a, b, run, centre);
    const at = formatFrequency(nominalFrequency(centre));
    const cutText = `${SUGGESTED_CUT_DB.min}–${SUGGESTED_CUT_DB.max} dB`;
    const alternative =
      centre < LOW_END_LIMIT_HZ
        ? `or sidechain ${cut.name} to ${keep.name} so it ducks when ${keep.name} plays`
        : `or pan them apart if both need to stay full`;
    return {
      tracks: [a.name, b.name],
      band: range,
      advice: `${a.name} and ${b.name} are both strong at ${range}: cut ${cutText} from ${cut.name} around ${at} with a bell EQ, ${alternative}.`,
    };
  }

  /** [track that keeps the band, track that gives way]. */
  private whoKeepsTheBand(a: TrackProfile, b: TrackProfile, run: SharedRun, centre: number): [TrackProfile, TrackProfile] {
    const roles = new Set([a.role, b.role]);
    if (centre < LOW_END_LIMIT_HZ && roles.has(TrackRole.Kick) && roles.has(TrackRole.Bass)) {
      return a.role === TrackRole.Kick ? [a, b] : [b, a];
    }
    const inVocalRange = centre >= VOCAL_RANGE.low && centre <= VOCAL_RANGE.high;
    if (inVocalRange && a.role !== b.role && roles.has(TrackRole.Vocal)) {
      return a.role === TrackRole.Vocal ? [a, b] : [b, a];
    }
    return run.gapA <= run.gapB ? [a, b] : [b, a];
  }
}

/** Pairs of tracks competing in the same band, worst first, with plain advice for each. */
export function maskingCheck(tracks: readonly TrackSpectrum[]): MaskingPair[] {
  const bandCount = tracks[0]?.spectrum.length ?? 0;
  if (bandCount === 0 || tracks.length < 2) return [];
  return new MaskingDetector(new FrequencyBands(bandCount)).detect(tracks);
}
