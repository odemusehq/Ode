/** Rhyme pairs listeners have heard so often that they can predict the second word. Labelled, never banned. */
const OVERUSED_RHYME_PAIRS: readonly [string, string][] = [
  ["fire", "desire"],
  ["heart", "apart"],
  ["heart", "start"],
  ["love", "above"],
  ["love", "of"],
  ["pain", "rain"],
  ["night", "light"],
  ["night", "tonight"],
  ["eyes", "skies"],
  ["eyes", "lies"],
  ["true", "you"],
  ["cry", "goodbye"],
  ["baby", "maybe"],
  ["girl", "world"],
  ["real", "feel"],
  ["soul", "control"],
  ["fly", "sky"],
  ["away", "stay"],
  ["forever", "together"],
  ["mind", "find"],
  ["me", "free"],
  ["door", "more"],
  ["day", "way"],
  ["kiss", "miss"],
  ["tears", "years"],
  ["feel", "heal"],
  ["burn", "learn"],
  ["fall", "all"],
  ["go", "know"],
  ["say", "away"],
  ["hand", "understand"],
  ["alone", "home"],
  ["dreams", "seems"],
  ["cold", "hold"],
  ["inside", "hide"],
  ["believe", "leave"],
  ["arms", "charms"],
  ["star", "are"],
];

const PAIR_KEYS: ReadonlySet<string> = new Set(OVERUSED_RHYME_PAIRS.map(([a, b]) => [a, b].sort().join("|")));

function normalize(word: string): string {
  return word.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z']/g, "");
}

/** Whether two words form one of the over-used rhyme pairs (in either order). */
export function isOverusedPair(first: string, second: string): boolean {
  return PAIR_KEYS.has([normalize(first), normalize(second)].sort().join("|"));
}
