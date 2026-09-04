"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Timer,
  AlertTriangle,
  Ban,
  Gauge,
} from "lucide-react";
import { useGatewayStore } from "@/lib/gateway/store";
import { Panel, MetricLabel, MetricValue } from "@/components/common/panel";
import { Sparkline } from "@/components/common/sparkline";
import {
  formatMs,
  formatNumber,
  formatPercent,
  formatRps,
  formatTime,
} from "@/lib/gateway/format";

export function MetricsView() {
  const metrics = useGatewayStore((s) => s.metrics);
  const history = useGatewayStore((s) => s.metricsHistory);
  const prometheus = useGatewayStore((s) => s.prometheus);

  return (
    <div className="space-y-4 p-6">
      {}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <MetricKpi
          label="RPS"
          value={metrics ? formatRps(metrics.rps) : "—"}
          icon={Activity}
          color="oklch(0.78 0.15 195)"
          sparkData={history.map((h) => h.rps)}
        />
        <MetricKpi
          label="p50"
          value={metrics ? formatMs(metrics.p50) : "—"}
          icon={Timer}
          color="oklch(0.78 0.18 162)"
          sparkData={history.map((h) => h.p50)}
        />
        <MetricKpi
          label="p95"
          value={metrics ? formatMs(metrics.p95) : "—"}
          icon={Timer}
          color="oklch(0.80 0.16 80)"
          sparkData={history.map((h) => h.p95)}
        />
        <MetricKpi
          label="p99"
          value={metrics ? formatMs(metrics.p99) : "—"}
          icon={Gauge}
          color="oklch(0.70 0.22 305)"
          sparkData={history.map((h) => h.p99)}
        />
        <MetricKpi
          label="errors"
          value={metrics ? formatPercent(metrics.errorRate, 2) : "—"}
          icon={AlertTriangle}
          color="oklch(0.68 0.24 16)"
          sparkData={history.map((h) => h.errorRate * 100)}
        />
        <MetricKpi
          label="429s"
          value={metrics ? String(metrics.rateLimited) : "—"}
          icon={Ban}
          color="oklch(0.75 0.18 30)"
          sparkData={history.map((h) => h.rateLimited)}
        />
      </div>

      {}
      <Panel
        title="Latency trend"
        description="p50 / p95 / p99 over the last 90s"
        actions={
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> p50
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> p95
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-400" /> p99
            </span>
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="h-72 w-full bg-grid">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={history.map((h) => ({
                ts: h.ts,
                p50: Number(h.p50.toFixed(2)),
                p95: Number(h.p95.toFixed(2)),
                p99: Number(h.p99.toFixed(2)),
              }))}
              margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="oklch(1 0 0 / 0.04)" vertical={false} />
              <XAxis
                dataKey="ts"
                tickFormatter={(v) => formatTime(v)}
                stroke="oklch(0.66 0.012 240)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                minTickGap={48}
                fontFamily="monospace"
              />
              <YAxis
                stroke="oklch(0.66 0.012 240)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={40}
                fontFamily="monospace"
                tickFormatter={(v) => `${v}ms`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return (
                    <div className="rounded-md border border-border/60 bg-popover/95 px-3 py-2 shadow-lg backdrop-blur-sm">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {formatTime(label)}
                      </div>
                      <div className="mt-1 space-y-0.5 font-mono text-xs">
                        {payload.map((p) => (
                          <div key={p.dataKey} className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{
                                background:
                                  p.dataKey === "p50"
                                    ? "oklch(0.78 0.18 162)"
                                    : p.dataKey === "p95"
                                      ? "oklch(0.80 0.16 80)"
                                      : "oklch(0.70 0.22 305)",
                              }}
                            />
                            <span className="text-muted-foreground">{p.dataKey}</span>
                            <span className="ml-auto tnum text-foreground">
                              {formatMs(p.value as number)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="p99"
                stroke="oklch(0.70 0.22 305)"
                strokeWidth={1.5}
                fill="oklch(0.70 0.22 305)"
                fillOpacity={0.05}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="p95"
                stroke="oklch(0.80 0.16 80)"
                strokeWidth={1.5}
                fill="oklch(0.80 0.16 80)"
                fillOpacity={0.05}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="p50"
                stroke="oklch(0.78 0.18 162)"
                strokeWidth={1.5}
                fill="oklch(0.78 0.18 162)"
                fillOpacity={0.08}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Latency histogram"
          description="Bucketed distribution — last 60 requests"
          bodyClassName="p-0"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics?.latencyBuckets ?? []}
                margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="oklch(1 0 0 / 0.04)" vertical={false} />
                <XAxis
                  dataKey="le"
                  stroke="oklch(0.66 0.012 240)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}ms`}
                  fontFamily="monospace"
                />
                <YAxis
                  stroke="oklch(0.66 0.012 240)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  fontFamily="monospace"
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    return (
                      <div className="rounded-md border border-border/60 bg-popover/95 px-3 py-2 font-mono text-xs shadow-lg backdrop-blur-sm">
                        <span className="text-muted-foreground">≤ {label}ms</span>
                        <span className="ml-2 tnum text-foreground">
                          {payload[0].value} reqs
                        </span>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" fill="oklch(0.78 0.15 195)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Status code distribution"
          description="HTTP response codes — last 60 requests"
          bodyClassName="p-0"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={statusData(metrics?.statusCodes ?? {})}
                margin={{ top: 16, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid stroke="oklch(1 0 0 / 0.04)" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="oklch(0.66 0.012 240)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  fontFamily="monospace"
                />
                <YAxis
                  type="category"
                  dataKey="status"
                  stroke="oklch(0.66 0.012 240)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  fontFamily="monospace"
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    return (
                      <div className="rounded-md border border-border/60 bg-popover/95 px-3 py-2 font-mono text-xs shadow-lg backdrop-blur-sm">
                        <span className="text-muted-foreground">HTTP {label}</span>
                        <span className="ml-2 tnum text-foreground">
                          {payload[0].value} reqs
                        </span>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" radius={[0, 2, 2, 0]}>
                  {statusData(metrics?.statusCodes ?? {}).map((d) => (
                    <Cell key={d.status} fill={statusBarColor(d.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Total requests" description="Since gateway start">
          <div className="flex items-end gap-2">
            <MetricValue className="text-3xl">
              {metrics ? formatNumber(metrics.totalRequests) : "—"}
            </MetricValue>
            <span className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
              reqs
            </span>
          </div>
          <div className="mt-3">
            <Sparkline
              data={history.map((h) => h.totalRequests)}
              color="oklch(0.78 0.18 162)"
              width={280}
              height={36}
            />
          </div>
        </Panel>

        <Panel
          title="Prometheus"
          description="Live scrape from /metrics"
          bodyClassName="p-0"
          className="lg:col-span-2"
        >
          {prometheus ? (
            <pre className="max-h-64 overflow-auto p-4 font-mono text-[10px] leading-relaxed text-foreground/80">
              {prometheus.raw.slice(0, 4000)}
              {prometheus.raw.length > 4000 && "\n... (truncated)"}
            </pre>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground/50">
              <Activity className="h-5 w-5" />
              <p className="font-mono text-xs">
                No live metrics — switch to <span className="text-cyan-300">live</span> mode
              </p>
              <p className="font-mono text-[10px] text-muted-foreground/40">
                Run the relay on {useGatewayStore.getState().config.baseUrl} and enable Prometheus
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

interface MetricKpiProps {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  sparkData: number[];
}

function MetricKpi({ label, value, icon: Icon, color, sparkData }: MetricKpiProps) {
  return (
    <Panel bodyClassName="p-3">
      <div className="flex items-center justify-between">
        <MetricLabel>{label}</MetricLabel>
        <Icon className="h-3 w-3" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="mt-1 font-mono text-lg font-medium tnum text-foreground">
        {value}
      </div>
      {sparkData.length > 1 && (
        <div className="mt-2">
          <Sparkline data={sparkData} color={color} width={180} height={20} dot={false} />
        </div>
      )}
    </Panel>
  );
}

function statusData(codes: Record<number, number>) {
  return Object.entries(codes)
    .map(([status, count]) => ({ status: Number(status), count }))
    .sort((a, b) => a.status - b.status);
}

function statusBarColor(status: number): string {
  if (status < 300) return "oklch(0.78 0.18 162)";
  if (status < 400) return "oklch(0.78 0.15 195)";
  if (status < 500) return "oklch(0.80 0.16 80)";
  return "oklch(0.68 0.24 16)";
}
