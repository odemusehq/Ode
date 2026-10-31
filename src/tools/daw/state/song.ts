import { extensionTool } from "../extension-tool";

export const songTools = [
  extensionTool({
    op: "song_get",
    alwaysLoad: true,
    description:
      "Read the open Live Set: tempo, Arrangement grid, key and scale (root note 0 = C … 11 = B, scale name, whether Scale Mode is on, scale intervals), every track with its devices, return tracks, scenes and locators. Use it before acting so you know what is in the Set.",
    input: {},
  })
];
