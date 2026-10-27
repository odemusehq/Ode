import { formatFrequencyRange } from "./bands";

/** The frequency regions mixing and mastering engineers use to talk about tone. */
export enum FrequencyRegion {
  SubBass = "sub-bass",
  Bass = "bass",
  LowMids = "low mids",
  Mids = "mids",
  HighMids = "high mids",
  Presence = "presence",
  Brilliance = "brilliance",
}

export interface FrequencyRange {
  /** Hz, inclusive. */
  low: number;
  /** Hz, exclusive. */
  high: number;
}

/** The conventional boundaries of each region. */
export const REGION_RANGES: Readonly<Record<FrequencyRegion, FrequencyRange>> = {
  [FrequencyRegion.SubBass]: { low: 20, high: 60 },
  [FrequencyRegion.Bass]: { low: 60, high: 250 },
  [FrequencyRegion.LowMids]: { low: 250, high: 500 },
  [FrequencyRegion.Mids]: { low: 500, high: 2000 },
  [FrequencyRegion.HighMids]: { low: 2000, high: 4000 },
  [FrequencyRegion.Presence]: { low: 4000, high: 6000 },
  [FrequencyRegion.Brilliance]: { low: 6000, high: 20000 },
};

export const REGIONS: readonly FrequencyRegion[] = Object.values(FrequencyRegion);

/** A region's range, e.g. "60–250 Hz". */
export function regionRangeLabel(region: FrequencyRegion): string {
  const { low, high } = REGION_RANGES[region];
  return formatFrequencyRange(low, high);
}
