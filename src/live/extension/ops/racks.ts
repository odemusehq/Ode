import type { DeviceRef } from "../../../shared/live";
import { LiveError, NotFoundError } from "../errors";
import { MIDI_MAX } from "../notes";
import { deviceText } from "../refs";
import { indexOfObject } from "../sdk";
import { OperationGroup } from "./group";
import { type OpArgs, type OpRun, type OperationTable } from "./operation";

type RackOp =
  | "rack_get_chains"
  | "rack_insert_chain"
  | "chain_insert_device"
  | "chain_delete_device"
  | "chain_duplicate_device"
  | "drum_pad_set_note";

/** Racks, their chains, the devices in those chains, and Drum Rack pads. */
export class RackOperations extends OperationGroup<RackOp> {
  table(): OperationTable<RackOp> {
    return {
      rack_get_chains: { prepare: (args) => this.getChains(args) },
      rack_insert_chain: { prepare: (args) => this.insertChain(args) },
      chain_insert_device: { prepare: (args) => this.insertDevice(args) },
      chain_delete_device: { prepare: ({ device }) => this.deleteDevice(device) },
      chain_duplicate_device: { prepare: ({ device }) => this.duplicateDevice(device) },
      drum_pad_set_note: { prepare: (args) => this.setPadNote(args) },
    };
  }

  private getChains({ device }: OpArgs<"rack_get_chains">): OpRun<"rack_get_chains"> {
    const rack = this.refs.rack(device);
    return async () => ({ chains: rack.chains.map((chain, index) => this.describe.chain(chain, index)) });
  }

  private insertChain({ device, index }: OpArgs<"rack_insert_chain">): OpRun<"rack_insert_chain"> {
    const rack = this.refs.rack(device);
    const at = OperationGroup.insertPosition(index, rack.chains.length);
    return async () => {
      const chain = await LiveError.guard(rack.insertChain(at), "insert the chain");
      return this.describe.chain(chain, indexOfObject(rack.chains, chain));
    };
  }

  /** Only Live's own devices can be inserted by name. */
  private insertDevice({ device, chain, name, index }: OpArgs<"chain_insert_device">): OpRun<"chain_insert_device"> {
    const target = this.refs.rack(device).chains[chain];
    if (!target) throw new NotFoundError(RackOperations.chainText(device, chain));
    const at = OperationGroup.insertPosition(index, target.devices.length);
    return async () => {
      const inserted = await LiveError.guard(
        target.insertDevice(name, at),
        `insert "${name}" (only Live's own devices can be inserted by name)`,
      );
      const path = [...(device.chain ?? []), device.index, chain];
      return { device: { track: device.track, chain: path, index: indexOfObject(target.devices, inserted) }, name: inserted.name };
    };
  }

  /** Sets which MIDI note plays a Drum Rack pad. */
  private setPadNote({ device, chain, note }: OpArgs<"drum_pad_set_note">): OpRun<"drum_pad_set_note"> {
    const pad = this.refs.drumRack(device).chains[chain];
    if (!pad) throw new NotFoundError(RackOperations.chainText(device, chain));
    if (!(Number.isInteger(note) && note >= 0 && note <= MIDI_MAX)) throw new RangeError(`note must be a MIDI note number from 0 to ${MIDI_MAX}`);
    return async () => {
      pad.receivingNote = note;
      return this.describe.chain(pad, chain);
    };
  }

  private static chainText(rack: DeviceRef, chain: number): string {
    return `chain at index ${chain} of ${deviceText(rack)}`;
  }
}
