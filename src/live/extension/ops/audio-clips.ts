import { WarpMode } from "@ableton-extensions/sdk";
import { OperationGroup } from "./group";
import { type OpArgs, type OpRun, type OperationTable } from "./operation";

type AudioClipOp = "audio_clip_get" | "audio_clip_set";

/** "0 (Beats), 1 (Tones), …, 6 (Complex Pro)": the warp modes Live offers, for messages. */
const WARP_MODES = Object.entries(WarpMode)
  .filter(([, value]) => typeof value === "number")
  .map(([name, value]) => `${value} (${name.replace(/(?<=[a-z])(?=[A-Z])/g, " ")})`)
  .join(", ");

function isWarpMode(value: number): value is WarpMode {
  return Number.isInteger(value) && WarpMode[value] !== undefined;
}

/** Audio clips: their file, warping and warp mode. */
export class AudioClipOperations extends OperationGroup<AudioClipOp> {
  table(): OperationTable<AudioClipOp> {
    return {
      audio_clip_get: { prepare: (args) => this.get(args) },
      audio_clip_set: { prepare: (args) => this.setClip(args) },
    };
  }

  private get({ clip }: OpArgs<"audio_clip_get">): OpRun<"audio_clip_get"> {
    const found = this.refs.audioClip(clip);
    return async () => this.describe.audioClip(found.clip, found.location);
  }

  private setClip({ clip, warping, warpMode }: OpArgs<"audio_clip_set">): OpRun<"audio_clip_set"> {
    const { clip: target, location } = this.refs.audioClip(clip);
    if (warpMode !== undefined && !isWarpMode(warpMode)) throw new RangeError(`warpMode must be one of ${WARP_MODES}`);
    return async () => {
      this.live.withinTransaction(() => {
        if (warping !== undefined) target.warping = warping;
        if (warpMode !== undefined) target.warpMode = warpMode;
      });
      return this.describe.audioClip(target, location);
    };
  }
}
