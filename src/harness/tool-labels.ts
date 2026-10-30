import { t } from "../shared/i18n";
import type { ToolRegistry } from "../tools";

/** Verbs for the last word of a tool's name, for a plain progress line for a tool without a description of its own. */
const PROGRESS_VERBS: ReadonlyMap<string, string> = new Map([
  ["get", t("runtime.verbs.get")],
  ["read", t("runtime.verbs.read")],
  ["list", t("runtime.verbs.list")],
  ["recall", t("runtime.verbs.recall")],
  ["check", t("runtime.verbs.check")],
  ["find", t("runtime.verbs.find")],
  ["write", t("runtime.verbs.write")],
  ["plan", t("runtime.verbs.plan")],
  ["analyze", t("runtime.verbs.analyze")],
  ["describe", t("runtime.verbs.describe")],
  ["transcribe", t("runtime.verbs.transcribe")],
  ["measure", t("runtime.verbs.measure")],
  ["vary", t("runtime.verbs.vary")],
  ["search", t("runtime.verbs.search")],
]);

/** Words written as musicians write them in a progress line. */
const PROGRESS_WORDS: ReadonlyMap<string, string> = new Map([["midi", "MIDI"]]);

/** One line in the musician's words for each tool Ode runs, shown while Ode works and when it asks to apply a change. */
export class ToolLabels {
  constructor(private readonly registry: ToolRegistry) {}

  /** The tool's own description of the call ("Bass · EQ Eight · 1 Frequency A to 200"), or a plain label. */
  for(name: string, input: unknown): string {
    const described = this.registry.describe(name, input);
    if (described) return described.replace(/\.$/, "");
    const target = this.registry.target?.(name, input);
    return `${target ? `${target} · ` : ""}${ToolLabels.plain(name)}`;
  }

  /** "midi_clip_get_notes" → "Reading MIDI clip notes"; "prosody_check" → "Checking prosody". */
  static plain(name: string): string {
    const words = name.split("_").map((word) => PROGRESS_WORDS.get(word) ?? word);
    const verbAt = words.findIndex((word) => PROGRESS_VERBS.has(word));
    if (verbAt > 0) {
      const rest = words.filter((_, index) => index !== verbAt);
      return t("runtime.toolAction", { verb: PROGRESS_VERBS.get(words[verbAt]!), target: rest.join(" ") });
    }
    const sentence = words.join(" ");
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  }
}
