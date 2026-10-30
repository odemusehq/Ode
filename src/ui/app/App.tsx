import { t } from "../../shared/i18n";
import { useEffect } from "react";
import { AskDialog } from "./Dialogs";
import { LiveDialog } from "./dialog";
import { useAppState, useClient } from "./hooks";
import { Layout } from "./layout";
import "./App.css";

export function App() {
  const client = useClient();
  const busy = useAppState((state) => state.busy);
  const sidebarOpen = useAppState((state) => state.sidebarOpen);
  const sidebarView = useAppState((state) => state.sidebarView);
  useEffect(() => { document.title = t("common.ode"); client.windowReady(); }, [client, sidebarOpen, sidebarView]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (sidebarOpen) {
        event.preventDefault();
        const inside = document.getElementById("ode-sidebar")?.contains(document.activeElement);
        void client.navigate(Layout.Ask).then(() => {
          if (inside && !client.store.getSnapshot().sidebarOpen) document.getElementById("ode-sidebar-toggle")?.focus();
        });
      } else if (LiveDialog.hosted && (!busy || !LiveDialog.modal)) void client.close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [client, busy, sidebarOpen]);
  return <AskDialog />;
}
