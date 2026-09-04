"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  Settings2,
  Zap,
  CircleDot,
  ChevronDown,
} from "lucide-react";
import { useGatewayStore } from "@/lib/gateway/store";
import { StatusBadge } from "@/components/common/status-dot";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GatewayMode } from "@/lib/gateway/types";

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  overview: {
    title: "Overview",
    subtitle: "Real-time view of gateway traffic, latency, and breaker state",
  },
  playground: {
    title: "Playground",
    subtitle: "Send requests through the relay and inspect the response",
  },
  metrics: {
    title: "Metrics",
    subtitle: "Prometheus-style charts scraped from the relay metrics endpoint",
  },
  backends: {
    title: "Backends",
    subtitle: "Upstream pool registered with the round-robin load balancer",
  },
  logs: {
    title: "Logs",
    subtitle: "Structured slog output streamed from the relay process",
  },
  architecture: {
    title: "Architecture",
    subtitle: "Middleware chain — order matches cmd/relay/main.go",
  },
};

export function Topbar() {
  const view = useGatewayStore((s) => s.view);
  const connection = useGatewayStore((s) => s.connection);
  const effectiveMode = useGatewayStore((s) => s.effectiveMode);
  const probeLatencyMs = useGatewayStore((s) => s.probeLatencyMs);
  const probe = useGatewayStore((s) => s.probe);

  useEffect(() => {
    probe();
    const id = setInterval(probe, 30_000);
    return () => clearInterval(id);
  }, [probe]);

  const info = VIEW_TITLES[view] ?? VIEW_TITLES.overview;

  const connTone =
    connection === "connected"
      ? "emerald"
      : connection === "degraded"
        ? "amber"
        : "rose";

  const connLabel =
    connection === "connected"
      ? "Live"
      : connection === "degraded"
        ? "Degraded"
        : "Simulated";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-6 backdrop-blur-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-mono text-base font-semibold tracking-tight text-foreground">
            {info.title}
          </h1>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-mono text-xs text-muted-foreground">
            relay v0.1.0
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
          {info.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-1.5">
          <CircleDot
            className={cn(
              "h-3.5 w-3.5",
              connTone === "emerald" && "text-emerald-400",
              connTone === "amber" && "text-amber-400",
              connTone === "rose" && "text-rose-400",
            )}
          />
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Source
            </span>
            <span className="font-mono text-xs text-foreground">
              {effectiveMode === "live" ? "Live relay" : "Simulated"}
            </span>
          </div>
          {probeLatencyMs !== null && connection === "connected" && (
            <div className="ml-2 flex flex-col border-l border-border/60 pl-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Probe
              </span>
              <span className="font-mono text-xs tnum text-foreground">
                {probeLatencyMs.toFixed(0)}ms
              </span>
            </div>
          )}
        </div>

        <StatusBadge tone={connTone} label={connLabel} pulse={connection === "connected"} />

        <ModeMenu />

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-border/60"
          onClick={() => probe()}
          aria-label="Re-probe gateway"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>

        <ConfigDialog />
      </div>
    </header>
  );
}

function ModeMenu() {
  const mode = useGatewayStore((s) => s.config.mode);
  const setMode = useGatewayStore((s) => s.setMode);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 border-border/60 bg-muted/40 font-mono text-xs"
        >
          <Zap className="h-3.5 w-3.5 text-cyan-300" />
          {mode}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Data source
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(["auto", "live", "simulated"] as GatewayMode[]).map((m) => (
          <DropdownMenuItem
            key={m}
            onClick={() => setMode(m)}
            className="gap-2 font-mono text-xs"
          >
            <Zap
              className={cn(
                "h-3.5 w-3.5",
                mode === m ? "text-cyan-300" : "text-muted-foreground",
              )}
            />
            <span className="flex-1">{m}</span>
            {mode === m && <span className="text-cyan-300">●</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ConfigDialog() {
  const config = useGatewayStore((s) => s.config);
  const updateConfig = useGatewayStore((s) => s.updateConfig);
  const resetSim = useGatewayStore((s) => s.resetSim);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-border/60"
          aria-label="Gateway settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg gap-4 border-border/60 bg-card/95">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">Gateway configuration</DialogTitle>
          <DialogDescription className="text-xs">
            Connection parameters for the relay service. Changes apply immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cfg-base" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Relay base URL
            </Label>
            <Input
              id="cfg-base"
              value={config.baseUrl}
              onChange={(e) => updateConfig({ baseUrl: e.target.value })}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cfg-metrics" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Prometheus endpoint
            </Label>
            <Input
              id="cfg-metrics"
              value={config.metricsUrl}
              onChange={(e) => updateConfig({ metricsUrl: e.target.value })}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cfg-jwt" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              JWT bearer token
            </Label>
            <textarea
              id="cfg-jwt"
              value={config.jwtToken}
              onChange={(e) => updateConfig({ jwtToken: e.target.value })}
              className="flex max-h-24 min-h-12 w-full resize-y rounded-md border border-input bg-background/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Data source
              </Label>
              <Select
                value={config.mode}
                onValueChange={(v: GatewayMode) => updateConfig({ mode: v })}
              >
                <SelectTrigger className="h-9 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="font-mono text-xs">auto</SelectItem>
                  <SelectItem value="live" className="font-mono text-xs">live</SelectItem>
                  <SelectItem value="simulated" className="font-mono text-xs">simulated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                CB max failures
              </Label>
              <Input
                type="number"
                value={config.circuitBreaker.maxFailures}
                onChange={(e) =>
                  updateConfig({
                    circuitBreaker: {
                      ...config.circuitBreaker,
                      maxFailures: Number(e.target.value),
                    },
                  })
                }
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Rate limit (rps)
              </Label>
              <Input
                type="number"
                value={config.rateLimit.rate}
                onChange={(e) =>
                  updateConfig({
                    rateLimit: {
                      ...config.rateLimit,
                      rate: Number(e.target.value),
                    },
                  })
                }
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Burst
              </Label>
              <Input
                type="number"
                value={config.rateLimit.burst}
                onChange={(e) =>
                  updateConfig({
                    rateLimit: {
                      ...config.rateLimit,
                      burst: Number(e.target.value),
                    },
                  })
                }
                className="font-mono text-xs"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetSim();
              setOpen(false);
            }}
            className="font-mono text-xs"
          >
            Reset simulation
          </Button>
          <Button size="sm" onClick={() => setOpen(false)} className="font-mono text-xs">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
