import type { Accent } from "../../shared/personalisation";
import { Select } from "../../ui-kit";
import type { SelectOption } from "../../ui-kit";
import { SettingChoice, detectionHint } from "./settings";
import type { SettingProps } from "./settings";

type AccentChoice = Accent | SettingChoice.Detect;

const ACCENT_LABELS: Record<Accent, string> = { uk: "UK English", us: "US English" };

const OPTIONS: SelectOption<AccentChoice>[] = [
  { value: SettingChoice.Detect, label: "Detect" },
  { value: "uk", label: ACCENT_LABELS.uk },
  { value: "us", label: ACCENT_LABELS.us },
];

export interface AccentSettingProps extends SettingProps<Accent, Accent> {
  label: string;
}

/** Spelling or pronunciation: UK or US English. */
export function AccentSetting({ label, value, resolved, onChange }: AccentSettingProps) {
  const choice: AccentChoice = value.mode === "set" ? value.value : SettingChoice.Detect;

  const handleSelect = (next: AccentChoice) => {
    if (next === SettingChoice.Detect) onChange({ mode: "detect" });
    else onChange({ mode: "set", value: next });
  };

  return (
    <Select
      label={label}
      value={choice}
      options={OPTIONS}
      onChange={handleSelect}
      hint={detectionHint(value, (accent) => ACCENT_LABELS[accent], ACCENT_LABELS[resolved])}
    />
  );
}
