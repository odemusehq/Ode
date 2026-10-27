import { useCallback, useMemo, useState } from "react";
import { Notice, Panel, Toggle, Tone } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { toolWords } from "../app/format";
import { useClient, useReloadOnChange, useRequest } from "../app/hooks";

export interface AllowedChangesProps {
  /** Changes when approvals are decided, so the list is read again. */
  refreshKey: number;
}

/** Kinds of change Ode may make without asking; each can be turned off again. */
export function AllowedChanges({ refreshKey }: AllowedChangesProps) {
  const client = useClient();
  const loadPreferences = useCallback(() => client.api.getPreferences(), [client]);
  const preferences = useRequest(loadPreferences);
  const [turnedOff, setTurnedOff] = useState<readonly string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const allowed = useMemo(() => preferences.data?.allowedChanges ?? [], [preferences.data]);
  const tools = useMemo(() => [...new Set([...allowed, ...turnedOff])].sort(), [allowed, turnedOff]);
  useReloadOnChange(refreshKey, preferences.reload);

  const setAllowed = async (tool: string, on: boolean) => {
    setTurnedOff((current) => (on ? current.filter((name) => name !== tool) : [...current, tool]));
    const next = on ? [...allowed, tool] : allowed.filter((name) => name !== tool);
    try {
      preferences.setData(await client.api.savePreferences({ allowedChanges: next }));
      setSaveError(null);
    } catch (error) {
      setSaveError(errorMessage(error));
    }
  };

  return (
    <Panel title="Allowed without asking" collapsible>
      <p className="muted small">Ode makes these kinds of change without asking first. Turn one off to be asked again.</p>
      {preferences.error && <Notice tone={Tone.Danger}>Your settings couldn't be read: {preferences.error}</Notice>}
      {saveError && <Notice tone={Tone.Danger}>The change wasn't saved: {saveError}</Notice>}
      {tools.length === 0 ? (
        <p className="muted">None yet. Choose "Always allow this kind of change" on a request to add one.</p>
      ) : (
        <ul className="plain-list">
          {tools.map((tool) => (
            <li key={tool} title={tool}>
              <Toggle label={toolWords(tool)} checked={allowed.includes(tool)} onChange={(on) => void setAllowed(tool, on)} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
