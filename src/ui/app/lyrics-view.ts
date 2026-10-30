import { UI_CONFIG } from "./config";

/** Which marks the Lyrics editor shows, chosen in its View menu. */
export interface LyricsView {
  syllables: boolean;
  counts: boolean;
  stress: boolean;
  rhymes: boolean;
  details: boolean;
}

/** The View menu's choice, kept in the window's storage for the rest of the Live session. */
export class LyricsViewStore {
  private static readonly DEFAULT: LyricsView = { syllables: true, counts: true, stress: true, rhymes: true, details: false };

  /** The musician's last choice, or every mark when the window holds none. */
  static load(): LyricsView {
    try {
      const saved = JSON.parse(window.localStorage.getItem(UI_CONFIG.lyricsViewStorageKey) ?? "null") as Partial<LyricsView> | null;
      return { ...LyricsViewStore.DEFAULT, ...saved };
    } catch {
      return { ...LyricsViewStore.DEFAULT };
    }
  }

  static save(view: LyricsView): void {
    try {
      window.localStorage.setItem(UI_CONFIG.lyricsViewStorageKey, JSON.stringify(view));
    } catch {
      // Without storage the choice still holds while the dialog stays open.
    }
  }
}
