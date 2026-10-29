// Types for the parts of the hyphen package Ode uses, which ship without them.

/** Marks the places a word can break with the hyphen character. */
type Hyphenate = (text: string, options?: { hyphenChar?: string; minWordLength?: number }) => string;

declare module "hyphen/hyphen.js" {
  /** Builds a hyphenator for one language's TeX patterns; without the async option it answers straight away. */
  const createHyphenator: (patterns: unknown) => Hyphenate;
  export default createHyphenator;
}

declare module "hyphen/patterns/en-gb.js" {
  const patterns: unknown;
  export default patterns;
}

declare module "hyphen/patterns/en-us.js" {
  const patterns: unknown;
  export default patterns;
}
