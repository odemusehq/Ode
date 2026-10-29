import type { ToolRegistry } from "../tools";

/** Verbs for the last word of a tool's name, for a plain progress line when the tool has no description of its own. */
const PROGRESS_VERBS: ReadonlyMap<string, string> = new Map([
  ["get", "Reading"],
  ["read", "Reading"],
  ["list", "Reading"],
  ["recall", "Recalling"],
  ["check", "Checking"],
  ["find", "Finding"],
  ["write", "Writing"],
  ["plan", "Planning"],
  ["analyze", "Analysing"],
  ["describe", "Listening to"],
  ["transcribe", "Transcribing"],
  ["measure", "Measuring"],
  ["vary", "Varying"],
  ["search", "Searching"],
]);

/** Words written as musicians write them in a progress line. */
const PROGRESS_WORDS: ReadonlyMap<string, string> = new Map([["midi", "MIDI"]]);

/** One line in the musician's words for each tool Ode runs, shown while Ode works and when it asks to apply a change. */
export class ToolLabels {
  constructor(private readonly registry: ToolRegistry) {}

  /** The tool's own description of the call ("Bass · EQ Eight · 1 Frequency A to 200"), or a plain label. */
  for(name: string, input: unknown): string {
    const described = this.registry.describe(name, input);
    return described ? described.replace(/\.$/, "") : ToolLabels.plain(name);
  }

  /** "midi_clip_get_notes" → "Reading MIDI clip notes"; "prosody_check" → "Checking prosody". */
  static plain(name: string): string {
    const words = name.split("_").map((word) => PROGRESS_WORDS.get(word) ?? word);
    const verbAt = words.findIndex((word) => PROGRESS_VERBS.has(word));
    if (verbAt > 0) {
      const rest = words.filter((_, index) => index !== verbAt);
      return `${PROGRESS_VERBS.get(words[verbAt]!)} ${rest.join(" ")}`;
    }
    const sentence = words.join(" ");
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  }
}
