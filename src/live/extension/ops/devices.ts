import type { DeviceParameter } from "@ableton-extensions/sdk";
import { LiveError } from "../errors";
import type { Version } from "../sdk";
import { OperationGroup } from "./group";
import { OperationKind, type OpArgs, type OpRun, type OperationTable } from "./operation";

type DeviceOp = "device_get" | "parameter_get" | "parameter_set" | "mixer_get";

/** Devices and their parameters, and the mixers of tracks and chains. */
export class DeviceOperations extends OperationGroup<DeviceOp> {
  table(): OperationTable<DeviceOp> {
    return {
      device_get: { kind: OperationKind.Read, prepare: (args) => this.get(args) },
      parameter_get: { kind: OperationKind.Read, prepare: (args) => this.getParameter(args) },
      parameter_set: { kind: OperationKind.Change, prepare: (args) => this.setParameter(args) },
      mixer_get: { kind: OperationKind.Read, prepare: (args) => this.getMixer(args) },
    };
  }

  private get({ device, withValues }: OpArgs<"device_get">): OpRun<"device_get"> {
    const source = this.refs.parameterSource(device);
    return async () => this.describe.device(source, device.index, withValues ?? false);
  }

  private getParameter({ parameter }: OpArgs<"parameter_get">): OpRun<"parameter_get"> {
    const found = this.refs.parameter(parameter);
    return async () => this.describe.parameter(found.parameter, found.index, true);
  }

  private setParameter({ parameter, value }: OpArgs<"parameter_set">): OpRun<"parameter_set"> {
    const found = this.refs.parameter(parameter);
    const fitted = DeviceOperations.fit(found.parameter, value);
    return async () => {
      await LiveError.guard(found.parameter.setValue(fitted), `set ${found.parameter.name}`);
      return this.describe.parameter(found.parameter, found.index, true);
    };
  }

  private getMixer({ track }: OpArgs<"mixer_get">): OpRun<"mixer_get"> {
    const target = this.refs.track(track);
    return async () => this.describe.mixer(target.mixer);
  }

  /** Keeps the value within the parameter's range; a quantized parameter takes an index into its value items. */
  private static fit(parameter: DeviceParameter<Version>, value: number): number {
    if (!Number.isFinite(value)) throw new RangeError("value must be a number");
    const { min, max } = parameter;
    if (!parameter.isQuantized) return Math.min(max, Math.max(min, value));
    const items = parameter.valueItems.length;
    const step = Math.round(value);
    const quantized = items > 0 ? min + Math.min(items - 1, Math.max(0, step)) : step;
    return Math.min(max, Math.max(min, quantized));
  }
}
