import type { DeviceOpArgs } from "../../../shared/live-ops";
import { LiveObject } from "./live-object";

/** Outlet the device patch routes to its buffer~ and record~ ("buffer …", "record …"). */
const RECORDER_OUTLET = 1;
/** Time for buffer~ to finish writing the WAV file after recording stops. */
const WRITE_SETTLE_MS = 300;

export interface MeasureRequest extends DeviceOpArgs["master_measure"] {
  /** Where to write the WAV; added by the device's network side. */
  path: string;
}

/** Records the Master output to a WAV file, for loudness and spectrum measurement on the server. */
export class MasterRecorder {
  measure(request: MeasureRequest, done: (result: { path: string; seconds: number }) => void): void {
    const milliseconds = Math.round(request.seconds * 1000);
    outlet(RECORDER_OUTLET, "buffer", "size", milliseconds);
    if (request.play) {
      const song = new LiveObject("live_set");
      if (request.from !== undefined) song.set("current_song_time", request.from);
      song.call("start_playing");
    }
    outlet(RECORDER_OUTLET, "record", 1);
    const stop = new Task(() => {
      outlet(RECORDER_OUTLET, "record", 0);
      if (request.play) new LiveObject("live_set").call("stop_playing");
      outlet(RECORDER_OUTLET, "buffer", "writewave", request.path);
      const finish = new Task(() => done({ path: request.path, seconds: request.seconds }));
      finish.schedule(WRITE_SETTLE_MS);
    });
    stop.schedule(milliseconds);
  }
}
