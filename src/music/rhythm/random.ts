/** Mulberry32 constants (a small, fast 32-bit generator). */
const INCREMENT = 0x6d2b79f5;
const TWO_TO_32 = 4294967296;

/** Seeded random numbers, so the same seed always writes the same part. */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = Math.floor(seed) >>> 0;
  }

  /** A number in [0, 1). */
  next(): number {
    this.state = (this.state + INCREMENT) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / TWO_TO_32;
  }

  /** A number in [low, high). */
  between(low: number, high: number): number {
    return low + (high - low) * this.next();
  }

  /** A whole number in [low, high]. */
  integer(low: number, high: number): number {
    return Math.floor(this.between(low, high + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** A small symmetric variation in [-amount, amount]. */
  jitter(amount: number): number {
    return this.between(-amount, amount);
  }

  pick<T>(items: readonly T[]): T | undefined {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Index chosen with probability proportional to its weight. */
  weightedIndex(weights: readonly number[]): number {
    const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
    if (total <= 0) return Math.floor(this.next() * weights.length);
    let target = this.next() * total;
    for (let index = 0; index < weights.length; index++) {
      target -= Math.max(0, weights[index] ?? 0);
      if (target < 0) return index;
    }
    return weights.length - 1;
  }
}
