/**
 * Exact centres of the base-10 third-octave series (IEC 61260-1: 1000 · 10^(k/10) Hz) at the ends
 * of the audible range: k = −17 (nominal 20 Hz) and k = 13 (nominal 20 kHz).
 */
const LOWEST_CENTRE_HZ = 1000 * 10 ** (-17 / 10);
const HIGHEST_CENTRE_HZ = 1000 * 10 ** (13 / 10);
/** 31 bands between those centres are the standard third-octave bands. */
export const THIRD_OCTAVE_BAND_COUNT = 31;
/** ISO 266 preferred numbers (R10 series) used to name band centres, with 10 closing the decade. */
const PREFERRED_NUMBERS = [1, 1.25, 1.6, 2, 2.5, 3.15, 4, 5, 6.3, 8, 10];
/** A centre within this ratio of a preferred number is named by it. */
const NOMINAL_TOLERANCE = 1.03;
const HZ_PER_KHZ = 1000;

export interface FrequencyBand {
  /** Centre frequency, Hz. */
  centre: number;
  /** Nominal centre frequency (ISO 266 preferred number), Hz. */
  nominal: number;
  /** Lower and upper edges, Hz. */
  low: number;
  high: number;
  /** Nominal name of the centre, e.g. "31.5 Hz" or "1.25 kHz". */
  label: string;
}

/**
 * Logarithmically spaced bands covering 20 Hz–20 kHz. With 31 bands these are exactly the
 * third-octave bands; other counts give coarser or finer fractional-octave bands over the same range.
 */
export class FrequencyBands {
  readonly bands: readonly FrequencyBand[];

  constructor(count: number = THIRD_OCTAVE_BAND_COUNT) {
    const bandCount = Math.max(1, Math.round(count));
    const span = HIGHEST_CENTRE_HZ / LOWEST_CENTRE_HZ;
    const ratio = bandCount > 1 ? span ** (1 / (bandCount - 1)) : span;
    const firstCentre = bandCount > 1 ? LOWEST_CENTRE_HZ : Math.sqrt(LOWEST_CENTRE_HZ * HIGHEST_CENTRE_HZ);
    const halfStep = Math.sqrt(ratio);
    this.bands = Array.from({ length: bandCount }, (_, index) => {
      const centre = firstCentre * ratio ** index;
      const nominal = nominalFrequency(centre);
      return { centre, nominal, low: centre / halfStep, high: centre * halfStep, label: formatFrequency(nominal) };
    });
  }

  get count(): number {
    return this.bands.length;
  }

  band(index: number): FrequencyBand {
    const band = this.bands[index];
    if (!band) throw new RangeError(`no frequency band ${index}`);
    return band;
  }

  /** Label for a run of bands, e.g. "63–80 Hz", or a single band's label. */
  rangeLabel(first: number, last: number): string {
    const low = this.band(first);
    return first === last ? low.label : formatFrequencyRange(low.nominal, this.band(last).nominal);
  }
}

/** The ISO 266 preferred frequency closest to a band centre, or the centre rounded to two significant figures. */
export function nominalFrequency(frequency: number): number {
  const decade = 10 ** Math.floor(Math.log10(frequency));
  const mantissa = frequency / decade;
  let best = mantissa;
  let bestRatio = Infinity;
  for (const preferred of PREFERRED_NUMBERS) {
    const ratio = Math.max(mantissa / preferred, preferred / mantissa);
    if (ratio < bestRatio) {
      bestRatio = ratio;
      best = preferred;
    }
  }
  return bestRatio <= NOMINAL_TOLERANCE ? best * decade : Number(frequency.toPrecision(2));
}

/** "70 Hz", "315 Hz", "2.5 kHz", "12.5 kHz". */
export function formatFrequency(frequency: number): string {
  if (frequency >= HZ_PER_KHZ) return `${Number((frequency / HZ_PER_KHZ).toPrecision(3))} kHz`;
  return `${Number(frequency.toPrecision(3))} Hz`;
}

/** "63–80 Hz", "800 Hz–1.25 kHz", "2–4 kHz". */
export function formatFrequencyRange(low: number, high: number): string {
  const lowText = formatFrequency(low);
  const sameUnit = (low >= HZ_PER_KHZ) === (high >= HZ_PER_KHZ);
  return `${sameUnit ? lowText.replace(/ k?Hz$/, "") : lowText}–${formatFrequency(high)}`;
}
