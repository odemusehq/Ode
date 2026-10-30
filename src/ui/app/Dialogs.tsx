import { useEffect, useState } from "react";
import { Button, ButtonVariant } from "../../ui-kit";
import { HistoryView } from "../views/HistoryView";
import { LyricsPanel } from "../views/LyricsPanel";
import { NowPanel } from "../views/NowPanel";
import { SettingsView } from "../views/SettingsView";
import { DialogHeader } from "./DialogHeader";
import { useAppState, useClient } from "./hooks";
import { Layout } from "./layout";
import { StatusBar } from "./StatusBar";

const PANELS = [
  { view: Layout.Lyrics, label: "Lyrics" },
  { view: Layout.History, label: "History" },
  { view: Layout.Settings, label: "Settings" },
] as const;

/** One continuing conversation, with optional tools in its right sidebar. */
export function AskDialog() {
  const open = useAppState((state) => state.sidebarOpen);
  const credit = useAppState((state) => state.credit);
  return <div className={open ? "app app--drawer-open" : "app"}>
    <DialogHeader />
    <div className="app-workspace">
      <div className="app-chat"><NowPanel />{credit && <p className="app-footer__credit">{credit}</p>}<StatusBar /></div>
      <Sidebar />
    </div>
  </div>;
}

function Sidebar() {
  const client = useClient();
  const open = useAppState((state) => state.sidebarOpen);
  const selected = useAppState((state) => state.sidebarView);
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [visited, setVisited] = useState<ReadonlySet<Layout>>(() => new Set(open ? [selected] : []));
  useEffect(() => {
    if (open) setVisited((current) => current.has(selected) ? current : new Set([...current, selected]));
  }, [open, selected]);
  const activate = async (view: typeof selected) => {
    await client.navigate(view);
    if (client.store.getSnapshot().sidebarView === view) document.getElementById(`sidebar-tab-${view}`)?.focus();
  };
  return <aside id="ode-sidebar" className="workspace-sidebar" aria-label="Song workspace" aria-hidden={!open} inert={!open}>
    <nav className="sidebar-tabs" role="tablist" aria-label="Workspace panels">
      {PANELS.map(({ view, label }, index) => <Button key={view} id={`sidebar-tab-${view}`} variant={ButtonVariant.Quiet}
        role="tab" aria-selected={selected === view} aria-controls={`sidebar-panel-${view}`} tabIndex={selected === view ? 0 : -1}
        onClick={() => void activate(view)} onKeyDown={(event) => {
          const next = event.key === "ArrowRight" ? (index + 1) % PANELS.length : event.key === "ArrowLeft" ? (index + PANELS.length - 1) % PANELS.length : event.key === "Home" ? 0 : event.key === "End" ? PANELS.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault();
          void activate(PANELS[next]!.view);
        }}>{label}</Button>)}
    </nav>
    {PANELS.map(({ view }) => <div key={view} id={`sidebar-panel-${view}`} className="workspace-panel" role="tabpanel"
      aria-labelledby={`sidebar-tab-${view}`} hidden={selected !== view}>
      {(visited.has(view) || (open && selected === view)) && (view === Layout.Lyrics ? <LyricsPanel settingsRevision={settingsRevision} /> : view === Layout.History ? <HistoryView /> : <SettingsView embedded active={open && selected === view} onSaved={() => setSettingsRevision((revision) => revision + 1)} />)}
    </div>)}
  </aside>;
}
