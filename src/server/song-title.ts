/** The name the dialogs show for the song. */
export class SongTitle {
  static readonly UNTITLED = "Untitled song";

  /** The lead sheet's title, else "Untitled song". */
  static of(title: string): string {
    return title.trim() || SongTitle.UNTITLED;
  }
}
