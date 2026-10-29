/** EBU Tech 3342: short-term values below this absolute gate are left out, LUFS. */
const ABSOLUTE_GATE_LUFS = -70;
/** EBU Tech 3342: relative gate, LU below the power mean of the absolute-gated values. */
const RELATIVE_GATE_LU = -20;
/** EBU Tech 3342: loudness range spans these percentiles of the gated short-term distribution. */
const LOW_PERCENTILE = 0.1;
const HIGH_PERCENTILE = 0.95;

/**
 * Loudness range (LRA) in LU from short-term loudness values (3 s windows) per EBU Tech 3342:
 * absolute gate, relative gate, then the spread between the 10th and 95th percentiles.
 * Returns 0 for an empty list of values.
 */
export function loudnessRange(shortTerm: readonly number[]): number {
  const loudEnough = shortTerm.filter((value) => value >= ABSOLUTE_GATE_LUFS);
  if (loudEnough.length === 0) return 0;

  let power = 0;
  for (const value of loudEnough) power += 10 ** (value / 10);
  const relativeGate = 10 * Math.log10(power / loudEnough.length) + RELATIVE_GATE_LU;

  const gated = loudEnough.filter((value) => value >= relativeGate).sort((a, b) => a - b);
  const last = gated.length - 1;
  const low = gated[Math.round(last * LOW_PERCENTILE)];
  const high = gated[Math.round(last * HIGH_PERCENTILE)];
  return low === undefined || high === undefined ? 0 : high - low;
}
