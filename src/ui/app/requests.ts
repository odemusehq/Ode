import { UI_CONFIG } from "./config";

/** What the window's buttons ask Ode, in the musician's words. */
export const REQUESTS = {
  hum: `Hum: record what I sing over the next ${UI_CONFIG.humBars} bars and turn it into MIDI on the selected track`,
} as const;
