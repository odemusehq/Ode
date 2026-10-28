import { basename } from "node:path";

/** Live's Set files end in .als. */
const SET_FILE_EXTENSION = /\.als$/i;

/** The name the window shows for the song. */
export class SongTitle {
  static readonly UNTITLED = "Untitled song";

  /** The lead sheet's title, else the Set's file name without ".als", else "Untitled song". */
  static of(title: string, setFilePath: string | null): string {
    const named = title.trim();
    if (named) return named;
    const fileName = setFilePath ? basename(setFilePath).replace(SET_FILE_EXTENSION, "").trim() : "";
    return fileName || SongTitle.UNTITLED;
  }
}
