import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { Field, Select, TextInput } from "../../ui-kit";
import type { SelectOption } from "../../ui-kit";
import { GENRES } from "../app/config";
import { SettingChoice, detectionHint } from "./settings";
import type { SettingProps } from "./settings";

const OPTIONS: SelectOption<string>[] = [
  { value: SettingChoice.Detect, label: "Detect" },
  ...GENRES.map((genre) => ({ value: genre, label: genre })),
  { value: SettingChoice.Custom, label: "Other" },
];

export function GenreSetting({ value, onChange }: SettingProps<string, string | null>) {
  const customValue = value.mode === "set" && !GENRES.includes(value.value) ? value.value : null;
  const [otherPicked, setOtherPicked] = useState(false);
  const [draft, setDraft] = useState(customValue ?? "");
  const otherId = useId();
  const choice = selectedChoice(value, otherPicked);

  useEffect(() => {
    if (customValue !== null) setDraft(customValue);
  }, [customValue]);

  const handleSelect = (next: string) => {
    setOtherPicked(next === SettingChoice.Custom);
    if (next === SettingChoice.Detect) onChange({ mode: "detect" });
    else if (next !== SettingChoice.Custom) onChange({ mode: "set", value: next });
  };

  const commit = () => {
    const genre = draft.trim();
    if (genre && genre !== customValue) onChange({ mode: "set", value: genre });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commit();
  };

  return (
    <div className="form-row">
      <Select label="Genre" value={choice} options={OPTIONS} onChange={handleSelect} hint={detectionHint(value, (genre) => genre)} />
      <Field id={otherId} label="Other genre">
        <TextInput
          id={otherId}
          value={draft}
          disabled={choice !== SettingChoice.Custom}
          placeholder="e.g. Shoegaze"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      </Field>
    </div>
  );
}

function selectedChoice(value: SettingProps<string, string | null>["value"], otherPicked: boolean): string {
  if (otherPicked) return SettingChoice.Custom;
  if (value.mode === "detect") return SettingChoice.Detect;
  return GENRES.includes(value.value) ? value.value : SettingChoice.Custom;
}
