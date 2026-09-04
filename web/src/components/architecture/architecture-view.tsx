"use client";

import {
  ArrowDown,
  ArrowRight,
  Workflow,
  Code2,
  Shield,
  Gauge,
  Network,
  Server,
  RotateCcw,
} from "lucide-react";
import { Panel, MetricLabel } from "@/components/common/panel";
import { StatusDot } from "@/components/common/status-dot";
import { useGatewayStore } from "@/lib/gateway/store";
import { MIDDLEWARE_CHAIN } from "@/lib/gateway/types";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { InfoDot } from "@/components/common/concept-explainer";

const STAGE_ICONS: Record<string, LucideIcon> = {
  logging: Code2,
  tracing: Workflow,
  auth: Shield,
  ratelimit: Gauge,
  loadbalancer: Network,
  circuitbreaker: RotateCcw,
};

export function ArchitectureView() {
  const cb = useGatewayStore((s) => s.circuitBreaker);

  return (
    <div className="space-y-4 p-6">
      {}
      <Panel
        title="Middleware chain"
        description="Order matches the handler wrapping in cmd/relay/main.go — outer to inner"
      >
        <div className="space-y-1 font-mono text-[11px] leading-relaxed text-muted-foreground/80">
          <p>
            The relay service wraps a base proxy handler in a chain of middlewares
            using functional composition. Each middleware can short-circuit the
            request (e.g. auth returns 401, rate limit returns 429) or pass it
            down to the next layer.
          </p>
          <p className="text-muted-foreground/60">
            <span className="text-cyan-300">chain :=</span> logging(tracing(auth(ratelimit(handler))))
          </p>
        </div>
      </Panel>

      {}
      <Panel
        title="Request flow"
        description="Left column: inbound request. Right column: outbound response."
        bodyClassName="p-0"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr]">
          {}
          <div className="space-y-2 p-6">
            <FlowHeader label="Inbound request" sub="client → gateway" tone="cyan" />

            {}
            <FlowNode
              icon={Server}
              title="Client"
              subtitle="HTTP request"
              meta={`Authorization: Bearer <jwt>`}
              tone="cyan"
            />

            <Connector />

            {}
            {MIDDLEWARE_CHAIN.map((stage, idx) => {
              const Icon = STAGE_ICONS[stage.id] ?? Code2;
              const isCB = stage.id === "circuitbreaker";
              const cbTone =
                cb.state === "closed" ? "emerald" : cb.state === "half-open" ? "amber" : "rose";
              return (
                <div key={stage.id}>
                  <FlowNode
                    icon={Icon}
                    title={stage.name}
                    subtitle={stage.package}
                    meta={`+${stage.overheadMs.toFixed(2)}ms overhead`}
                    tone={isCB ? cbTone : "emerald"}
                    badge={isCB ? cb.state : undefined}
                  />
                  {idx < MIDDLEWARE_CHAIN.length - 1 && <Connector />}
                </div>
              );
            })}

            <Connector />

            {}
            <FlowNode
              icon={Server}
              title="Upstream backend"
              subtitle="http://localhost:8081 / 8082 / 8083"
              meta="round-robin selection"
              tone="cyan"
            />
          </div>

          {}
          <div className="hidden items-center justify-center border-x border-border/60 bg-muted/20 p-4 lg:flex">
            <div className="flex flex-col items-center gap-2">
              <ArrowRight className="h-6 w-6 text-cyan-300" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                round trip
              </span>
              <ArrowDown className="h-6 w-6 rotate-180 text-emerald-300" />
            </div>
          </div>

          {}
          <div className="space-y-2 p-6">
            <FlowHeader label="Outbound response" sub="backend → client" tone="emerald" />

            <FlowNode
              icon={Server}
              title="Upstream backend"
              subtitle="response body + headers"
              meta="status: 200 / 4xx / 5xx"
              tone="emerald"
              mirror
            />

            <Connector mirror />

            {}
            {[...MIDDLEWARE_CHAIN].reverse().map((stage, idx) => {
              const Icon = STAGE_ICONS[stage.id] ?? Code2;
              return (
                <div key={stage.id}>
                  <FlowNode
                    icon={Icon}
                    title={stage.name}
                    subtitle="response passthrough"
                    meta={stage.id === "logging" ? "logs duration" : "no-op"}
                    tone="slate"
                    mirror
                  />
                  {idx < MIDDLEWARE_CHAIN.length - 1 && <Connector mirror />}
                </div>
              );
            })}

            <Connector mirror />

            <FlowNode
              icon={Server}
              title="Client"
              subtitle="HTTP response"
              meta="timed: total round trip"
              tone="emerald"
              mirror
            />
          </div>
        </div>
      </Panel>

      {}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {MIDDLEWARE_CHAIN.map((stage) => {
          const Icon = STAGE_ICONS[stage.id] ?? Code2;
          
          const conceptMap: Record<string, "circuit-breaker" | "rate-limiting" | "jwt-auth" | "load-balancing" | "tracing" | "middleware-chain"> = {
            circuitbreaker: "circuit-breaker",
            ratelimit: "rate-limiting",
            auth: "jwt-auth",
            loadbalancer: "load-balancing",
            tracing: "tracing",
            logging: "middleware-chain",
          };
          const conceptId = conceptMap[stage.id];
          return (
            <Panel key={stage.id} bodyClassName="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-cyan-500/10 p-2 text-cyan-300">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {stage.name}
                    </span>
                    {conceptId && <InfoDot concept={conceptId} />}
                    <StatusDot tone="emerald" size="sm" />
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/60">
                    {stage.package}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
                    {stage.description}
                  </p>
                  <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-2 font-mono text-[10px] text-muted-foreground/60">
                    <span>overhead</span>
                    <span className="tnum text-foreground">
                      +{stage.overheadMs.toFixed(2)}ms
                    </span>
                  </div>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function FlowHeader({
  label,
  sub,
  tone,
}: {
  label: string;
  sub: string;
  tone: "cyan" | "emerald";
}) {
  return (
    <div
      className={cn(
        "mb-2 rounded-md border px-3 py-1.5 text-center font-mono text-[10px] uppercase tracking-wider",
        tone === "cyan"
          ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-300"
          : "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
      )}
    >
      {label}
      <span className="ml-2 normal-case text-muted-foreground/60">— {sub}</span>
    </div>
  );
}

function FlowNode({
  icon: Icon,
  title,
  subtitle,
  meta,
  tone,
  badge,
  mirror,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  meta: string;
  tone: "cyan" | "emerald" | "amber" | "rose" | "slate";
  badge?: string;
  mirror?: boolean;
}) {
  const toneBorder = {
    cyan: "border-cyan-500/30 bg-cyan-500/5",
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    rose: "border-rose-500/30 bg-rose-500/5",
    slate: "border-border/60 bg-muted/30",
  }[tone];

  const toneIcon = {
    cyan: "text-cyan-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
    slate: "text-muted-foreground",
  }[tone];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2",
        toneBorder,
        mirror && "flex-row-reverse text-right",
      )}
    >
      <div className={cn("rounded bg-background/40 p-1.5", toneIcon)}>
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-foreground">{title}</span>
          {badge && (
            <span className="rounded bg-background/40 px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider text-foreground/70">
              {badge}
            </span>
          )}
        </div>
        <div className="truncate font-mono text-[10px] text-muted-foreground/60">
          {subtitle}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/50">{meta}</div>
      </div>
    </div>
  );
}

function Connector({ mirror }: { mirror?: boolean }) {
  return (
    <div className={cn("flex", mirror ? "justify-end pr-6" : "justify-center pl-6")}>
      <div className="h-4 w-px bg-border/60" />
    </div>
  );
}
