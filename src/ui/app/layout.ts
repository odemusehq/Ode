/** The chat or the panel opened beside it, from the ?view= parameter. */
export enum Layout {
  Ask = "ask",
  Lyrics = "lyrics",
  History = "history",
  Settings = "settings",
}

export type SidebarView = Exclude<Layout, Layout.Ask>;

const VIEW_PARAMETER = "view";

export function layoutFromUrl(): Layout {
  const view = new URLSearchParams(window.location.search).get(VIEW_PARAMETER);
  return (Object.values(Layout) as string[]).includes(view ?? "") ? (view as Layout) : Layout.Ask;
}
