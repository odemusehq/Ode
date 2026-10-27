import { TaggedName } from "../tags";
import { OperationGroup } from "./group";
import { OperationKind, type OpArgs, type OpRun, type OperationTable } from "./operation";

type ClipOp = "clip_get" | "clip_set";

/** Clip colours are RGB numbers from 0x000000 to 0xFFFFFF. */
const LARGEST_COLOR = 0xffffff;

/** Any clip, in Session View or the Arrangement. */
export class ClipOperations extends OperationGroup<ClipOp> {
  table(): OperationTable<ClipOp> {
    return {
      clip_get: { kind: OperationKind.Read, prepare: (args) => this.get(args) },
      clip_set: { kind: OperationKind.Change, prepare: (args) => this.setClip(args) },
    };
  }

  private get({ clip }: OpArgs<"clip_get">): OpRun<"clip_get"> {
    const found = this.refs.clip(clip);
    return async () => this.describe.clip(found.clip, found.location);
  }

  private setClip({ clip, name, color, muted, looping }: OpArgs<"clip_set">): OpRun<"clip_set"> {
    const { clip: target, location } = this.refs.clip(clip);
    if (color !== undefined && !(Number.isInteger(color) && color >= 0 && color <= LARGEST_COLOR)) {
      throw new RangeError(`color must be an RGB number from 0 to ${LARGEST_COLOR}`);
    }
    return async () => {
      this.live.withinTransaction(() => {
        if (name !== undefined) TaggedName.rename(target, name);
        if (color !== undefined) target.color = color;
        if (muted !== undefined) target.muted = muted;
        if (looping !== undefined) target.looping = looping;
      });
      return this.describe.clip(target, location);
    };
  }
}
