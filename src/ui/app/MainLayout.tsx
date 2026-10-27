import { useMemo } from "react";
import type { ComponentType } from "react";
import { ApprovalStatus, Tabs } from "../../ui-kit";
import type { TabItem } from "../../ui-kit";
import { ChangesView } from "../views/ChangesView";
import { ChatView } from "../views/ChatView";
import { ChordsView } from "../views/ChordsView";
import { LyricsView } from "../views/LyricsView";
import { MasteringView } from "../views/MasteringView";
import { MemoryView } from "../views/MemoryView";
import { MixerView } from "../views/MixerView";
import { PersonalisationView } from "../views/PersonalisationView";
import { PianoRollView } from "../views/PianoRollView";
import { ReleaseView } from "../views/ReleaseView";
import { SongView } from "../views/SongView";
import { SoundsView } from "../views/SoundsView";
import { AppHeader } from "./AppHeader";
import { useAppState, useClient } from "./hooks";
import { StatusBar } from "./StatusBar";
import { VIEW_LABELS, VIEW_ORDER, ViewId } from "./views";

const VIEWS: Record<ViewId, ComponentType> = {
  [ViewId.Chat]: ChatView,
  [ViewId.Song]: SongView,
  [ViewId.Lyrics]: LyricsView,
  [ViewId.PianoRoll]: PianoRollView,
  [ViewId.Chords]: ChordsView,
  [ViewId.Sounds]: SoundsView,
  [ViewId.Mixer]: MixerView,
  [ViewId.Mastering]: MasteringView,
  [ViewId.Release]: ReleaseView,
  [ViewId.Changes]: ChangesView,
  [ViewId.Memory]: MemoryView,
  [ViewId.Personalisation]: PersonalisationView,
};

/** The full layout: header, tabs with the selected page, and the connection status. */
export function MainLayout() {
  const { store } = useClient();
  const view = useAppState((state) => state.view);
  const approvals = useAppState((state) => state.approvals);
  const waiting = useMemo(() => approvals.filter((approval) => approval.status === ApprovalStatus.Pending).length, [approvals]);
  const tabs = useMemo(() => tabItems(waiting), [waiting]);
  const ActiveView = VIEWS[view];

  return (
    <div className="app">
      <AppHeader />
      <Tabs label="Ode" items={tabs} selected={view} onSelect={(id) => store.setView(id)}>
        <ActiveView />
      </Tabs>
      <StatusBar />
    </div>
  );
}

function tabItems(waiting: number): TabItem<ViewId>[] {
  return VIEW_ORDER.map((id) => {
    const item: TabItem<ViewId> = { id, label: VIEW_LABELS[id] };
    if (id === ViewId.Changes && waiting > 0) {
      item.badge = String(waiting);
      item.badgeLabel = `${waiting} waiting for approval`;
    }
    return item;
  });
}
