import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import type { LoudnessTarget } from "../../shared/personalisation";
import { Field, Select, TextInput } from "../../ui-kit";
import type { SelectOption } from "../../ui-kit";
import { DEFAULT_CUSTOM_LOUDNESS, LOUDNESS_PRESETS } from "../app/config";
import { formatLufs, formatTruePeak } from "../app/format";
import { SettingChoice, detectionHint } from "./settings";
import type { SettingProps } from "./settings";

const OPTIONS: SelectOption<string>[] = [
  { value: SettingChoice.Detect, label: "Detect" },
  ...LOUDNESS_PRESETS.map((preset) => ({ value: preset.id, label: `${preset.label}: ${formatTarget(preset)}` })),
  { value: SettingChoice.Custom, label: "Custom" },
];

export function LoudnessSetting({ value, resolved, onChange }: SettingProps<LoudnessTarget, LoudnessTarget>) {
  const [customPicked, setCustomPicked] = useState(false);
  const target = value.mode === "set" ? value.value : resolved;
  const choice = selectedChoice(value, customPicked);
  const custom = choice === SettingChoice.Custom;
  const [lufs, setLufs] = useState(String(target.lufs));
  const [truePeak, setTruePeak] = useState(String(target.truePeak));
  const lufsId = useId();
  const truePeakId = useId();

  useEffect(() => {
    setLufs(String(target.lufs));
    setTruePeak(String(target.truePeak));
  }, [target.lufs, target.truePeak]);

  const handleSelect = (next: string) => {
    setCustomPicked(next === SettingChoice.Custom);
    const preset = LOUDNESS_PRESETS.find((candidate) => candidate.id === next);
    if (next === SettingChoice.Detect) onChange({ mode: "detect" });
    else if (preset) onChange({ mode: "set", value: { lufs: preset.lufs, truePeak: preset.truePeak } });
    else if (value.mode === "detect") onChange({ mode: "set", value: value.detected?.value ?? DEFAULT_CUSTOM_LOUDNESS });
  };

  const commit = () => {
    const next = { lufs: Number(lufs), truePeak: Number(truePeak) };
    if (!Number.isFinite(next.lufs) || !Number.isFinite(next.truePeak)) return;
    if (next.lufs !== target.lufs || next.truePeak !== target.truePeak) onChange({ mode: "set", value: next });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commit();
  };

  return (
    <div className="form-row">
      <Select
        label="Loudness target"
        value={choice}
        options={OPTIONS}
        onChange={handleSelect}
        hint={detectionHint(value, formatTarget, formatTarget(resolved))}
      />
      <Field id={lufsId} label="Integrated (LUFS)">
        <TextInput
          id={lufsId}
          type="number"
          step="0.5"
          inputMode="decimal"
          value={lufs}
          disabled={!custom}
          onChange={(event) => setLufs(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      </Field>
      <Field id={truePeakId} label="True peak (dBTP)">
        <TextInput
          id={truePeakId}
          type="number"
          step="0.1"
          inputMode="decimal"
          value={truePeak}
          disabled={!custom}
          onChange={(event) => setTruePeak(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      </Field>
    </div>
  );
}

function selectedChoice(value: SettingProps<LoudnessTarget, LoudnessTarget>["value"], customPicked: boolean): string {
  if (customPicked) return SettingChoice.Custom;
  if (value.mode === "detect") return SettingChoice.Detect;
  const { lufs, truePeak } = value.value;
  const preset = LOUDNESS_PRESETS.find((candidate) => candidate.lufs === lufs && candidate.truePeak === truePeak);
  return preset ? preset.id : SettingChoice.Custom;
}

function formatTarget(target: LoudnessTarget): string {
  return `${formatLufs(target.lufs)}, ${formatTruePeak(target.truePeak)}`;
}
