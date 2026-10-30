import { audioAnalyze } from "./analyze";
import { humToMidiTool } from "./hum-to-midi";
import { mixCheck } from "./mix-check";
import type { AnyTool } from "../define";
import { processedAudioTools } from "./processed-audio";

export const audioTools: AnyTool[] = [audioAnalyze, humToMidiTool, mixCheck, ...processedAudioTools];
