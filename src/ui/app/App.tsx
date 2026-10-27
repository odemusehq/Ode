import { CompactStrip } from "./CompactStrip";
import { MainLayout } from "./MainLayout";
import "./App.css";

/** The Ode device opens the UI twice: compact in the device area, full in the Ode window. */
enum Layout {
  Full = "full",
  Compact = "compact",
}

function layoutFromUrl(): Layout {
  return new URLSearchParams(window.location.search).get("view") === Layout.Compact ? Layout.Compact : Layout.Full;
}

export function App() {
  return layoutFromUrl() === Layout.Compact ? <CompactStrip /> : <MainLayout />;
}
