"use client";

import { useEffect } from "react";
import { useGatewayStore } from "@/lib/gateway/store";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { OverviewView } from "@/components/overview/overview-view";
import { PlaygroundView } from "@/components/playground/playground-view";
import { MetricsView } from "@/components/metrics/metrics-view";
import { BackendsView } from "@/components/backends/backends-view";
import { LogsView } from "@/components/logs/logs-view";
import { ArchitectureView } from "@/components/architecture/architecture-view";
import { CheatSheetDialog } from "./cheat-sheet-dialog";
import { CommandPalette } from "./command-palette";
import { useKeyboardShortcuts } from "@/lib/gateway/use-keyboard-shortcuts";
import { ConceptExplainerProvider } from "@/components/common/concept-explainer";
import { OnboardingTour } from "./onboarding-tour";

export function DashboardShell() {
  const view = useGatewayStore((s) => s.view);
  const runTick = useGatewayStore((s) => s.runTick);
  const { cheatOpen, setCheatOpen, paletteOpen, setPaletteOpen } = useKeyboardShortcuts();

  useEffect(() => {
    runTick();
    const id = setInterval(runTick, 1500);
    return () => clearInterval(id);
  }, [runTick]);

  return (
    <ConceptExplainerProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            {view === "overview" && <OverviewView />}
            {view === "playground" && <PlaygroundView />}
            {view === "metrics" && <MetricsView />}
            {view === "backends" && <BackendsView />}
            {view === "logs" && <LogsView />}
            {view === "architecture" && <ArchitectureView />}
          </main>
        </div>
      </div>

      <CheatSheetDialog open={cheatOpen} onOpenChange={setCheatOpen} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <OnboardingTour />

      <div className="pointer-events-none fixed bottom-3 right-3 z-40 select-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-border/40 bg-card/80 px-2.5 py-1 font-mono text-[10px] text-muted-foreground/70 shadow-lg backdrop-blur-sm">
          <kbd className="rounded border border-border/60 bg-muted/60 px-1 py-0.5 text-[9px]">⌘</kbd>
          <kbd className="rounded border border-border/60 bg-muted/60 px-1 py-0.5 text-[9px]">K</kbd>
          <span>commands</span>
          <span className="mx-1 text-muted-foreground/30">·</span>
          <kbd className="rounded border border-border/60 bg-muted/60 px-1 py-0.5 text-[9px]">?</kbd>
          <span>help</span>
        </div>
      </div>
    </ConceptExplainerProvider>
  );
}
