import type { AnyTool } from "../define";
import { basslineWriteTool } from "./bassline-write";
import { drumGrooveWriteTool } from "./drum-groove-write";
import { harmonizeTool } from "./harmonize";
import { harmonyVocalsWriteTool } from "./harmony-vocals-write";
import { lyricsAnalyzeTool } from "./lyrics-analyze";
import { lyricsFitMelodyTool } from "./lyrics-fit-melody";
import { melodyVaryTool } from "./melody-vary";
import { melodyWriteTool } from "./melody-write";
import { notesCheckTool } from "./notes-check";
import { originalityCheckTool } from "./originality-check";
import { prosodyCheckTool } from "./prosody-check";
import { rhymeFindTool } from "./rhyme-find";
import { rhymeSchemeTool } from "./rhyme-scheme";
import { setLyricsToMelodyTool } from "./set-lyrics-to-melody";
import { singabilityCheckTool } from "./singability-check";
import { songFormPlanTool } from "./song-form-plan";
import { stressTool } from "./stress";
import { syllablesTool } from "./syllables";
import { voiceChordsTool } from "./voice-chords";

/** Ode's music tools for words and notes; they compute and change nothing in Live or Mneme. */
export const musicTools: AnyTool[] = [
  lyricsAnalyzeTool,
  syllablesTool,
  stressTool,
  rhymeFindTool,
  rhymeSchemeTool,
  prosodyCheckTool,
  singabilityCheckTool,
  setLyricsToMelodyTool,
  lyricsFitMelodyTool,
  melodyWriteTool,
  melodyVaryTool,
  harmonizeTool,
  voiceChordsTool,
  basslineWriteTool,
  drumGrooveWriteTool,
  songFormPlanTool,
  harmonyVocalsWriteTool,
  notesCheckTool,
  originalityCheckTool,
];
