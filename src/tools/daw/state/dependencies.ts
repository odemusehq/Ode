import { MIXER_INDEX, type DeviceRef, type ParameterRef, type TrackRef } from "../../../shared/live";
import type { MixerInfo } from "../../../shared/live-ops";
import type { DeviceSnapshot, SetSnapshot, TrackSnapshot } from "../../../shared/set-snapshot";
import { defineTool } from "../../define";

/** Raw controls are observed; their routing, automation and audible activity are not. */
function sendControls(track: TrackRef, mixer: MixerInfo, chain: number[] = []) {
  return mixer.sends.map((send, index) => ({
    parameter: { device: { track, ...(chain.length > 0 ? { chain } : {}), index: MIXER_INDEX }, parameter: index + 2 } satisfies ParameterRef,
    name: send.name,
    value: send.value ?? null,
    min: send.min,
    max: send.max,
    destination: null,
  }));
}

function trackDependencies(track: TrackSnapshot, ref: TrackRef) {
  const devices: { device: DeviceRef; name: string; className: string }[] = [];
  const chains: { rack: DeviceRef; index: number; path: number[]; receivingNote?: number; sendControls: ReturnType<typeof sendControls> | null }[] = [];
  const visit = (list: DeviceSnapshot[], path: number[]) => {
    for (const device of list) {
      const deviceRef: DeviceRef = { track: ref, ...(path.length > 0 ? { chain: path } : {}), index: device.index };
      devices.push({ device: deviceRef, name: device.name, className: device.className });
      for (const chain of device.chains ?? []) {
        const nested = [...path, device.index, chain.index];
        chains.push({ rack: deviceRef, index: chain.index, path: nested, receivingNote: chain.receivingNote, sendControls: chain.mixer ? sendControls(ref, chain.mixer, nested) : null });
        visit(chain.devices, nested);
      }
    }
  };
  visit(track.devices, []);
  return {
    track: ref, name: track.name, kind: track.kind,
    group: track.groupTrack === null ? null : { index: track.groupTrack },
    devices, chains, sendControls: sendControls(ref, track.mixer),
  };
}

/** Known object containment and controls, not a reconstructed signal-routing graph or scheduling proof. */
export function observedSetDependencies(snapshot: SetSnapshot) {
  return {
    takenAt: snapshot.takenAt,
    complete: false,
    tracks: [
      ...snapshot.tracks.map((track, index) => trackDependencies(track, { index })),
      ...snapshot.returnTracks.map((track, returnIndex) => trackDependencies(track, { returnIndex })),
      trackDependencies(snapshot.main, { main: true }),
    ],
    globalResources: [
      "Song tempo, grid, scale, scenes and locators; scene rows shared across tracks",
      "Track-list structure and positional references",
      "Solo/arming behaviour, native transactions and whole-Set snapshots",
      "Ode song data, settings, approvals and version history",
    ],
    unknown: [
      "Track input/output and sidechain routing",
      "Automation and cross-device modulation or mappings",
      "Opaque plug-in dependencies and external hardware state",
      "Send destinations and whether a send is audible; raw values do not establish active signal routes",
    ],
    use: "Planning and inspection only. Group membership and device/chain containment are observed, not complete signal routes. No conventional track-to-Main route is inferred. Keep host operations ordered and resolve references again before editing; this snapshot does not authorise parallel mutations.",
  };
}

export const setDependencies = defineTool({
  name: "set_dependencies_get",
  changes: "none",
  description: "Read a fresh observed dependency map per track: current track references, group membership, device/chain containment and raw send controls. It is partial: input/output routes, sidechains, automation, cross-device mappings and opaque plug-in dependencies are not included in this map; native track_get_routing/compressor_get_sidechain can inspect supported routing separately; send values do not prove active routes. Song structure, scenes, solo/arm behaviour, transactions, whole-Set snapshots, settings and version history remain global resources. Use this for planning and inspection, never as permission for parallel host edits. No conventional track-to-Main routing is inferred. Read-only.",
  input: {},
  run: async (_input, ctx) => observedSetDependencies(await ctx.snapshots.read()),
});
