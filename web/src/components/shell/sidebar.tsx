"use client";

import { cn } from "@/lib/utils";
import {
  Activity,
  Send,
  BarChart3,
  Server,
  ScrollText,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useGatewayStore, type ViewId } from "@/lib/gateway/store";
import { StatusDot } from "@/components/common/status-dot";

interface NavItem {
  id: ViewId;
  label: string;
  description: string;
  icon: LucideIcon;
  tour: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Live KPIs and traffic",
    icon: Activity,
    tour: "view-overview",
  },
  {
    id: "playground",
    label: "Playground",
    description: "Send requests through the gateway",
    icon: Send,
    tour: "view-playground",
  },
  {
    id: "metrics",
    label: "Metrics",
    description: "Prometheus-style charts",
    icon: BarChart3,
    tour: "view-metrics",
  },
  {
    id: "backends",
    label: "Backends",
    description: "Upstream pool & health",
    icon: Server,
    tour: "view-backends",
  },
  {
    id: "logs",
    label: "Logs",
    description: "Structured request log",
    icon: ScrollText,
    tour: "view-logs",
  },
  {
    id: "architecture",
    label: "Architecture",
    description: "Middleware chain diagram",
    icon: Workflow,
    tour: "view-architecture",
  },
];

export function Sidebar() {
  const view = useGatewayStore((s) => s.view);
  const setView = useGatewayStore((s) => s.setView);
  const metrics = useGatewayStore((s) => s.metrics);

  return (
    <aside
      data-tour="sidebar"
      className="flex h-full w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar/60 backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 ring-1 ring-cyan-500/30">
          <Workflow className="h-5 w-5 text-cyan-300" strokeWidth={1.75} />
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 glow-emerald" />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold tracking-tight text-foreground">
            relay
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            control plane
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <div className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
          Monitor
        </div>
        {NAV_ITEMS.slice(0, 4).map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={view === item.id}
            onClick={() => setView(item.id)}
          />
        ))}
        <div className="px-2 pb-1 pt-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
          Inspect
        </div>
        {NAV_ITEMS.slice(4).map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={view === item.id}
            onClick={() => setView(item.id)}
          />
        ))}
      </nav>

      <div className="border-t border-border/60 p-3">
        <div className="rounded-md border border-border/60 bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Live RPS
            </span>
            <StatusDot tone="emerald" pulse size="sm" />
          </div>
          <div className="mt-1 font-mono text-lg tnum text-foreground">
            {metrics ? metrics.rps.toFixed(1) : "—"}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
            {metrics ? `${metrics.totalRequests.toLocaleString()} total` : "initializing"}
          </div>
        </div>
      </div>
    </aside>
  );
}

interface NavButtonProps {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}

function NavButton({ item, active, onClick }: NavButtonProps) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      data-tour={item.tour}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
        active
          ? "bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-500/30"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-cyan-300" : "text-muted-foreground/70 group-hover:text-foreground",
        )}
        strokeWidth={1.75}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-tight">{item.label}</div>
        <div
          className={cn(
            "truncate text-[11px] leading-tight",
            active ? "text-cyan-200/60" : "text-muted-foreground/60",
          )}
        >
          {item.description}
        </div>
      </div>
    </button>
  );
}
