import { extensionTool } from "../extension-tool";

import { TrackRefSchema } from "../schemas";

export const trackTools = [
  extensionTool({
    op: "track_get",
    alwaysLoad: true,
    description:
      "Read one track: name, kind (MIDI, audio, group, return, Main), mute, solo, arm, devices, Session clip slots with their clips, Arrangement clips, take lanes, and its group track.",
    input: { track: TrackRefSchema },
  })
];
