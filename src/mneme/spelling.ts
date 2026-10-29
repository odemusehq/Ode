import { OdeConfig } from "../shared/config";
import type { Accent } from "../shared/personalisation";

export interface SpellingGuess {
  value: Accent;
  confidence: number;
}

/** Works out whether lyrics use UK or US spelling from words whose spelling differs. */
export class SpellingDetector {
  /** UK spelling → US spelling, only pairs that are unambiguous in lyrics. */
  private static readonly PAIRS: ReadonlyArray<readonly [string, string]> = [
    ["colour", "color"],
    ["favourite", "favorite"],
    ["honour", "honor"],
    ["neighbour", "neighbor"],
    ["flavour", "flavor"],
    ["behaviour", "behavior"],
    ["harbour", "harbor"],
    ["labour", "labor"],
    ["rumour", "rumor"],
    ["vapour", "vapor"],
    ["armour", "armor"],
    ["glamour", "glamor"],
    ["splendour", "splendor"],
    ["centre", "center"],
    ["theatre", "theater"],
    ["litre", "liter"],
    ["fibre", "fiber"],
    ["sombre", "somber"],
    ["travelled", "traveled"],
    ["travelling", "traveling"],
    ["traveller", "traveler"],
    ["cancelled", "canceled"],
    ["jewellery", "jewelry"],
    ["grey", "gray"],
    ["mum", "mom"],
    ["defence", "defense"],
    ["offence", "offense"],
    ["catalogue", "catalog"],
    ["dialogue", "dialog"],
    ["aeroplane", "airplane"],
    ["pyjamas", "pajamas"],
    ["maths", "math"],
    ["sceptical", "skeptical"],
    ["ageing", "aging"],
    ["aluminium", "aluminum"],
    ["moustache", "mustache"],
    ["plough", "plow"],
    ["sulphur", "sulfur"],
  ];

  /** Words used almost only in UK English. */
  private static readonly UK_ONLY: ReadonlySet<string> = new Set(["whilst", "amongst", "learnt", "dreamt", "spelt", "arse"]);

  /** Endings: "-ise" is a UK marker; "-ize" is also used in UK (Oxford) spelling, so it counts less. */
  private static readonly ISE = /\b\w{3,}(ise|ised|ises|ising|isation)\b/g;
  private static readonly IZE = /\b\w{3,}(ize|ized|izes|izing|ization)\b/g;
  private static readonly NOT_ISE_VERBS: ReadonlySet<string> = new Set([
    "rise",
    "arise",
    "wise",
    "otherwise",
    "promise",
    "surprise",
    "exercise",
    "advertise",
    "compromise",
    "disguise",
    "paradise",
    "precise",
    "concise",
    "expertise",
    "franchise",
    "merchandise",
    "televise",
    "supervise",
    "revise",
    "devise",
    "despise",
    "comprise",
    "improvise",
    "chastise",
    "enterprise",
    "noise",
    "poise",
    "praise",
    "raise",
    "cruise",
    "bruise",
  ]);

  detect(texts: readonly string[]): SpellingGuess | null {
    const words = texts.join(" ").toLowerCase().match(/[a-z']+/g) ?? [];
    const ukWords = new Set(SpellingDetector.PAIRS.map(([uk]) => uk));
    const usWords = new Set(SpellingDetector.PAIRS.map(([, us]) => us));
    let uk = 0;
    let us = 0;
    for (const word of words) {
      if (ukWords.has(word) || SpellingDetector.UK_ONLY.has(word)) uk += 1;
      if (usWords.has(word)) us += 1;
    }
    const { minConfidence, wordsForFullEvidence, izeWeight } = OdeConfig.spelling;
    const text = words.join(" ");
    for (const match of text.matchAll(SpellingDetector.ISE)) {
      // "promised" and "surprising" are forms of verbs spelled "-ise" everywhere, so the UK count stays as it is for them.
      const stem = match[0].slice(0, match[0].length - (match[1]?.length ?? 0));
      if (!SpellingDetector.NOT_ISE_VERBS.has(`${stem}ise`)) uk += 1;
    }
    for (const _match of text.matchAll(SpellingDetector.IZE)) us += izeWeight;
    const total = uk + us;
    if (total === 0 || uk === us) return null;
    const value: Accent = uk > us ? "uk" : "us";
    const margin = Math.abs(uk - us) / total;
    const evidence = Math.min(1, total / wordsForFullEvidence);
    const confidence = Number((margin * evidence).toFixed(2));
    return confidence >= minConfidence ? { value, confidence } : null;
  }

  /** The accent suggested by the computer's language setting, if it is an English locale. */
  fromLocale(locale: string = Intl.DateTimeFormat().resolvedOptions().locale): Accent | null {
    const lower = locale.toLowerCase();
    if (!lower.startsWith("en")) return null;
    return ["en-gb", "en-ie", "en-au", "en-nz", "en-za", "en-in"].some((prefix) => lower.startsWith(prefix)) ? "uk" : "us";
  }
}
