import type { ComponentType } from "react";
import { Tabs } from "../../ui-kit";
import type { TabItem } from "../../ui-kit";
import { HistoryView } from "../views/HistoryView";
import { LyricsView } from "../views/LyricsView";
import { MemoryView } from "../views/MemoryView";
import { MixerView } from "../views/MixerView";
import { NowPanel } from "../views/NowPanel";
import { PersonalisationView } from "../views/PersonalisationView";
import { ReleaseView } from "../views/ReleaseView";
import { SongView } from "../views/SongView";
import { AppHeader } from "./AppHeader";
import { useAppState, useClient } from "./hooks";
import { StatusBar } from "./StatusBar";
import { VIEW_LABELS, VIEW_ORDER, ViewId } from "./views";

const VIEWS: Record<ViewId, ComponentType> = {
  [ViewId.History]: HistoryView,
  [ViewId.Lyrics]: LyricsView,
  [ViewId.Song]: SongView,
  [ViewId.Mix]: MixerView,
  [ViewId.Release]: ReleaseView,
  [ViewId.Memory]: MemoryView,
  [ViewId.Personalisation]: PersonalisationView,
};

const TAB_ITEMS: readonly TabItem<ViewId>[] = VIEW_ORDER.map((id) => ({ id, label: VIEW_LABELS[id] }));

/** The Ode window: header, the Now panel (what you're on, suggestions, input, result), then the tabs. */
export function MainLayout() {
  const { store } = useClient();
  const view = useAppState((state) => state.view);
  const ActiveView = VIEWS[view];

  return (
    <div className="app">
      <AppHeader />
      <NowPanel />
      <Tabs label="Ode" items={TAB_ITEMS} selected={view} onSelect={(id) => store.setView(id)}>
        <ActiveView />
      </Tabs>
      <StatusBar />
    </div>
  );
}
