/** Which dialog a page is, from its ?view= parameter: Ask Ode, Lyrics, History or Settings. */
export enum Layout {
  Ask = "ask",
  Lyrics = "lyrics",
  History = "history",
  Settings = "settings",
}

const VIEW_PARAMETER = "view";

export function layoutFromUrl(): Layout {
  const view = new URLSearchParams(window.location.search).get(VIEW_PARAMETER);
  return (Object.values(Layout) as string[]).includes(view ?? "") ? (view as Layout) : Layout.Ask;
}
