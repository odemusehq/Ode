import { audioAnalyze } from "./analyze";
import { humToMidiTool } from "./hum-to-midi";
import { masterCheckTool } from "./master-check";
import { mixCheck } from "./mix-check";
import type { AnyTool } from "../define";

export const audioTools: AnyTool[] = [audioAnalyze, humToMidiTool, mixCheck, masterCheckTool];
