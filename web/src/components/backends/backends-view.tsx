"use client";

import {
  Server,
  Power,
  Zap,
  Activity,
  AlertTriangle,
  Network,
} from "lucide-react";
import { useGatewayStore } from "@/lib/gateway/store";
import { Panel, MetricLabel, MetricValue } from "@/components/common/panel";
import { StatusBadge, StatusDot } from "@/components/common/status-dot";
import { Sparkline } from "@/components/common/sparkline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatMs,
  formatNumber,
  formatPercent,
} from "@/lib/gateway/format";

export function BackendsView() {
  const backends = useGatewayStore((s) => s.backends);
  const metrics = useGatewayStore((s) => s.metrics);
  const toggleBackend = useGatewayStore((s) => s.toggleBackend);

  const aliveCount = backends.filter((b) => b.alive).length;
  const totalHandled = backends.reduce((s, b) => s + b.requestsHandled, 0);
  const avgLatency =
    backends.length > 0
      ? backends.reduce((s, b) => s + b.avgLatencyMs, 0) / backends.length
      : 0;
  const totalErrors = backends.reduce((s, b) => s + b.errorRate * b.requestsHandled, 0);
  const poolErrorRate = totalHandled > 0 ? totalErrors / totalHandled : 0;

  return (
    <div className="space-y-4 p-6">
      {}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PoolStat
          label="Размер пула"
          value={`${backends.length}`}
          sub={`${aliveCount} живых`}
          icon={Server}
          tone="cyan"
        />
        <PoolStat
          label="Всего обработано"
          value={formatNumber(totalHandled)}
          sub="с момента запуска gateway"
          icon={Activity}
          tone="emerald"
        />
        <PoolStat
          label="Средняя латентность"
          value={formatMs(avgLatency)}
          sub="по всем бэкендам"
          icon={Zap}
          tone="amber"
        />
        <PoolStat
          label="Error rate пула"
          value={formatPercent(poolErrorRate, 2)}
          sub={metrics ? `${metrics.rateLimited} rate-limited` : undefined}
          icon={AlertTriangle}
          tone={poolErrorRate > 0.05 ? "rose" : "emerald"}
        />
      </div>

      {}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {backends.map((b) => (
          <Panel
            key={b.id}
            title={b.id}
            description={b.url}
            actions={
              <StatusBadge
                tone={
                  b.health === "healthy"
                    ? "emerald"
                    : b.health === "degraded"
                      ? "amber"
                      : "rose"
                }
                label={b.alive ? b.health : "отключён"}
                pulse={b.alive}
              />
            }
          >
            <div className="space-y-4">
              {}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <MetricLabel>Доля трафика</MetricLabel>
                  <span className="font-mono text-xs tnum text-foreground">{b.trafficShare}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      b.alive ? "bg-cyan-400" : "bg-muted-foreground/30",
                    )}
                    style={{ width: `${b.trafficShare}%` }}
                  />
                </div>
              </div>

              {}
              <div className="grid grid-cols-3 gap-2">
                <Stat label="латентность" value={formatMs(b.avgLatencyMs)} />
                <Stat label="обработано" value={formatNumber(b.requestsHandled)} />
                <Stat label="ошибки" value={formatPercent(b.errorRate, 2)} />
              </div>

              {}
              <div className="flex items-center gap-2 border-t border-border/60 pt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                <span className="rounded bg-muted/40 px-1.5 py-0.5">{b.protocol}</span>
                <span>вес {b.weight}</span>
                <span className="ml-auto flex items-center gap-1">
                  <Network className="h-3 w-3" />
                  {b.alive ? "доступен" : "дрейнован"}
                </span>
              </div>

              {}
              <Button
                variant={b.alive ? "outline" : "default"}
                size="sm"
                onClick={() => toggleBackend(b.id)}
                className={cn(
                  "w-full gap-2 font-mono text-xs",
                  b.alive
                    ? "border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                    : "bg-emerald-500/90 text-slate-950 hover:bg-emerald-400",
                )}
              >
                <Power className="h-3 w-3" />
                {b.alive ? "Drain (пометить как down)" : "Включить (пометить как up)"}
              </Button>
            </div>
          </Panel>
        ))}

        {backends.length === 0 && (
          <Panel className="lg:col-span-2 xl:col-span-3">
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground/50">
              <Server className="h-6 w-6" />
              <p className="font-mono text-xs">Бэкенды не зарегистрированы</p>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

interface PoolStatProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone: "cyan" | "emerald" | "amber" | "rose";
}

function PoolStat({ label, value, sub, icon: Icon, tone }: PoolStatProps) {
  const toneClass = {
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
  }[tone];

  return (
    <Panel bodyClassName="p-4">
      <div className="flex items-start justify-between">
        <div>
          <MetricLabel>{label}</MetricLabel>
          <MetricValue className="mt-1 text-xl">{value}</MetricValue>
          {sub && (
            <div className="mt-1 font-mono text-[10px] text-muted-foreground/70">{sub}</div>
          )}
        </div>
        <div className={cn("rounded-md bg-muted/40 p-1.5", toneClass)}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-muted/20 px-2 py-1.5">
      <MetricLabel>{label}</MetricLabel>
      <div className="mt-0.5 font-mono text-xs tnum text-foreground">{value}</div>
    </div>
  );
}
