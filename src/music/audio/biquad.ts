/** Coefficients of a second-order filter section, normalised so that a0 = 1. */
export interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** A second-order IIR filter section (transposed direct form II, double precision) with its own state. */
export class Biquad {
  private readonly b0: number;
  private readonly b1: number;
  private readonly b2: number;
  private readonly a1: number;
  private readonly a2: number;
  private z1 = 0;
  private z2 = 0;

  constructor(coefficients: BiquadCoefficients) {
    this.b0 = coefficients.b0;
    this.b1 = coefficients.b1;
    this.b2 = coefficients.b2;
    this.a1 = coefficients.a1;
    this.a2 = coefficients.a2;
  }

  process(input: number): number {
    const output = this.b0 * input + this.z1;
    this.z1 = this.b1 * input - this.a1 * output + this.z2;
    this.z2 = this.b2 * input - this.a2 * output;
    return output;
  }

  reset(): void {
    this.z1 = 0;
    this.z2 = 0;
  }
}
