export enum ViewId {
  History = "history",
  Lyrics = "lyrics",
  Song = "song",
  Mix = "mix",
  Release = "release",
  Memory = "memory",
  Personalisation = "personalisation",
}

/** Tab order: the way back first, then writing, production, release, and Ode's own settings. */
export const VIEW_ORDER: readonly ViewId[] = [
  ViewId.History,
  ViewId.Lyrics,
  ViewId.Song,
  ViewId.Mix,
  ViewId.Release,
  ViewId.Memory,
  ViewId.Personalisation,
];

export const VIEW_LABELS: Record<ViewId, string> = {
  [ViewId.History]: "History",
  [ViewId.Lyrics]: "Lyrics",
  [ViewId.Song]: "Song",
  [ViewId.Mix]: "Mix",
  [ViewId.Release]: "Release",
  [ViewId.Memory]: "Memory",
  [ViewId.Personalisation]: "Personalisation",
};
