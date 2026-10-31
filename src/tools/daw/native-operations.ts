import type { AnyTool } from "../define";
import { clipTools as clipActions, clipSlotTools as clipSlotActions, takeLaneTools as takeLaneActions } from "./actions/clips";
import { deviceTools as deviceActions, rackTools as rackActions } from "./actions/devices";
import { sceneTools as sceneActions } from "./actions/scenes-audio";
import { songTools as songActions } from "./actions/song";
import { trackTools as trackActions } from "./actions/tracks";
import { clipSlotTools as clipSlotState, clipTools as clipState, takeLaneTools as takeLaneState } from "./state/clips";
import { deviceTools as deviceState, rackTools as rackState } from "./state/devices";
import { audioFileTools as audioFileState, sceneTools as sceneState } from "./state/scenes-audio";
import { songTools as songState } from "./state/song";
import { trackTools as trackState } from "./state/tracks";

export const nativeOperations: AnyTool[] = [
  ...songState,
  ...songActions,
  ...trackState,
  ...trackActions,
  ...takeLaneState,
  ...clipSlotState,
  ...clipState,
  ...takeLaneActions,
  ...clipSlotActions,
  ...clipActions,
  ...deviceState,
  ...rackState,
  ...deviceActions,
  ...rackActions,
  ...sceneState,
  ...audioFileState,
  ...sceneActions
];
