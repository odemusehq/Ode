/** The Ode device opens the UI twice: compact in the device area, full in the Ode window. */
export enum Layout {
  Full = "full",
  Compact = "compact",
}

const VIEW_PARAMETER = "view";

export function layoutFromUrl(): Layout {
  return new URLSearchParams(window.location.search).get(VIEW_PARAMETER) === Layout.Compact ? Layout.Compact : Layout.Full;
}
