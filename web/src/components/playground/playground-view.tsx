"use client";

import { useState } from "react";
import {
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  Server,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useGatewayStore } from "@/lib/gateway/store";
import { Panel, MetricLabel } from "@/components/common/panel";
import { StatusBadge } from "@/components/common/status-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { HttpMethod, PlaygroundResponse } from "@/lib/gateway/types";
import { shortId, formatMs, statusColor } from "@/lib/gateway/format";

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const PRESETS: Array<{ label: string; method: HttpMethod; path: string; body?: string }> = [
  { label: "GET /health", method: "GET", path: "/health" },
  { label: "GET /echo", method: "GET", path: "/echo" },
  { label: "GET /api/users", method: "GET", path: "/api/users" },
  {
    label: "POST /api/orders",
    method: "POST",
    path: "/api/orders",
    body: JSON.stringify({ sku: "WIDGET-42", qty: 3 }, null, 2),
  },
  { label: "GET /api/products", method: "GET", path: "/api/products" },
];

export function PlaygroundView() {
  const config = useGatewayStore((s) => s.config);
  const lastResponse = useGatewayStore((s) => s.lastResponse);
  const sending = useGatewayStore((s) => s.sendingRequest);
  const sendRequest = useGatewayStore((s) => s.sendRequest);
  const responseHistory = useGatewayStore((s) => s.responseHistory);

  const [method, setMethod] = useState<HttpMethod>("GET");
  const [path, setPath] = useState("/echo");
  const [body, setBody] = useState("");
  const [headers, setHeaders] = useState<Record<string, string>>({
    "X-Request-Id": shortId("req_"),
  });
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderValue, setNewHeaderValue] = useState("");

  const handleSend = async () => {
    const req = {
      id: shortId("pg_"),
      ts: Date.now(),
      method,
      path: path.startsWith("/") ? path : `/${path}`,
      headers,
      body: ["GET", "HEAD"].includes(method) ? "" : body,
    };
    try {
      await sendRequest(req);
    } catch {
      
    }
  };

  const addHeader = () => {
    if (!newHeaderKey.trim()) return;
    setHeaders({ ...headers, [newHeaderKey.trim()]: newHeaderValue });
    setNewHeaderKey("");
    setNewHeaderValue("");
  };

  const removeHeader = (key: string) => {
    const next = { ...headers };
    delete next[key];
    setHeaders(next);
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setMethod(preset.method);
    setPath(preset.path);
    setBody(preset.body ?? "");
  };

  return (
    <div className="grid h-full grid-cols-1 gap-4 p-6 lg:grid-cols-2">
      {}
      <Panel
        title="Request"
        description="Sent through the relay with the configured JWT"
        actions={
          <StatusBadge
            tone={config.mode === "live" ? "cyan" : "slate"}
            label={config.mode}
          />
        }
        bodyClassName="space-y-4"
      >
        {}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/5 hover:text-cyan-300"
            >
              {p.label}
            </button>
          ))}
        </div>

        {}
        <div className="flex gap-2">
          <Select value={method} onValueChange={(v: HttpMethod) => setMethod(v)}>
            <SelectTrigger className="h-9 w-24 shrink-0 font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m} className="font-mono text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-1 items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
              {config.baseUrl}
            </span>
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="h-9 border-0 bg-transparent px-0 font-mono text-xs shadow-none focus-visible:ring-0"
              placeholder="/path"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
              }}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={sending}
            className="h-9 gap-2 bg-cyan-500/90 font-mono text-xs text-slate-950 hover:bg-cyan-400"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send
          </Button>
        </div>

        {}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <MetricLabel>Headers</MetricLabel>
            <span className="font-mono text-[10px] text-muted-foreground/50">
              Authorization auto-added
            </span>
          </div>
          <div className="space-y-1">
            {Object.entries(headers).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1"
              >
                <span className="font-mono text-[11px] text-cyan-300">{k}</span>
                <span className="font-mono text-[10px] text-muted-foreground/40">:</span>
                <span className="flex-1 truncate font-mono text-[11px] text-foreground/80">
                  {v}
                </span>
                <button
                  type="button"
                  onClick={() => removeHeader(k)}
                  className="font-mono text-[10px] text-muted-foreground/50 hover:text-rose-400"
                  aria-label={`Remove header ${k}`}
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={newHeaderKey}
                onChange={(e) => setNewHeaderKey(e.target.value)}
                placeholder="header name"
                className="h-8 font-mono text-[11px]"
              />
              <Input
                value={newHeaderValue}
                onChange={(e) => setNewHeaderValue(e.target.value)}
                placeholder="value"
                className="h-8 font-mono text-[11px]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addHeader}
                className="h-8 shrink-0 border-border/60 font-mono text-[11px]"
              >
                Add
              </Button>
            </div>
          </div>
        </div>

        {}
        {!["GET", "HEAD"].includes(method) && (
          <div className="space-y-2">
            <MetricLabel>Body</MetricLabel>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-32 resize-y font-mono text-[11px] leading-relaxed"
              placeholder='{"key": "value"}'
            />
          </div>
        )}

        {}
        {responseHistory.length > 0 && (
          <div className="space-y-1.5">
            <MetricLabel>History</MetricLabel>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {responseHistory.map((r, i) => (
                <HistoryRow key={r.requestId} response={r} index={i} />
              ))}
            </div>
          </div>
        )}
      </Panel>

      {}
      <Panel
        title="Response"
        description="Includes per-stage timing breakdown"
        bodyClassName="p-0"
        actions={
          lastResponse ? (
            <StatusBadge
              tone={lastResponse.status < 300 ? "emerald" : lastResponse.status < 500 ? "amber" : "rose"}
              label={`${lastResponse.status} ${lastResponse.statusText}`}
            />
          ) : undefined
        }
      >
        {!lastResponse ? (
          <div className="flex h-72 flex-col items-center justify-center gap-2 text-muted-foreground/50">
            <Send className="h-6 w-6" />
            <p className="font-mono text-xs">Send a request to see the response</p>
          </div>
        ) : (
          <ResponsePanel response={lastResponse} />
        )}
      </Panel>
    </div>
  );
}

function ResponsePanel({ response }: { response: PlaygroundResponse }) {
  const [showHeaders, setShowHeaders] = useState(true);
  const [showTiming, setShowTiming] = useState(true);
  const [showBody, setShowBody] = useState(true);

  const StatusIcon =
    response.status < 300
      ? CheckCircle2
      : response.status < 500
        ? AlertCircle
        : XCircle;

  const tone =
    response.status < 300 ? "emerald" : response.status < 500 ? "amber" : "rose";

  return (
    <div className="divide-y divide-border/60">
      {}
      <div className="flex items-center gap-3 px-5 py-4">
        <StatusIcon
          className={cn(
            "h-5 w-5",
            tone === "emerald" && "text-emerald-400",
            tone === "amber" && "text-amber-400",
            tone === "rose" && "text-rose-400",
          )}
        />
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn("font-mono text-lg font-semibold tnum", statusColor(response.status))}>
              {response.status}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {response.statusText}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 font-mono text-[10px] text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatMs(response.totalMs)}
            </span>
            <span className="flex items-center gap-1">
              <Server className="h-3 w-3" />
              {response.backendId ?? "—"}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 uppercase",
                response.servedBy === "live"
                  ? "bg-cyan-500/10 text-cyan-300"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {response.servedBy}
            </span>
          </div>
        </div>
      </div>

      {}
      <Section
        title="Timing breakdown"
        open={showTiming}
        onToggle={() => setShowTiming((v) => !v)}
      >
        <TimingWaterfall stages={response.stages} total={response.totalMs} />
      </Section>

      {}
      <Section
        title="Response headers"
        open={showHeaders}
        onToggle={() => setShowHeaders((v) => !v)}
      >
        <div className="space-y-1 px-5 py-3">
          {Object.entries(response.headers).map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2 font-mono text-[11px]">
              <span className="shrink-0 text-cyan-300">{k}:</span>
              <span className="truncate text-foreground/80">{v}</span>
            </div>
          ))}
        </div>
      </Section>

      {}
      <Section
        title="Body"
        open={showBody}
        onToggle={() => setShowBody((v) => !v)}
      >
        <pre className="max-h-96 overflow-auto px-5 py-3 font-mono text-[11px] leading-relaxed text-foreground/90">
          {response.body || "(empty body)"}
        </pre>
      </Section>
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-5 py-2 text-left transition-colors hover:bg-muted/30"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        )}
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {title}
        </span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function TimingWaterfall({
  stages,
  total,
}: {
  stages: Array<{ stage: string; ms: number }>;
  total: number;
}) {
  const colors: Record<string, string> = {
    logging: "bg-slate-500",
    tracing: "bg-violet-500",
    auth: "bg-amber-500",
    ratelimit: "bg-rose-500",
    loadbalancer: "bg-cyan-500",
    circuitbreaker: "bg-orange-500",
    backend: "bg-emerald-500",
  };

  
  
  const offsets = stages.reduce<{ acc: number; out: number[] }>(
    (state, s) => {
      const off = state.acc;
      return { acc: state.acc + s.ms, out: [...state.out, off] };
    },
    { acc: 0, out: [] },
  ).out;

  return (
    <div className="space-y-1 px-5 py-3">
      {stages.map((s, i) => {
        const widthPct = total > 0 ? (s.ms / total) * 100 : 0;
        const offsetPct = total > 0 ? (offsets[i] / total) * 100 : 0;
        return (
          <div key={s.stage} className="flex items-center gap-2">
            <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">
              {s.stage}
            </span>
            <div className="relative h-4 flex-1 rounded bg-muted/40">
              <div
                className={cn("absolute h-full rounded", colors[s.stage] ?? "bg-slate-500")}
                style={{
                  left: `${offsetPct}%`,
                  width: `${Math.max(0.5, widthPct)}%`,
                }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[10px] tnum text-muted-foreground">
              {s.ms.toFixed(2)}ms
            </span>
          </div>
        );
      })}
      <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
          Total
        </span>
        <span className="font-mono text-xs tnum font-medium text-foreground">
          {formatMs(total)}
        </span>
      </div>
    </div>
  );
}

function HistoryRow({ response, index }: { response: PlaygroundResponse; index: number }) {
  return (
    <div className="flex items-center gap-2 rounded border border-border/40 bg-muted/20 px-2 py-1 font-mono text-[10px]">
      <span className="text-muted-foreground/50">#{responseHistory_indexLabel(index)}</span>
      <span className={cn("tnum font-medium", statusColor(response.status))}>
        {response.status}
      </span>
      <span className="text-muted-foreground tnum">{formatMs(response.totalMs)}</span>
      <span className="ml-auto text-muted-foreground/50">{response.servedBy}</span>
    </div>
  );
}

function responseHistory_indexLabel(index: number): string {
  return String(index + 1).padStart(2, "0");
}
