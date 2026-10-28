import { noteName } from "../../shared/notes";
import { PersonalisationSchema, type LoudnessTarget, type Personalisation, type VocalRange } from "../../shared/personalisation";

export const SETTING_FIELDS = ["genre", "spelling", "pronunciation", "vocalRange", "loudnessTarget"] as const satisfies readonly (keyof Personalisation)[];
export type SettingField = (typeof SETTING_FIELDS)[number];

/** Digital full scale: a loudness target sits below it, a true-peak ceiling at or below it. */
const FULL_SCALE = 0;

const FIELD_WORDS: Readonly<Record<SettingField, string>> = {
  genre: "genre",
  spelling: "spelling",
  pronunciation: "pronunciation",
  vocalRange: "vocal range",
  loudnessTarget: "loudness target",
};

const FIELD_SHAPES: Readonly<Record<SettingField, string>> = {
  genre: "a genre name",
  spelling: '"uk" or "us"',
  pronunciation: '"uk" or "us"',
  vocalRange: "{ low, high } as MIDI notes, low not above high",
  loudnessTarget: "{ lufs, truePeak } in LUFS and dBTP, the loudness below 0 and the ceiling at or below 0",
};

/** One of the musician's settings as Ode gives it: checked against what the setting holds, and put in plain words. */
export class SettingValue {
  /** The value as the setting holds it; an error saying what the setting takes when it doesn't fit. */
  static check(field: SettingField, value: unknown): unknown {
    const parsed = PersonalisationSchema.shape[field].safeParse({ mode: "set", value });
    const checked: unknown = parsed.success && parsed.data.mode === "set" ? parsed.data.value : undefined;
    if (checked === undefined || !SettingValue.sensible(field, checked)) throw new Error(`${FIELD_WORDS[field]} takes ${FIELD_SHAPES[field]}.`);
    return checked;
  }

  /** "vocal range: A2–E4", "pronunciation: UK English", "loudness target: -14 LUFS, -1 dBTP". */
  static words(field: SettingField, value: unknown): string {
    let checked: unknown;
    try {
      checked = SettingValue.check(field, value);
    } catch {
      return `${FIELD_WORDS[field]}: ${JSON.stringify(value)}`;
    }
    return `${FIELD_WORDS[field]}: ${SettingValue.valueWords(field, checked)}`;
  }

  /** What the shape alone allows but no setting holds: a range upside down, a target at or above full scale. */
  private static sensible(field: SettingField, value: unknown): boolean {
    if (field === "vocalRange") {
      const range = value as VocalRange;
      return range.low <= range.high;
    }
    if (field === "loudnessTarget") {
      const target = value as LoudnessTarget;
      return target.lufs < FULL_SCALE && target.truePeak <= FULL_SCALE;
    }
    return true;
  }

  /** A checked value in words. */
  private static valueWords(field: SettingField, value: unknown): string {
    if (field === "vocalRange") {
      const range = value as VocalRange;
      return `${noteName(range.low)}–${noteName(range.high)}`;
    }
    if (field === "loudnessTarget") {
      const target = value as LoudnessTarget;
      return `${target.lufs} LUFS, ${target.truePeak} dBTP`;
    }
    if (field === "spelling" || field === "pronunciation") return `${String(value).toUpperCase()} English`;
    return String(value);
  }
}
