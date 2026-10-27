export enum ViewId {
  Chat = "chat",
  Song = "song",
  Lyrics = "lyrics",
  PianoRoll = "piano-roll",
  Chords = "chords",
  Sounds = "sounds",
  Mixer = "mixer",
  Mastering = "mastering",
  Release = "release",
  Changes = "changes",
  Memory = "memory",
  Personalisation = "personalisation",
}

/** Tab order follows the work: writing, production, release, then Ode's own settings. */
export const VIEW_ORDER: readonly ViewId[] = [
  ViewId.Chat,
  ViewId.Song,
  ViewId.Lyrics,
  ViewId.PianoRoll,
  ViewId.Chords,
  ViewId.Sounds,
  ViewId.Mixer,
  ViewId.Mastering,
  ViewId.Release,
  ViewId.Changes,
  ViewId.Memory,
  ViewId.Personalisation,
];

export const VIEW_LABELS: Record<ViewId, string> = {
  [ViewId.Chat]: "Chat",
  [ViewId.Song]: "Song",
  [ViewId.Lyrics]: "Lyrics",
  [ViewId.PianoRoll]: "Piano roll",
  [ViewId.Chords]: "Chords",
  [ViewId.Sounds]: "Sounds",
  [ViewId.Mixer]: "Mixer",
  [ViewId.Mastering]: "Mastering",
  [ViewId.Release]: "Release",
  [ViewId.Changes]: "Changes",
  [ViewId.Memory]: "Memory",
  [ViewId.Personalisation]: "Personalisation",
};
