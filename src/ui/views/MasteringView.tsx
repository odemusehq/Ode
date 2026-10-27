import { useCallback } from "react";
import type { Detectable, LoudnessTarget } from "../../shared/personalisation";
import { Button, ButtonVariant, Meter, Notice, Panel, Tone } from "../../ui-kit";
import { formatLufs, formatPercent, formatTruePeak } from "../app/format";
import { useAppState, useClient, useRequest } from "../app/hooks";
import { Fact } from "./Fact";
import "./views.css";

export function MasteringView() {
  const client = useClient();
  const loadPreferences = useCallback(() => client.api.getPreferences(), [client]);
  const preferences = useRequest(loadPreferences);
  const meters = useAppState((state) => state.meters);
  const target = preferences.data?.resolved.loudnessTarget;
  const setting = preferences.data?.personalisation.loudnessTarget;

  return (
    <div className="view">
      <div className="view-toolbar">
        <p className="view-toolbar__text">
          Ode measures loudness and true peak on the Master while the song plays, then suggests changes to the mastering chain.
        </p>
        <Button variant={ButtonVariant.Primary} onClick={() => void client.ask(checkMasterRequest(target))}>
          Check the master
        </Button>
      </div>
      <Panel title="Loudness target">
        {preferences.error && <Notice tone={Tone.Danger}>Your settings couldn't be read: {preferences.error}</Notice>}
        {target ? (
          <dl className="facts">
            <Fact label="Integrated loudness" value={formatLufs(target.lufs)} />
            <Fact label="True peak ceiling" value={formatTruePeak(target.truePeak)} />
          </dl>
        ) : (
          !preferences.error && <p className="muted">Reading your settings…</p>
        )}
        {setting && <p className="muted small">{targetSource(setting)} You can change it in Personalisation.</p>}
      </Panel>
      <Panel title="Master output">
        {meters?.master ? (
          <Meter label="Master level" level={meters.master.level} />
        ) : (
          <p className="muted">The Master level shows while the song plays and the Ode device is on the Master track.</p>
        )}
      </Panel>
    </div>
  );
}

function checkMasterRequest(target: LoudnessTarget | undefined): string {
  const goal = target ? ` against my target of ${formatLufs(target.lufs)} and ${formatTruePeak(target.truePeak)}` : "";
  return `Check the master: measure the loudness and true peak${goal}.`;
}

function targetSource(setting: Detectable<LoudnessTarget>): string {
  if (setting.mode === "set") return "Set by you.";
  if (setting.detected) return `Detected, ${formatPercent(setting.detected.confidence)} confidence.`;
  return "Not detected yet, so Ode uses the streaming target.";
}
