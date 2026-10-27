import { SPECTRUM_FLOOR_DB } from "./spectrum";
import { REGIONS, REGION_RANGES, regionRangeLabel } from "./regions";
import { meanDb } from "./units";
import type { FrequencyBand, FrequencyBands } from "./bands";
import type { FrequencyRegion } from "./regions";

/** The tilt is fitted to bands from 100 Hz to 10 kHz: the range that shows tonal balance, clear of sub-bass and the top octave. */
const TILT_RANGE = { low: 100, high: 10000 };

export interface RegionLevel {
  region: FrequencyRegion;
  range: string;
  /** Average band level in the region, dB. */
  level: number;
}

export interface SpectrumSummary {
  /** Slope of a straight line fitted to the band levels from 100 Hz to 10 kHz, dB per octave. */
  tilt: number;
  regions: RegionLevel[];
  /** Name of the loudest band. */
  strongestBand: string;
}

/** Tonal balance of a set of band levels: average level per region, overall tilt and where regions stand out from it. */
export class ToneProfile {
  private readonly slope: number;
  private readonly intercept: number;

  constructor(
    readonly levels: readonly number[],
    readonly bands: FrequencyBands,
  ) {
    const points: { x: number; y: number }[] = [];
    bands.bands.forEach((band, index) => {
      if (band.nominal >= TILT_RANGE.low && band.nominal <= TILT_RANGE.high) {
        points.push({ x: Math.log2(band.centre), y: levels[index] ?? SPECTRUM_FLOOR_DB });
      }
    });
    const meanX = points.reduce((sum, point) => sum + point.x, 0) / Math.max(1, points.length);
    const meanY = points.reduce((sum, point) => sum + point.y, 0) / Math.max(1, points.length);
    let covariance = 0;
    let variance = 0;
    for (const { x, y } of points) {
      covariance += (x - meanX) * (y - meanY);
      variance += (x - meanX) * (x - meanX);
    }
    this.slope = variance > 0 ? covariance / variance : 0;
    this.intercept = meanY - this.slope * meanX;
  }

  /** dB per octave; negative when the level falls towards the highs. */
  get tilt(): number {
    return this.slope;
  }

  /** True when no band holds any signal. */
  get silent(): boolean {
    return this.levels.every((level) => level <= SPECTRUM_FLOOR_DB);
  }

  /** Average band level within a region, dB (averaged as power). */
  regionLevel(region: FrequencyRegion): number {
    const { low, high } = REGION_RANGES[region];
    const levels = this.bandIndexes(low, high).map((index) => this.levels[index] ?? SPECTRUM_FLOOR_DB);
    return levels.length === 0 ? SPECTRUM_FLOOR_DB : Math.max(SPECTRUM_FLOOR_DB, meanDb(levels));
  }

  /** How far a region's bands sit above (+) or below (−) the fitted tilt line on average, dB. */
  deviation(region: FrequencyRegion): number {
    const { low, high } = REGION_RANGES[region];
    const indexes = this.bandIndexes(low, high);
    if (indexes.length === 0) return 0;
    let sum = 0;
    for (const index of indexes) {
      const expected = this.intercept + this.slope * Math.log2(this.bands.band(index).centre);
      sum += (this.levels[index] ?? SPECTRUM_FLOOR_DB) - expected;
    }
    return sum / indexes.length;
  }

  strongestBand(): FrequencyBand {
    let strongest = 0;
    this.levels.forEach((level, index) => {
      if (level > (this.levels[strongest] ?? -Infinity)) strongest = index;
    });
    return this.bands.band(strongest);
  }

  summary(): SpectrumSummary {
    return {
      tilt: this.tilt,
      regions: REGIONS.map((region) => ({ region, range: regionRangeLabel(region), level: this.regionLevel(region) })),
      strongestBand: this.strongestBand().label,
    };
  }

  /** Indexes of the bands whose nominal centres lie in [low, high) Hz. */
  private bandIndexes(low: number, high: number): number[] {
    const indexes: number[] = [];
    this.bands.bands.forEach((band, index) => {
      if (band.nominal >= low && band.nominal < high) indexes.push(index);
    });
    return indexes;
  }
}
