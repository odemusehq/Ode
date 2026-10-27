// Types for the hyphen package's language entry points, which ship without them.

interface HyphenationPatterns {
  hyphenateSync(text: string, options?: { hyphenChar?: string; minWordLength?: number }): string;
}

declare module "hyphen/en-gb/index.js" {
  const patterns: HyphenationPatterns;
  export default patterns;
}

declare module "hyphen/en-us/index.js" {
  const patterns: HyphenationPatterns;
  export default patterns;
}
