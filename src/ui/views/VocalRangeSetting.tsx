import type { VocalRange } from "../../shared/personalisation";
import { Select, noteName } from "../../ui-kit";
import type { SelectOption } from "../../ui-kit";
import { DEFAULT_CUSTOM_VOCAL_RANGE, VOCAL_RANGE_LIMITS } from "../app/config";
import { SettingChoice, detectionHint } from "./settings";
import type { SettingProps } from "./settings";

const MIDDLE_C = 60;

const MODE_OPTIONS: SelectOption<SettingChoice>[] = [
  { value: SettingChoice.Detect, label: "Detect" },
  { value: SettingChoice.Custom, label: "Your range" },
];

const NOTES = Array.from({ length: VOCAL_RANGE_LIMITS.high - VOCAL_RANGE_LIMITS.low + 1 }, (_, index) => VOCAL_RANGE_LIMITS.low + index);

export function VocalRangeSetting({ value, resolved, onChange }: SettingProps<VocalRange, VocalRange | null>) {
  const custom = value.mode === "set";
  const range = value.mode === "set" ? value.value : (value.detected?.value ?? resolved ?? DEFAULT_CUSTOM_VOCAL_RANGE);

  const handleMode = (mode: SettingChoice) => {
    onChange(mode === SettingChoice.Detect ? { mode: "detect" } : { mode: "set", value: range });
  };

  const handleLow = (note: string) => {
    const low = Number(note);
    onChange({ mode: "set", value: { low, high: Math.max(range.high, low + 1) } });
  };

  const handleHigh = (note: string) => {
    const high = Number(note);
    onChange({ mode: "set", value: { low: Math.min(range.low, high - 1), high } });
  };

  return (
    <div className="form-row">
      <Select
        label="Vocal range"
        value={custom ? SettingChoice.Custom : SettingChoice.Detect}
        options={MODE_OPTIONS}
        onChange={handleMode}
        hint={detectionHint(value, formatRange)}
      />
      <Select
        label="Lowest note"
        value={String(range.low)}
        options={noteOptions((note) => note >= range.high)}
        onChange={handleLow}
        disabled={!custom}
      />
      <Select
        label="Highest note"
        value={String(range.high)}
        options={noteOptions((note) => note <= range.low)}
        onChange={handleHigh}
        disabled={!custom}
      />
    </div>
  );
}

function noteOptions(isDisabled: (note: number) => boolean): SelectOption<string>[] {
  return NOTES.map((note) => ({
    value: String(note),
    label: note === MIDDLE_C ? `${noteName(note)} (middle C)` : noteName(note),
    disabled: isDisabled(note),
  }));
}

function formatRange(range: VocalRange): string {
  return `${noteName(range.low)} to ${noteName(range.high)}`;
}
