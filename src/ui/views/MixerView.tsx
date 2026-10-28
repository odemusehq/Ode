import { Button, ButtonVariant, EmptyState, Meter, Orientation, Panel } from "../../ui-kit";
import { useAppState, useClient } from "../app/hooks";
import type { MeterReadings } from "../app/model";
import { REQUESTS } from "../app/requests";
import "./MixerView.css";
import "./views.css";

/** The meters, with "Check the mix" (problems come back with Fix) and "Master for streaming". */
export function MixerView() {
  const client = useClient();
  const meters = useAppState((state) => state.meters);
  const busy = useAppState((state) => state.busy);

  return (
    <div className="view">
      <div className="view-toolbar">
        <p className="view-toolbar__text">Levels of each track and the Master while the song plays, as Live meters them.</p>
        <Button variant={ButtonVariant.Primary} disabled={busy} onClick={() => void client.send(REQUESTS.checkMix)}>
          Check the mix
        </Button>
        <Button disabled={busy} onClick={() => void client.send(REQUESTS.masterForStreaming)}>
          Master for streaming
        </Button>
      </div>
      <Panel title="Meters">
        {meters ? (
          <MeterBridge meters={meters} />
        ) : (
          <EmptyState title="No meter readings yet">
            Meters show while the song plays and the Ode device is on the Master track.
          </EmptyState>
        )}
      </Panel>
    </div>
  );
}

interface MeterBridgeProps {
  meters: MeterReadings;
}

/** One vertical meter per track, then the Master, left to right as the signal flows. */
function MeterBridge({ meters }: MeterBridgeProps) {
  return (
    <div className="mixer">
      <ul className="mixer__tracks">
        {meters.tracks.map((track, index) => (
          <li key={`${index}-${track.name}`} className="mixer__strip">
            <Meter label={`${track.name} level`} level={track.level} orientation={Orientation.Vertical} />
            <span className="mixer__name" title={track.name}>
              {track.name}
            </span>
          </li>
        ))}
      </ul>
      {meters.master && (
        <div className="mixer__strip mixer__strip--master">
          <Meter label="Master level" level={meters.master.level} orientation={Orientation.Vertical} />
          <span className="mixer__name">Master</span>
        </div>
      )}
    </div>
  );
}
