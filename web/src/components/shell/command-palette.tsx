"use client";

import { useState } from "react";
import {
  Activity,
  Send,
  BarChart3,
  Server,
  ScrollText,
  Workflow,
  RefreshCw,
  Flame,
  RotateCcw,
  Power,
  Search,
  CornerDownLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useGatewayStore, type ViewId } from "@/lib/gateway/store";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  group: "navigate" | "actions";
  run: () => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const setView = useGatewayStore((s) => s.setView);
  const probe = useGatewayStore((s) => s.probe);
  const injectFailures = useGatewayStore((s) => s.injectFailures);
  const forceCb = useGatewayStore((s) => s.forceCb);
  const resetSim = useGatewayStore((s) => s.resetSim);
  const effectiveMode = useGatewayStore((s) => s.effectiveMode);

  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const inputKey = `palette-${open}`;

  const commands: Command[] = [
    {
      id: "go-overview",
      label: "Go to Overview",
      hint: "Live KPIs and traffic",
      icon: Activity,
      group: "navigate",
      run: () => setView("overview"),
    },
    {
      id: "go-playground",
      label: "Go to Playground",
      hint: "Send requests through the gateway",
      icon: Send,
      group: "navigate",
      run: () => setView("playground"),
    },
    {
      id: "go-metrics",
      label: "Go to Metrics",
      hint: "Prometheus-style charts",
      icon: BarChart3,
      group: "navigate",
      run: () => setView("metrics"),
    },
    {
      id: "go-backends",
      label: "Go to Backends",
      hint: "Upstream pool & health",
      icon: Server,
      group: "navigate",
      run: () => setView("backends"),
    },
    {
      id: "go-logs",
      label: "Go to Logs",
      hint: "Structured request log",
      icon: ScrollText,
      group: "navigate",
      run: () => setView("logs"),
    },
    {
      id: "go-architecture",
      label: "Go to Architecture",
      hint: "Middleware chain diagram",
      icon: Workflow,
      group: "navigate",
      run: () => setView("architecture"),
    },
    {
      id: "action-probe",
      label: "Re-probe gateway",
      hint: "Check if the relay is reachable",
      icon: RefreshCw,
      group: "actions",
      run: () => void probe(),
    },
    ...(effectiveMode === "simulated"
      ? ([
          {
            id: "action-inject",
            label: "Inject failure burst",
            hint: "Trip the circuit breaker (sim only)",
            icon: Flame,
            group: "actions" as const,
            run: () => injectFailures(6),
          },
          {
            id: "action-cb-open",
            label: "Force breaker open",
            hint: "Sim only",
            icon: Power,
            group: "actions" as const,
            run: () => forceCb("open"),
          },
          {
            id: "action-cb-closed",
            label: "Close breaker",
            hint: "Sim only",
            icon: Power,
            group: "actions" as const,
            run: () => forceCb("closed"),
          },
          {
            id: "action-reset",
            label: "Reset simulation",
            hint: "Clear all simulated state",
            icon: RotateCcw,
            group: "actions" as const,
            run: () => resetSim(),
          },
        ] satisfies Command[])
      : []),
  ];

  const filtered = commands.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.label.toLowerCase().includes(q) ||
      c.hint.toLowerCase().includes(q)
    );
  });

  const run = (cmd?: Command) => {
    if (!cmd) return;
    cmd.run();
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(filtered[activeIdx]);
    }
  };

  const groups = ["navigate", "actions"] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden border-border/60 bg-card/95 p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search and run any dashboard action
        </DialogDescription>

        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground/60" />
          <input
            key={inputKey}
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search views and actions…"
            className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <kbd className="rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="py-8 text-center font-mono text-xs text-muted-foreground/50">
              No matching commands
            </div>
          )}
          {groups.map((group) => {
            const items = filtered.filter((c) => c.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="mb-2">
                <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
                  {group}
                </div>
                {items.map((cmd) => {
                  const idx = filtered.indexOf(cmd);
                  const Icon = cmd.icon;
                  const isActive = idx === activeIdx;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => run(cmd)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                        isActive ? "bg-cyan-500/10 text-cyan-100" : "text-foreground/90 hover:bg-muted/40",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          isActive ? "text-cyan-300" : "text-muted-foreground/70",
                        )}
                        strokeWidth={1.75}
                      />
                      <span className="flex-1 font-mono text-xs">{cmd.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground/60">
                        {cmd.hint}
                      </span>
                      {isActive && (
                        <CornerDownLeft className="h-3 w-3 text-cyan-300" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
