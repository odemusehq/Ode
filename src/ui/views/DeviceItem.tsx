import { useCallback, useState } from "react";
import type { TrackRef } from "../../shared/live";
import type { DeviceInfo, DeviceSummary, ParameterInfo } from "../../shared/live-ops";
import { Badge, Notice, Panel, Tone } from "../../ui-kit";
import { useClient, useRequest } from "../app/hooks";

export interface DeviceItemProps {
  trackRef: TrackRef;
  device: DeviceSummary;
}

/** A device on a track; its parameters load when the section is opened. */
export function DeviceItem({ trackRef, device }: DeviceItemProps) {
  const client = useClient();
  const [open, setOpen] = useState(false);
  const load = useCallback(
    (): Promise<DeviceInfo | null> =>
      open ? client.api.liveRead("device_get", { device: { track: trackRef, index: device.index }, withValues: true }) : Promise.resolve(null),
    [client, open, trackRef, device.index],
  );
  const info = useRequest(load);

  return (
    <Panel
      title={device.name}
      collapsible
      onToggle={setOpen}
      actions={<Badge tone={device.isRack ? Tone.Info : Tone.Neutral}>{device.isRack ? "Rack" : device.className}</Badge>}
    >
      {info.error && <Notice tone={Tone.Danger}>The parameters couldn't be read: {info.error}</Notice>}
      {open && info.loading && !info.data && <p className="muted">Reading parameters…</p>}
      {info.data && <ParameterTable parameters={info.data.parameters} />}
    </Panel>
  );
}

interface ParameterTableProps {
  parameters: readonly ParameterInfo[];
}

function ParameterTable({ parameters }: ParameterTableProps) {
  if (parameters.length === 0) return <p className="muted">This device has no parameters.</p>;
  return (
    <table className="parameters">
      <thead>
        <tr>
          <th scope="col">Parameter</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {parameters.map((parameter) => (
          <tr key={parameter.index}>
            <td>{parameter.name}</td>
            <td>{parameterValue(parameter)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function parameterValue(parameter: ParameterInfo): string {
  if (parameter.value === undefined) return "–";
  const item = parameter.valueItems[Math.round(parameter.value)];
  if (parameter.isQuantized && item !== undefined) return item;
  return String(Number(parameter.value.toFixed(2)));
}
