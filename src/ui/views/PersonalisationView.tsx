import { useCallback, useState } from "react";
import type { Mode, Personalisation } from "../../shared/personalisation";
import { Notice, Panel, Select, Tone } from "../../ui-kit";
import type { SelectOption } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { useAppState, useClient, useReloadOnChange, useRequest } from "../app/hooks";
import { MODE_DESCRIPTIONS, MODE_LABELS, MODE_ORDER } from "../app/modes";
import { AccentSetting } from "./AccentSetting";
import { GenreSetting } from "./GenreSetting";
import { LoudnessSetting } from "./LoudnessSetting";
import { VocalRangeSetting } from "./VocalRangeSetting";
import "./views.css";

const MODE_OPTIONS: readonly SelectOption<Mode>[] = MODE_ORDER.map((mode) => ({ value: mode, label: MODE_LABELS[mode] }));

export function PersonalisationView() {
  const client = useClient();
  const currentMode = useAppState((state) => state.mode);
  const loadPreferences = useCallback(() => client.api.getPreferences(), [client]);
  const preferences = useRequest(loadPreferences);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { setData, reload } = preferences;
  useReloadOnChange(currentMode, reload);

  const save = useCallback(
    async (change: Partial<Personalisation>) => {
      setData((current) => current && { ...current, personalisation: { ...current.personalisation, ...change } });
      try {
        setData(await client.api.savePreferences({ personalisation: change }));
        setSaveError(null);
      } catch (error) {
        setSaveError(errorMessage(error));
        reload();
      }
    },
    [client, setData, reload],
  );

  /** The mode is remembered in Preferences; the header shows the mode the server is in, so it is read again. */
  const saveMode = useCallback(
    async (mode: Mode) => {
      setData((current) => current && { ...current, mode });
      try {
        setData(await client.api.savePreferences({ mode }));
        setSaveError(null);
        await client.refreshStatus().catch(() => undefined);
      } catch (error) {
        setSaveError(errorMessage(error));
        reload();
      }
    },
    [client, setData, reload],
  );

  const data = preferences.data;

  return (
    <div className="view">
      <p className="muted">
        Most settings start on Detect: Ode works them out from your songs and shows what it found. What you choose here always
        wins.
      </p>
      {preferences.error && <Notice tone={Tone.Danger}>Your settings couldn't be read: {preferences.error}</Notice>}
      {saveError && <Notice tone={Tone.Danger}>Your change wasn't saved: {saveError}</Notice>}
      {!data && !preferences.error && <p className="muted">Reading your settings…</p>}
      {data && (
        <>
          <Panel title="Mode">
            <Select
              label="Default mode"
              value={data.mode}
              options={MODE_OPTIONS}
              onChange={(mode) => void saveMode(mode)}
              hint={`${MODE_DESCRIPTIONS[data.mode]}. Picking a mode at the top of the window changes it too.`}
            />
          </Panel>
          <Panel title="Style">
            <GenreSetting value={data.personalisation.genre} resolved={data.resolved.genre} onChange={(genre) => void save({ genre })} />
          </Panel>
          <Panel title="Language">
            <AccentSetting
              label="Spelling"
              value={data.personalisation.spelling}
              resolved={data.resolved.spelling}
              onChange={(spelling) => void save({ spelling })}
            />
            <AccentSetting
              label="Pronunciation"
              value={data.personalisation.pronunciation}
              resolved={data.resolved.pronunciation}
              onChange={(pronunciation) => void save({ pronunciation })}
            />
          </Panel>
          <Panel title="Voice">
            <VocalRangeSetting
              value={data.personalisation.vocalRange}
              resolved={data.resolved.vocalRange}
              onChange={(vocalRange) => void save({ vocalRange })}
            />
          </Panel>
          <Panel title="Mastering">
            <LoudnessSetting
              value={data.personalisation.loudnessTarget}
              resolved={data.resolved.loudnessTarget}
              onChange={(loudnessTarget) => void save({ loudnessTarget })}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
