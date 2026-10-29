import { FrequencyBands } from "./bands";

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
  /** Only bands at or above this count, dB. */
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

interface TrackProfile {
  name: string;
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

/** Finds candidate overlap in average source spectra; it cannot diagnose temporal masking. */
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

  /** How far a band sits below the track's loudest band, or null when the band is weak for it. */
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
    const range = this.bands.rangeLabel(run.first, run.last);
    return {
      tracks: [a.name, b.name],
      band: range,
      advice: `${a.name} and ${b.name} share strong average source energy at ${range}. This is candidate spectral overlap, not diagnosed masking: simultaneous activity, faders, pan, routing and effects are unmeasured. Listen to their processed overlap before deciding whether any change is needed.`,
    };
  }

}

/** Pairs of tracks competing in the same band, worst first, with plain advice for each. */
export function maskingCheck(tracks: readonly TrackSpectrum[]): MaskingPair[] {
  const bandCount = tracks[0]?.spectrum.length ?? 0;
  if (bandCount === 0 || tracks.length < 2) return [];
  return new MaskingDetector(new FrequencyBands(bandCount)).detect(tracks);
}
