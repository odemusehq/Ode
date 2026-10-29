import { SettingsView } from "../views/SettingsView";
import { CompactStrip } from "./CompactStrip";
import { useClient } from "./hooks";
import { Layout } from "./layout";
import { MainLayout } from "./MainLayout";
import "./App.css";

export function App() {
  const { layout } = useClient();
  switch (layout) {
    case Layout.Compact:
      return <CompactStrip />;
    case Layout.Settings:
      return <SettingsView />;
    default:
      return <MainLayout />;
  }
}
