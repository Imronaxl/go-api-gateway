"use client";

import { useGatewayStore } from "@/lib/gateway/store";
import { Panel, MetricLabel, MetricValue } from "@/components/common/panel";
import { Sparkline } from "@/components/common/sparkline";
import { StatusBadge, StatusDot } from "@/components/common/status-dot";
import {
  Activity,
  ArrowRight,
  Gauge,
  Timer,
  AlertTriangle,
  Server,
  CircuitBoard,
  Zap,
  Flame,
  RotateCcw,
  Power,
} from "lucide-react";
import {
  formatMs,
  formatNumber,
  formatPercent,
  formatRps,
  formatTime,
  statusColor,
} from "@/lib/gateway/format";
import { cn } from "@/lib/utils";
import { MIDDLEWARE_CHAIN } from "@/lib/gateway/types";
import { TrafficChart } from "./traffic-chart";
import { Button } from "@/components/ui/button";
import { InfoDot } from "@/components/common/concept-explainer";

export function OverviewView() {
  const metrics = useGatewayStore((s) => s.metrics);
  const history = useGatewayStore((s) => s.metricsHistory);
  const cb = useGatewayStore((s) => s.circuitBreaker);
  const backends = useGatewayStore((s) => s.backends);
  const recent = useGatewayStore((s) => s.recent);
  const effectiveMode = useGatewayStore((s) => s.effectiveMode);
  const injectFailures = useGatewayStore((s) => s.injectFailures);
  const forceCb = useGatewayStore((s) => s.forceCb);
  const resetSim = useGatewayStore((s) => s.resetSim);

  return (
    <div className="space-y-4 p-6">
      {}
      {effectiveMode === "simulated" && (
        <Panel
          title="Управление симуляцией"
          description="Триггерить события gateway для исследования дашборда"
          bodyClassName="p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
              Действия
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => injectFailures(6)}
              className="h-7 gap-1.5 border-rose-500/40 font-mono text-[11px] text-rose-300 hover:bg-rose-500/10"
            >
              <Flame className="h-3 w-3" />
              Инжектить всплеск ошибок
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => forceCb("open")}
              className="h-7 gap-1.5 border-amber-500/40 font-mono text-[11px] text-amber-300 hover:bg-amber-500/10"
            >
              <CircuitBoard className="h-3 w-3" />
              Открыть breaker
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => forceCb("half-open")}
              className="h-7 gap-1.5 border-amber-500/40 font-mono text-[11px] text-amber-300 hover:bg-amber-500/10"
            >
              <CircuitBoard className="h-3 w-3" />
              Перевести в half-open
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => forceCb("closed")}
              className="h-7 gap-1.5 border-emerald-500/40 font-mono text-[11px] text-emerald-300 hover:bg-emerald-500/10"
            >
              <Power className="h-3 w-3" />
              Закрыть breaker
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetSim}
              className="h-7 gap-1.5 border-border/60 font-mono text-[11px] text-muted-foreground hover:bg-muted/50"
            >
              <RotateCcw className="h-3 w-3" />
              Сбросить
            </Button>
          </div>
        </Panel>
      )}

      {}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Запросов / сек"
          value={metrics ? formatRps(metrics.rps) : "—"}
          icon={Activity}
          tone="cyan"
          sparkData={history.map((h) => h.rps)}
          sparkColor="oklch(0.78 0.15 195)"
        />
        <KpiCard
          label="p99 латентность"
          value={metrics ? formatMs(metrics.p99) : "—"}
          icon={Timer}
          tone="emerald"
          sparkData={history.map((h) => h.p99)}
          sparkColor="oklch(0.78 0.18 162)"
          sub={metrics ? `p50 ${formatMs(metrics.p50)} · p95 ${formatMs(metrics.p95)}` : undefined}
        />
        <KpiCard
          label="Доля ошибок"
          value={metrics ? formatPercent(metrics.errorRate, 2) : "—"}
          icon={AlertTriangle}
          tone={metrics && metrics.errorRate > 0.05 ? "rose" : "amber"}
          sparkData={history.map((h) => h.errorRate * 100)}
          sparkColor="oklch(0.68 0.24 16)"
          sub={metrics ? `${metrics.rateLimited} rate-limited` : undefined}
        />
        <KpiCard
          label="Circuit breaker"
          value={cb.state}
          icon={CircuitBoard}
          tone={
            cb.state === "closed" ? "emerald" : cb.state === "half-open" ? "amber" : "rose"
          }
          sub={`${cb.failures}/${cb.config.maxFailures} сбоев`}
        />
      </div>

      {}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="Трафик"
            description="Запросов в секунду за последние 90 секунд"
            actions={
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  rps
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  ошибки
                </span>
              </div>
            }
            bodyClassName="p-0"
          >
            <TrafficChart history={history} />
          </Panel>
        </div>

        <Panel
          title={
            <span className="inline-flex items-center gap-1.5">
              Circuit breaker
              <InfoDot concept="circuit-breaker" />
            </span>
          }
          description="internal/middleware/circuitbreaker"
          actions={
            <StatusBadge
              tone={
                cb.state === "closed" ? "emerald" : cb.state === "half-open" ? "amber" : "rose"
              }
              label={cb.state}
              pulse={cb.state !== "closed"}
            />
          }
        >
          <CircuitBreakerDetail cb={cb} />
        </Panel>
      </div>

      {}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title={
            <span className="inline-flex items-center gap-1.5">
              Цепочка middleware
              <InfoDot concept="middleware-chain" />
            </span>
          }
          description="Порядок совпадает с cmd/relay/main.go"
          actions={
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
              {MIDDLEWARE_CHAIN.length} stages
            </span>
          }
        >
          <div className="space-y-1">
            {MIDDLEWARE_CHAIN.map((stage, idx) => (
              <div
                key={stage.id}
                className="group flex items-center gap-3 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border/60 hover:bg-muted/40"
              >
                <span className="font-mono text-[10px] tnum text-muted-foreground/50">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <StatusDot tone="emerald" size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {stage.name}
                    </span>
                    <span className="truncate font-mono text-[10px] text-muted-foreground/60">
                      {stage.package}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[10px] tnum text-muted-foreground/60">
                  +{stage.overheadMs.toFixed(2)}ms
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title={
            <span className="inline-flex items-center gap-1.5">
              Пул бэкендов
              <InfoDot concept="load-balancing" />
            </span>
          }
          description="Round-robin балансировщик нагрузки"
          actions={
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
              {backends.filter((b) => b.alive).length}/{backends.length} живых
            </span>
          }
        >
          <div className="space-y-2">
            {backends.length === 0 && (
              <div className="py-8 text-center font-mono text-xs text-muted-foreground/50">
                no backends registered
              </div>
            )}
            {backends.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
              >
                <Server
                  className={cn(
                    "h-4 w-4 shrink-0",
                    b.alive ? "text-emerald-400" : "text-rose-400",
                  )}
                  strokeWidth={1.75}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs font-medium text-foreground">
                      {b.id}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      {b.protocol}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70">
                    {b.url}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      доля
                    </div>
                    <div className="font-mono text-xs tnum text-foreground">
                      {b.trafficShare}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      p50
                    </div>
                    <div className="font-mono text-xs tnum text-foreground">
                      {formatMs(b.avgLatencyMs)}
                    </div>
                  </div>
                  <StatusDot
                    tone={
                      b.health === "healthy"
                        ? "emerald"
                        : b.health === "degraded"
                          ? "amber"
                          : "rose"
                    }
                    size="md"
                    pulse={b.alive}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {}
      <Panel
        title="Недавние запросы"
        description="Последние 30 запросов, прошедших через gateway"
        actions={
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
            <Zap className="h-3 w-3 text-cyan-300" />
            live
          </span>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-border/60 bg-muted/30">
              <tr>
                <Th>время</Th>
                <Th>метод</Th>
                <Th>путь</Th>
                <Th>статус</Th>
                <Th>длительность</Th>
                <Th>бэкенд</Th>
                <Th>trace</Th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center font-mono text-xs text-muted-foreground/50">
                    трафика пока нет — ожидание первого запроса…
                  </td>
                </tr>
              )}
              {recent.slice(0, 30).map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                >
                  <Td>
                    <span className="font-mono text-[11px] tnum text-muted-foreground">
                      {formatTime(r.ts)}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[11px] font-medium text-cyan-300">
                      {r.method}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-foreground">{r.path}</span>
                  </Td>
                  <Td>
                    <span className={cn("font-mono text-xs tnum font-medium", statusColor(r.status))}>
                      {r.status}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[11px] tnum text-muted-foreground">
                      {formatMs(r.durationMs)}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {r.backendId}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      {r.traceId.slice(0, 8)}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: "cyan" | "emerald" | "amber" | "rose";
  sparkData?: number[];
  sparkColor?: string;
  sub?: string;
}

function KpiCard({ label, value, icon: Icon, tone, sparkData, sparkColor, sub }: KpiCardProps) {
  const toneText = {
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
  }[tone];

  return (
    <Panel bodyClassName="p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <MetricLabel>{label}</MetricLabel>
          <MetricValue>{value}</MetricValue>
          {sub && (
            <div className="font-mono text-[10px] text-muted-foreground/70">{sub}</div>
          )}
        </div>
        <div className={cn("rounded-md bg-muted/40 p-1.5", toneText)}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
      </div>
      {sparkData && sparkData.length > 1 && (
        <div className="mt-3 -mb-1">
          <Sparkline data={sparkData} color={sparkColor} width={240} height={28} />
        </div>
      )}
    </Panel>
  );
}

function CircuitBreakerDetail({
  cb,
}: {
  cb: { state: string; failures: number; successes: number; msSinceLastFailure: number; config: { maxFailures: number; timeoutMs: number; halfOpenLimit: number } };
}) {
  const tone =
    cb.state === "closed" ? "emerald" : cb.state === "half-open" ? "amber" : "rose";

  return (
    <div className="space-y-4">
      {}
      <div className="flex items-center justify-center gap-2 py-2">
        <StatePill label="closed" active={cb.state === "closed"} tone="emerald" />
        <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
        <StatePill label="open" active={cb.state === "open"} tone="rose" />
        <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
        <StatePill label="half-open" active={cb.state === "half-open"} tone="amber" />
      </div>

      {}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <MetricLabel>Сбои</MetricLabel>
          <span className="font-mono text-xs tnum text-foreground">
            {cb.failures} / {cb.config.maxFailures}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              tone === "emerald" ? "bg-emerald-400" : tone === "amber" ? "bg-amber-400" : "bg-rose-400",
            )}
            style={{
              width: `${Math.min(100, (cb.failures / cb.config.maxFailures) * 100)}%`,
            }}
          />
        </div>
      </div>

      {}
      <div className="grid grid-cols-3 gap-3 border-t border-border/60 pt-3">
        <ConfigItem label="таймаут" value={`${(cb.config.timeoutMs / 1000).toFixed(0)}с`} />
        <ConfigItem label="half-open" value={`${cb.config.halfOpenLimit}`} />
        <ConfigItem
          label="с момента сбоя"
          value={cb.msSinceLastFailure > 0 ? `${(cb.msSinceLastFailure / 1000).toFixed(1)}с` : "—"}
        />
      </div>
    </div>
  );
}

function StatePill({
  label,
  active,
  tone,
}: {
  label: string;
  active: boolean;
  tone: "emerald" | "amber" | "rose";
}) {
  const toneClass = {
    emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    amber: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    rose: "border-rose-400/40 bg-rose-400/10 text-rose-300",
  }[tone];

  return (
    <span
      className={cn(
        "rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
        active ? toneClass : "border-border/60 bg-muted/30 text-muted-foreground/50",
      )}
    >
      {label}
    </span>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <MetricLabel>{label}</MetricLabel>
      <div className="mt-0.5 font-mono text-sm tnum text-foreground">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2">{children}</td>;
}
