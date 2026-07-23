import { AppErrorBoundary } from "./components/common/AppErrorBoundary";
import { EngineGate } from "./components/common/EngineGate";
import { ThemeController } from "./components/common/ThemeController";
import { TopToolbar } from "./components/common/TopToolbar";
import { ActionBar } from "./components/common/ActionBar";
import { StartupBootstrap } from "./components/common/StartupBootstrap";
import { WorkspaceSidebar } from "./components/workspace/WorkspaceSidebar";
import { CenterPanel } from "./components/preview/CenterPanel";
import { OptionsSidebar } from "./components/options/OptionsSidebar";
import "./App.css";

function App() {
  return (
    <AppErrorBoundary>
      <ThemeController />
      <EngineGate>
        <div className="app-shell">
          <StartupBootstrap />
          <TopToolbar />
          <div className="main-layout">
            <WorkspaceSidebar />
            <CenterPanel />
            <OptionsSidebar />
          </div>
          <ActionBar />
        </div>
      </EngineGate>
    </AppErrorBoundary>
  );
}

export default App;
