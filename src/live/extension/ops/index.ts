import type { ExtensionOp } from "../../../shared/live";
import { AudioOperations } from "./audio";
import { AudioClipOperations } from "./audio-clips";
import { ClipSlotOperations } from "./clip-slots";
import { ClipOperations } from "./clips";
import { DeviceOperations } from "./devices";
import type { LiveServices } from "./group";
import { MidiNoteOperations } from "./midi-notes";
import type { OperationTable, RegularOp } from "./operation";
import { RackOperations } from "./racks";
import { OperationRegistry } from "./registry";
import { SceneOperations } from "./scenes";
import { SimplerOperations } from "./simpler";
import { SnapshotOperations } from "./snapshot";
import { SongOperations } from "./song";
import { TakeLaneOperations } from "./take-lanes";
import { TrackOperations } from "./tracks";
import { UndoOperations } from "./undo";

/** Every operation by name, from the group that implements it. */
export function createOperationRegistry(services: LiveServices): OperationRegistry {
  const regular: OperationTable<RegularOp> = {
    ...new SongOperations(services).table(),
    ...new TrackOperations(services).table(),
    ...new TakeLaneOperations(services).table(),
    ...new ClipSlotOperations(services).table(),
    ...new ClipOperations(services).table(),
    ...new MidiNoteOperations(services).table(),
    ...new AudioClipOperations(services).table(),
    ...new DeviceOperations(services).table(),
    ...new RackOperations(services).table(),
    ...new SimplerOperations(services).table(),
    ...new SceneOperations(services).table(),
    ...new AudioOperations(services).table(),
    ...new SnapshotOperations(services).table(),
  };
  const all: OperationTable<ExtensionOp> = { ...regular, ...new UndoOperations(services.live, regular).table() };
  return new OperationRegistry(services.live, all);
}
