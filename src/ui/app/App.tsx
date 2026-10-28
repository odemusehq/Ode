import { CompactStrip } from "./CompactStrip";
import { useClient } from "./hooks";
import { Layout } from "./layout";
import { MainLayout } from "./MainLayout";
import "./App.css";

export function App() {
  const { layout } = useClient();
  return layout === Layout.Compact ? <CompactStrip /> : <MainLayout />;
}
