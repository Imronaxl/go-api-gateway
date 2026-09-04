"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricSnapshot } from "@/lib/gateway/types";
import { formatTime } from "@/lib/gateway/format";

interface TrafficChartProps {
  history: MetricSnapshot[];
}

export function TrafficChart({ history }: TrafficChartProps) {
  const data = history.map((h) => ({
    ts: h.ts,
    rps: Number(h.rps.toFixed(2)),
    errors: Number((h.errorRate * 100).toFixed(2)),
    rateLimited: h.rateLimited,
  }));

  return (
    <div className="h-72 w-full bg-grid">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rpsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.78 0.15 195)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="oklch(0.78 0.15 195)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.68 0.24 16)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="oklch(0.68 0.24 16)" stopOpacity={0} />
            </linearGradient>
          </defs>
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
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              const rps = payload.find((p) => p.dataKey === "rps")?.value as number;
              const errors = payload.find((p) => p.dataKey === "errors")?.value as number;
              const rl = payload.find((p) => p.dataKey === "rateLimited")?.value as number;
              return (
                <div className="rounded-md border border-border/60 bg-popover/95 px-3 py-2 shadow-lg backdrop-blur-sm">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {formatTime(label)}
                  </div>
                  <div className="mt-1 space-y-0.5 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      <span className="text-muted-foreground">rps</span>
                      <span className="ml-auto tnum text-foreground">{rps?.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-400" />
                      <span className="text-muted-foreground">errors</span>
                      <span className="ml-auto tnum text-foreground">{errors?.toFixed(2)}%</span>
                    </div>
                    {rl !== undefined && rl > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        <span className="text-muted-foreground">rate-limited</span>
                        <span className="ml-auto tnum text-foreground">{rl}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="rps"
            stroke="oklch(0.78 0.15 195)"
            strokeWidth={1.5}
            fill="url(#rpsGrad)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="errors"
            stroke="oklch(0.68 0.24 16)"
            strokeWidth={1.5}
            fill="url(#errGrad)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
