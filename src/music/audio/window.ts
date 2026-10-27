/** Relative size of the last term at which the Bessel series stops. */
const SERIES_TOLERANCE = 1e-12;

/** Periodic Hann window, the usual choice for overlapped spectral analysis. */
export function hannWindow(length: number): Float64Array {
  const window = new Float64Array(length);
  for (let n = 0; n < length; n++) window[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / length);
  return window;
}

/** Zeroth-order modified Bessel function of the first kind, from its power series. */
export function besselI0(x: number): number {
  const quarterSquare = (x * x) / 4;
  let term = 1;
  let sum = 1;
  for (let k = 1; term > sum * SERIES_TOLERANCE; k++) {
    term *= quarterSquare / (k * k);
    sum += term;
  }
  return sum;
}

/** Kaiser window value at a given offset from the centre of a window spanning −halfLength…halfLength. */
export function kaiser(offset: number, halfLength: number, beta: number): number {
  const ratio = offset / halfLength;
  if (Math.abs(ratio) > 1) return 0;
  return besselI0(beta * Math.sqrt(1 - ratio * ratio)) / besselI0(beta);
}

/** Normalised sinc: sin(πx) / (πx). */
export function sinc(x: number): number {
  if (x === 0) return 1;
  const angle = Math.PI * x;
  return Math.sin(angle) / angle;
}
