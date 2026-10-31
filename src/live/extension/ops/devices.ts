import type { DeviceParameter } from "@ableton-extensions/sdk";
import { MIXER_INDEX, type ParameterRef } from "../../../shared/live";
import type { MaxParameterAddress } from "../../../shared/max-parameters";
import type { DeviceContainer } from "../refs";
import { isMaxWindowParameter } from "../../../shared/max-window";
import { LiveError } from "../errors";
import type { Version } from "../sdk";
import { OperationGroup } from "./group";
import { type OpArgs, type OpRun, type OperationTable } from "./operation";

type DeviceOp = "device_get" | "parameter_get" | "parameter_set" | "mixer_get";

/** Devices and their parameters, and the mixers of tracks and chains. */
export class DeviceOperations extends OperationGroup<DeviceOp> {
  table(): OperationTable<DeviceOp> {
    return {
      device_get: { prepare: (args) => this.get(args) },
      parameter_get: { prepare: (args) => this.getParameter(args) },
      parameter_set: { prepare: (args) => this.setParameter(args) },
      mixer_get: { prepare: (args) => this.getMixer(args) },
    };
  }

  private get({ device, withValues }: OpArgs<"device_get">): OpRun<"device_get"> {
    const source = this.refs.parameterSource(device);
    return async () => this.describe.device(source, device.index, withValues ?? false);
  }

  private getParameter({ parameter }: OpArgs<"parameter_get">): OpRun<"parameter_get"> {
    const found = this.refs.parameter(parameter);
    DeviceOperations.allowParameter(found.parameter);
    const maxAddress = this.parameterAddress(parameter, found.index, found.parameter.name);
    return async () => ({ ...await this.describe.parameter(found.parameter, found.index, true), maxAddress });
  }

  /** Max uses positional LOM paths, not SDK handles. Native names and subsequent Max read tokens guard that boundary. */
  private parameterAddress(ref: ParameterRef, index: number, name: string): MaxParameterAddress {
    const track = this.refs.track(ref.device.track);
    const position = this.set.tracks().position(track);
    let path = position.kind === "main" ? "live_set master_track"
      : position.kind === "return" ? `live_set return_tracks ${position.index}` : `live_set tracks ${position.index}`;
    const guards: { path: string; name?: string }[] = [{ path, name: track.name }];
    let container: DeviceContainer = track;
    const chain = ref.device.chain ?? [];
    for (let at = 0; at < chain.length; at += 2) {
      const rack = this.refs.rack({ track: ref.device.track, chain: chain.slice(0, at), index: chain[at]! });
      path += ` devices ${chain[at]}`;
      guards.push({ path, name: rack.name });
      path += ` chains ${chain[at + 1]}`;
      guards.push({ path });
      container = rack.chains[chain[at + 1]!]!;
    }
    if (ref.device.index === MIXER_INDEX) {
      path += " mixer_device";
      path += index === 0 ? " volume" : index === 1 ? " panning" : ` sends ${index - 2}`;
    } else {
      const device = container.devices[ref.device.index]!;
      path += ` devices ${ref.device.index}`;
      guards.push({ path, name: device.name });
      path += ` parameters ${index}`;
    }
    guards.push({ path, name });
    return { path, guards };
  }

  private setParameter({ parameter, value }: OpArgs<"parameter_set">): OpRun<"parameter_set"> {
    const found = this.refs.parameter(parameter);
    DeviceOperations.allowParameter(found.parameter);
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

  private static allowParameter(parameter: DeviceParameter<Version>): void {
    if (isMaxWindowParameter(parameter.name)) throw new LiveError("Ode's window connection is managed by Live and cannot be read or changed as a device parameter.");
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
