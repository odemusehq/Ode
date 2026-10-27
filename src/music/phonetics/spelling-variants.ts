interface SpellingRule {
  pattern: RegExp;
  replacement: string;
}

/** Regular UK ↔ US spelling differences, tried when a word is missing from a dictionary. */
const RULES: readonly SpellingRule[] = [
  { pattern: /our(s|ed|ing|ite|ites|able|ful|less|er|ers)?$/, replacement: "or$1" },
  { pattern: /([^aeiou])or(s|ed|ing|ite|ites|able|ful|less)?$/, replacement: "$1our$2" },
  { pattern: /([^aeiou])re(s|d)?$/, replacement: "$1er$2" },
  { pattern: /([^aeiou])er(s|ed)?$/, replacement: "$1re$2" },
  { pattern: /is(e|es|ed|ing|ation|ations|er|ers)$/, replacement: "iz$1" },
  { pattern: /iz(e|es|ed|ing|ation|ations|er|ers)$/, replacement: "is$1" },
  { pattern: /ys(e|es|ed|ing)$/, replacement: "yz$1" },
  { pattern: /yz(e|es|ed|ing)$/, replacement: "ys$1" },
  { pattern: /ogue(s)?$/, replacement: "og$1" },
  { pattern: /og(s)?$/, replacement: "ogue$1" },
  { pattern: /([aeiou])ll(ed|ing|er|ers)$/, replacement: "$1l$2" },
  { pattern: /([aeiou])l(ed|ing|er|ers)$/, replacement: "$1ll$2" },
  { pattern: /ence$/, replacement: "ense" },
  { pattern: /ense$/, replacement: "ence" },
  { pattern: /ae/, replacement: "e" },
  { pattern: /oe/, replacement: "e" },
  { pattern: /grey/, replacement: "gray" },
  { pattern: /gray/, replacement: "grey" },
];

/** Other spellings of the same word: "colour" → "color", "realise" → "realize", "centre" → "center". */
export function spellingVariants(word: string): string[] {
  const variants = new Set<string>();
  for (const rule of RULES) {
    if (!rule.pattern.test(word)) continue;
    const variant = word.replace(rule.pattern, rule.replacement);
    if (variant !== word) variants.add(variant);
  }
  return [...variants];
}
