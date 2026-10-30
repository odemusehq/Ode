import { ModePicker } from "../views/ModePicker";
import { SongMenu } from "../views/SongMenu";
import { IconButton, IconName } from "../../ui-kit";
import { LogoLockup } from "./Logo";
import { useAppState, useClient } from "./hooks";

/** The fixed workspace toolbar; opening a panel never rearranges its controls. */
export function DialogHeader() {
  const client = useClient();
  const open = useAppState((state) => state.sidebarOpen);
  return <header className="app-header">
    <h1 className="app-header__name"><LogoLockup /></h1>
    <div className="app-header__song"><SongMenu /></div>
    <ModePicker />
    <IconButton id="ode-sidebar-toggle" icon={IconName.Sidebar} className="app-header__sidebar"
      label={open ? "Hide sidebar" : "Show sidebar"} aria-expanded={open} aria-controls="ode-sidebar"
      onClick={() => void client.toggleSidebar()} />
  </header>;
}
