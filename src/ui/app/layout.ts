/** Which view a page shows, from its ?view= parameter: the full window, the compact strip, or Settings. */
export enum Layout {
  Full = "full",
  Compact = "compact",
  Settings = "settings",
}

const VIEW_PARAMETER = "view";

export function layoutFromUrl(): Layout {
  const view = new URLSearchParams(window.location.search).get(VIEW_PARAMETER);
  return (Object.values(Layout) as string[]).includes(view ?? "") ? (view as Layout) : Layout.Full;
}
