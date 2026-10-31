import { localAudioTools } from "./audio-library";
import { hookRetainTool } from "./hooks";
import { memoryTools } from "./memory";
import { productionTaskTools } from "./production-task";
import { songMemoryTools } from "./song";
import { versionTools } from "./versions";
export const mnemeTools = [...memoryTools, ...songMemoryTools, ...versionTools, hookRetainTool, ...productionTaskTools, ...localAudioTools];
