import { useCallback, useState } from "react";
import type { Personalisation } from "../../shared/personalisation";
import { Notice, Panel, Tone } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { useClient, useRequest } from "../app/hooks";
import { AccentSetting } from "./AccentSetting";
import { GenreSetting } from "./GenreSetting";
import { LoudnessSetting } from "./LoudnessSetting";
import { VocalRangeSetting } from "./VocalRangeSetting";
import "./views.css";

export function PersonalisationView() {
  const client = useClient();
  const loadPreferences = useCallback(() => client.api.getPreferences(), [client]);
  const preferences = useRequest(loadPreferences);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { setData, reload } = preferences;

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

  const data = preferences.data;

  return (
    <div className="view">
      <p className="muted">
        Each setting starts on Detect: Ode works it out from your songs and shows what it found. What you choose here always
        wins.
      </p>
      {preferences.error && <Notice tone={Tone.Danger}>Your settings couldn't be read: {preferences.error}</Notice>}
      {saveError && <Notice tone={Tone.Danger}>Your change wasn't saved: {saveError}</Notice>}
      {!data && !preferences.error && <p className="muted">Reading your settings…</p>}
      {data && (
        <>
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
