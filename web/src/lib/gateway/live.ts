// Turns raw data from a running relay (/metrics and /_relay/status) into the
// same shapes the simulator produces, so every view works in live mode.

import type {
  Backend,
  CircuitBreakerState,
  CircuitBreakerStatus,
  GatewayConfig,
  LatencyBucket,
  MetricSnapshot,
} from "./types";

export interface Sample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export interface Scrape {
  ts: number;
  samples: Sample[];
}

export interface BackendStatus {
  id: string;
  url: string;
  up: boolean;
  breaker: CircuitBreakerState;
}

const LINE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+(\S+)/;
const LABEL = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;

/** Parses the Prometheus text exposition format (comments are skipped). */
export function parsePrometheus(text: string): Sample[] {
  const out: Sample[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = LINE.exec(line);
    if (!m) continue;
    const value = Number(m[3]);
    if (Number.isNaN(value)) continue;
    const labels: Record<string, string> = {};
    for (const l of (m[2] ?? "").matchAll(LABEL)) labels[l[1]] = l[2];
    out.push({ name: m[1], labels, value });
  }
  return out;
}

function sum(samples: Sample[], name: string, match: (l: Record<string, string>) => boolean = () => true) {
  let total = 0;
  for (const s of samples) if (s.name === name && match(s.labels)) total += s.value;
  return total;
}

/** Cumulative histogram buckets summed across label sets, keyed by upper bound (seconds). */
function buckets(samples: Sample[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const s of samples) {
    if (s.name !== "relay_http_request_duration_seconds_bucket") continue;
    const le = s.labels.le === "+Inf" ? Infinity : Number(s.labels.le);
    out.set(le, (out.get(le) ?? 0) + s.value);
  }
  return out;
}

/**
 * Estimates a quantile from cumulative bucket counts with linear
 * interpolation inside the bucket, the same way PromQL histogram_quantile does.
 * Returns milliseconds.
 */
export function histogramQuantile(q: number, cumulative: Map<number, number>): number {
  const bounds = [...cumulative.keys()].sort((a, b) => a - b);
  const total = cumulative.get(Infinity) ?? 0;
  if (total <= 0 || bounds.length === 0) return 0;

  const rank = q * total;
  let prevBound = 0;
  let prevCount = 0;
  for (const le of bounds) {
    const count = cumulative.get(le) ?? 0;
    if (count >= rank) {
      if (le === Infinity) return prevBound * 1000;
      const inBucket = count - prevCount;
      const frac = inBucket > 0 ? (rank - prevCount) / inBucket : 0;
      return (prevBound + (le - prevBound) * frac) * 1000;
    }
    prevBound = le;
    prevCount = count;
  }
  return prevBound * 1000;
}

function delta(curr: Map<number, number>, prev: Map<number, number> | null): Map<number, number> {
  if (!prev) return curr;
  const out = new Map<number, number>();
  for (const [le, v] of curr) out.set(le, Math.max(0, v - (prev.get(le) ?? 0)));
  return out;
}

/**
 * Builds a snapshot from two consecutive scrapes. Rates and percentiles
 * describe the interval between them; totals are since the gateway started.
 */
export function snapshotFromScrapes(prev: Scrape | null, curr: Scrape): MetricSnapshot {
  const s = curr.samples;
  const total = sum(s, "relay_http_requests_total");
  const errors = sum(s, "relay_http_requests_total", (l) => l.code?.startsWith("5"));
  const limited = sum(s, "relay_ratelimit_rejected_total");

  let rps = 0;
  let errorRate = total > 0 ? errors / total : 0;
  let rateLimited = limited;
  if (prev) {
    const dt = (curr.ts - prev.ts) / 1000;
    const dTotal = total - sum(prev.samples, "relay_http_requests_total");
    const dErrors = errors - sum(prev.samples, "relay_http_requests_total", (l) => l.code?.startsWith("5"));
    rps = dt > 0 ? Math.max(0, dTotal) / dt : 0;
    errorRate = dTotal > 0 ? dErrors / dTotal : 0;
    rateLimited = Math.max(0, limited - sum(prev.samples, "relay_ratelimit_rejected_total"));
  }

  const currBuckets = buckets(s);
  const window = delta(currBuckets, prev ? buckets(prev.samples) : null);

  const statusCodes: Record<number, number> = {};
  for (const x of s) {
    if (x.name !== "relay_http_requests_total") continue;
    const code = Number(x.labels.code);
    statusCodes[code] = (statusCodes[code] ?? 0) + x.value;
  }

  const latencyBuckets: LatencyBucket[] = [...currBuckets.entries()]
    .filter(([le]) => Number.isFinite(le))
    .sort(([a], [b]) => a - b)
    .map(([le, count]) => ({ le: le * 1000, count }));

  return {
    ts: curr.ts,
    rps,
    p50: histogramQuantile(0.5, window),
    p95: histogramQuantile(0.95, window),
    p99: histogramQuantile(0.99, window),
    errorRate,
    rateLimited,
    totalRequests: total,
    latencyBuckets,
    statusCodes,
  };
}

/** Merges /_relay/status with per-backend counters from /metrics. */
export function backendsFromStatus(status: BackendStatus[], samples: Sample[]): Backend[] {
  const total = sum(samples, "relay_http_requests_total", (l) => l.backend !== "none") || 1;
  return status.map((b) => {
    const handled = sum(samples, "relay_http_requests_total", (l) => l.backend === b.id);
    const errors = sum(samples, "relay_http_requests_total", (l) => l.backend === b.id && l.code?.startsWith("5"));
    const latencySum = sum(samples, "relay_http_request_duration_seconds_sum", (l) => l.backend === b.id);
    const latencyCount = sum(samples, "relay_http_request_duration_seconds_count", (l) => l.backend === b.id);
    return {
      id: b.id,
      url: b.url,
      protocol: b.url.startsWith("https") ? "https" : "http",
      weight: 1,
      alive: b.up && b.breaker !== "open",
      health: !b.up ? "unhealthy" : b.breaker === "closed" ? "healthy" : "degraded",
      requestsHandled: handled,
      avgLatencyMs: latencyCount > 0 ? (latencySum / latencyCount) * 1000 : 0,
      errorRate: handled > 0 ? errors / handled : 0,
      trafficShare: Math.round((handled / total) * 100),
    };
  });
}

const SEVERITY: Record<CircuitBreakerState, number> = { closed: 0, "half-open": 1, open: 2 };

/** The dashboard shows one breaker; in live mode it reflects the worst backend. */
export function breakerFromStatus(status: BackendStatus[], cfg: GatewayConfig): CircuitBreakerStatus {
  const worst = status.reduce<CircuitBreakerState>(
    (acc, b) => (SEVERITY[b.breaker] > SEVERITY[acc] ? b.breaker : acc),
    "closed",
  );
  return {
    state: worst,
    failures: status.filter((b) => b.breaker !== "closed").length,
    successes: 0,
    msSinceLastFailure: 0,
    config: cfg.circuitBreaker,
  };
}

/** Parses a Server-Timing header into ordered stages, leaving out "total". */
export function parseServerTiming(header: string | null): { stages: Array<{ stage: string; ms: number }>; totalMs: number | null } {
  const stages: Array<{ stage: string; ms: number }> = [];
  let totalMs: number | null = null;
  for (const part of (header ?? "").split(",")) {
    const [name, ...params] = part.trim().split(";");
    if (!name) continue;
    const dur = params.map((p) => p.trim()).find((p) => p.startsWith("dur="));
    const ms = dur ? Number(dur.slice(4)) : 0;
    if (Number.isNaN(ms)) continue;
    if (name === "total") totalMs = ms;
    else stages.push({ stage: name, ms });
  }
  return { stages, totalMs };
}
