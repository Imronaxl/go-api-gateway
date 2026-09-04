import type {
  Backend,
  CircuitBreakerStatus,
  LogEntry,
  MetricSnapshot,
  PlaygroundRequest,
  PlaygroundResponse,
  RecentRequest,
  GatewayConfig,
} from "./types";
import { DEFAULT_GATEWAY_CONFIG } from "./types";
import { fakeTraceId, shortId } from "./format";

const INITIAL_BACKENDS: Backend[] = [
  {
    id: "be-rest-1",
    url: "http://localhost:8081",
    protocol: "http",
    weight: 1,
    alive: true,
    health: "healthy",
    requestsHandled: 0,
    avgLatencyMs: 12,
    errorRate: 0.005,
    trafficShare: 33,
  },
  {
    id: "be-rest-2",
    url: "http://localhost:8082",
    protocol: "http",
    weight: 1,
    alive: true,
    health: "healthy",
    requestsHandled: 0,
    avgLatencyMs: 14,
    errorRate: 0.008,
    trafficShare: 33,
  },
  {
    id: "be-grpc-1",
    url: "http://localhost:8083",
    protocol: "grpc",
    weight: 1,
    alive: true,
    health: "healthy",
    requestsHandled: 0,
    avgLatencyMs: 9,
    errorRate: 0.003,
    trafficShare: 34,
  },
];

const SIMULATED_PATHS: Array<{ path: string; weight: number }> = [
  { path: "/echo", weight: 50 },
  { path: "/health", weight: 30 },
  { path: "/api/users", weight: 8 },
  { path: "/api/orders", weight: 6 },
  { path: "/api/products", weight: 4 },
  { path: "/api/payments", weight: 2 },
];

const HTTP_METHODS: Array<"GET" | "POST" | "PUT" | "DELETE"> = [
  "GET",
  "GET",
  "GET",
  "POST",
  "PUT",
  "DELETE",
];

function gaussian(mean: number, stdDev: number): number {
  const u1 = Math.random() || Number.MIN_VALUE;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

function weightedPick<T>(items: Array<{ item: T; weight: number }>): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const { item, weight } of items) {
    r -= weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1].item;
}

interface SimState {
  backends: Backend[];
  cb: CircuitBreakerStatus;
  totalRequests: number;
  recent: RecentRequest[];
  logs: LogEntry[];
  history: MetricSnapshot[];
  lastFailureTs: number | null;
  tokens: number;
  lastRefillTs: number;
  injectedFailures: number;
}

const state: SimState = {
  backends: INITIAL_BACKENDS.map((b) => ({ ...b })),
  cb: {
    state: "closed",
    failures: 0,
    successes: 0,
    msSinceLastFailure: 0,
    config: DEFAULT_GATEWAY_CONFIG.circuitBreaker,
  },
  totalRequests: 0,
  recent: [],
  logs: [],
  history: [],
  lastFailureTs: null,
  tokens: DEFAULT_GATEWAY_CONFIG.rateLimit.burst,
  lastRefillTs: Date.now(),
  injectedFailures: 0,
};

const MAX_RECENT = 60;
const MAX_LOGS = 200;
const MAX_HISTORY = 60;

function refillTokens(now: number, cfg: GatewayConfig) {
  const elapsed = (now - state.lastRefillTs) / 1000;
  state.tokens = Math.min(
    cfg.rateLimit.burst,
    state.tokens + elapsed * cfg.rateLimit.rate,
  );
  state.lastRefillTs = now;
}

function sampleRequest(now: number, cfg: GatewayConfig): RecentRequest | null {
  refillTokens(now, cfg);

  if (state.tokens < 1) {
    state.logs.push({
      id: shortId("log_"),
      ts: now,
      level: "warn",
      message: "rate limit exceeded",
      fields: {
        client_ip: "127.0.0.1",
        retry_after: 1,
        tokens_remaining: state.tokens.toFixed(2),
      },
    });
    return {
      id: shortId("req_"),
      ts: now,
      method: "GET",
      path: weightedPick(SIMULATED_PATHS.map((p) => ({ item: p.path, weight: p.weight }))),
      status: 429,
      durationMs: 0.2,
      backendId: "—",
      traceId: fakeTraceId(),
    };
  }
  state.tokens -= 1;

  const alive = state.backends.filter((b) => b.alive);
  if (alive.length === 0) {
    return {
      id: shortId("req_"),
      ts: now,
      method: "GET",
      path: "/health",
      status: 503,
      durationMs: 0.3,
      backendId: "—",
      traceId: fakeTraceId(),
    };
  }
  const backend = alive[Math.floor(Math.random() * alive.length)];

  const latency = Math.max(2, gaussian(backend.avgLatencyMs, backend.avgLatencyMs * 0.4));

  let status = 200;
  const roll = Math.random();
  if (roll < backend.errorRate) {
    status = Math.random() < 0.5 ? 500 : 502;
    recordFailure(now, cfg);
  } else if (roll < backend.errorRate + 0.02) {
    status = Math.random() < 0.5 ? 404 : 400;
  }

  backend.requestsHandled += 1;
  backend.avgLatencyMs = backend.avgLatencyMs * 0.95 + latency * 0.05;

  const path = weightedPick(SIMULATED_PATHS.map((p) => ({ item: p.path, weight: p.weight })));
  const method = HTTP_METHODS[Math.floor(Math.random() * HTTP_METHODS.length)];

  const req: RecentRequest = {
    id: shortId("req_"),
    ts: now,
    method,
    path,
    status,
    durationMs: latency,
    backendId: backend.id,
    traceId: fakeTraceId(),
  };

  state.logs.push({
    id: shortId("log_"),
    ts: now,
    level: status < 400 ? "info" : status < 500 ? "warn" : "error",
    message: "request",
    fields: {
      method,
      path,
      status,
      duration: `${latency.toFixed(2)}ms`,
      backend: backend.id,
      trace_id: req.traceId,
    },
  });

  return req;
}

function recordFailure(now: number, _cfg: GatewayConfig) {
  state.cb.failures += 1;
  state.lastFailureTs = now;
  state.cb.msSinceLastFailure = 0;

  if (state.cb.state === "closed" && state.cb.failures >= state.cb.config.maxFailures) {
    state.cb.state = "open";
    state.logs.push({
      id: shortId("log_"),
      ts: now,
      level: "error",
      message: "circuit breaker opened",
      fields: {
        failures: state.cb.failures,
        threshold: state.cb.config.maxFailures,
      },
    });
  } else if (state.cb.state === "half-open") {
    state.cb.state = "open";
    state.cb.successes = 0;
  }
}

function recordSuccess(_now: number) {
  if (state.cb.state === "half-open") {
    state.cb.successes += 1;
    if (state.cb.successes >= state.cb.config.halfOpenLimit) {
      state.cb.state = "closed";
      state.cb.failures = 0;
      state.cb.successes = 0;
    }
  } else if (state.cb.state === "closed") {
    state.cb.failures = 0;
  }
}

export function tick(cfg: GatewayConfig = DEFAULT_GATEWAY_CONFIG): {
  snapshot: MetricSnapshot;
  recent: RecentRequest[];
  logs: LogEntry[];
  backends: Backend[];
  circuitBreaker: CircuitBreakerStatus;
} {
  const now = Date.now();

  if (Math.random() < 0.012 && state.injectedFailures < 1) {
    state.injectedFailures += 1;
    setTimeout(() => {
      state.injectedFailures = 0;
    }, 30_000);
  }

  if (state.cb.state === "open" && state.lastFailureTs !== null) {
    const elapsed = now - state.lastFailureTs;
    state.cb.msSinceLastFailure = elapsed;
    if (elapsed >= state.cb.config.timeoutMs) {
      state.cb.state = "half-open";
      state.cb.successes = 0;
      state.logs.push({
        id: shortId("log_"),
        ts: now,
        level: "warn",
        message: "circuit breaker entering half-open",
        fields: { timeout_ms: state.cb.config.timeoutMs },
      });
    }
  } else if (state.lastFailureTs !== null) {
    state.cb.msSinceLastFailure = now - state.lastFailureTs;
  }

  const isOpen = state.cb.state === "open";

  const count = 3 + Math.floor(Math.random() * 10);
  for (let i = 0; i < count; i++) {
    if (isOpen && Math.random() < 0.9) {
      const path = weightedPick(SIMULATED_PATHS.map((p) => ({ item: p.path, weight: p.weight })));
      const req: RecentRequest = {
        id: shortId("req_"),
        ts: now,
        method: "GET",
        path,
        status: 503,
        durationMs: 0.4,
        backendId: "—",
        traceId: fakeTraceId(),
      };
      state.recent.unshift(req);
      state.logs.push({
        id: shortId("log_"),
        ts: now,
        level: "error",
        message: "service unavailable — circuit open",
        fields: { path, trace_id: req.traceId },
      });
      state.totalRequests += 1;
      continue;
    }

    const req = sampleRequest(now, cfg);
    if (req) {
      state.recent.unshift(req);
      state.totalRequests += 1;
      if (req.status < 500) {
        recordSuccess(now);
      }
    }
  }

  state.recent = state.recent.slice(0, MAX_RECENT);
  state.logs = state.logs.slice(-MAX_LOGS);

  const totalHandled = state.backends.reduce((s, b) => s + b.requestsHandled, 0) || 1;
  for (const b of state.backends) {
    b.trafficShare = Math.round((b.requestsHandled / totalHandled) * 100);
    b.health = !b.alive
      ? "unhealthy"
      : b.errorRate > 0.05
        ? "degraded"
        : "healthy";
  }

  const recentForMetrics = state.recent.slice(0, 60);
  const latencies = recentForMetrics
    .filter((r) => r.status < 500)
    .map((r) => r.durationMs)
    .sort((a, b) => a - b);

  const p = (q: number) =>
    latencies.length === 0
      ? 0
      : latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))];

  const errors = recentForMetrics.filter((r) => r.status >= 500).length;
  const rateLimited = recentForMetrics.filter((r) => r.status === 429).length;

  const bucketBounds = [5, 10, 25, 50, 100, 250, 500, 1000];
  const buckets = bucketBounds.map((le) => ({
    le,
    count: latencies.filter((l) => l <= le).length,
  }));

  const statusCodes: Record<number, number> = {};
  for (const r of recentForMetrics) {
    statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
  }

  const snapshot: MetricSnapshot = {
    ts: now,
    rps: count + Math.random() * 4,
    p50: p(0.5),
    p95: p(0.95),
    p99: p(0.99),
    errorRate: recentForMetrics.length ? errors / recentForMetrics.length : 0,
    rateLimited,
    totalRequests: state.totalRequests,
    latencyBuckets: buckets,
    statusCodes,
  };

  state.history.push(snapshot);
  state.history = state.history.slice(-MAX_HISTORY);

  return {
    snapshot,
    recent: [...state.recent],
    logs: [...state.logs].reverse(),
    backends: state.backends.map((b) => ({ ...b })),
    circuitBreaker: { ...state.cb, config: { ...state.cb.config } },
  };
}

export function simulatePlaygroundRequest(
  req: PlaygroundRequest,
  cfg: GatewayConfig,
): PlaygroundResponse {
  const now = Date.now();
  const stages: Array<{ stage: string; ms: number }> = [];

  stages.push({ stage: "logging", ms: 0.05 + Math.random() * 0.1 });
  stages.push({ stage: "tracing", ms: 0.08 + Math.random() * 0.15 });
  stages.push({ stage: "auth", ms: 0.12 + Math.random() * 0.2 });
  stages.push({ stage: "ratelimit", ms: 0.03 + Math.random() * 0.06 });

  const alive = state.backends.filter((b) => b.alive);
  const backend = alive.length > 0 ? alive[Math.floor(Math.random() * alive.length)] : null;

  stages.push({ stage: "loadbalancer", ms: 0.02 + Math.random() * 0.05 });
  stages.push({ stage: "circuitbreaker", ms: 0.02 + Math.random() * 0.05 });

  if (!backend) {
    stages.push({ stage: "backend", ms: 0.5 });
    return {
      requestId: req.id,
      totalMs: stages.reduce((s, st) => s + st.ms, 0),
      stages,
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/plain" },
      body: "no available backend",
      servedBy: "simulated",
    };
  }

  let status = 200;
  let statusText = "OK";
  let body = "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Backend-Id": backend.id,
    "X-Served-By": "relay-simulated",
  };

  if (req.path === "/health") {
    body = "ok";
    headers["Content-Type"] = "text/plain";
  } else if (req.path === "/echo") {
    body = JSON.stringify({ method: req.method, path: req.path }, null, 2);
  } else if (req.path.startsWith("/api/")) {
    body = JSON.stringify(
      {
        ok: true,
        method: req.method,
        path: req.path,
        received_at: new Date(now).toISOString(),
        backend: backend.id,
        trace_id: fakeTraceId(),
      },
      null,
      2,
    );
  } else {
    status = 404;
    statusText = "Not Found";
    body = JSON.stringify({ error: "not found", path: req.path }, null, 2);
  }

  const backendMs = Math.max(
    1,
    gaussian(backend.avgLatencyMs, backend.avgLatencyMs * 0.4),
  );
  stages.push({ stage: "backend", ms: backendMs });

  const totalMs = stages.reduce((s, st) => s + st.ms, 0);

  return {
    requestId: req.id,
    totalMs,
    stages,
    status,
    statusText,
    headers,
    body,
    servedBy: "simulated",
    backendId: backend.id,
  };
}

export function resetSimulation() {
  state.backends = INITIAL_BACKENDS.map((b) => ({ ...b }));
  state.cb = {
    state: "closed",
    failures: 0,
    successes: 0,
    msSinceLastFailure: 0,
    config: DEFAULT_GATEWAY_CONFIG.circuitBreaker,
  };
  state.totalRequests = 0;
  state.recent = [];
  state.logs = [];
  state.history = [];
  state.lastFailureTs = null;
  state.tokens = DEFAULT_GATEWAY_CONFIG.rateLimit.burst;
  state.lastRefillTs = Date.now();
  state.injectedFailures = 0;
}

export function forceCircuitBreakerState(target: "closed" | "open" | "half-open") {
  state.cb.state = target;
  if (target === "closed") {
    state.cb.failures = 0;
    state.cb.successes = 0;
    state.lastFailureTs = null;
  } else if (target === "open") {
    state.cb.failures = state.cb.config.maxFailures;
    state.lastFailureTs = Date.now();
  }
  state.logs.push({
    id: shortId("log_"),
    ts: Date.now(),
    level: "warn",
    message: `circuit breaker force-set to ${target}`,
    fields: { source: "ui" },
  });
}

export function toggleBackend(backendId: string) {
  const b = state.backends.find((x) => x.id === backendId);
  if (!b) return;
  b.alive = !b.alive;
  state.logs.push({
    id: shortId("log_"),
    ts: Date.now(),
    level: b.alive ? "info" : "warn",
    message: `backend ${b.id} ${b.alive ? "enabled" : "disabled"}`,
    fields: { backend: b.id, alive: b.alive },
  });
}

export function injectFailureBurst(count = 6) {
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    recordFailure(now + i, DEFAULT_GATEWAY_CONFIG);
  }
  state.logs.push({
    id: shortId("log_"),
    ts: now,
    level: "error",
    message: "injected failure burst",
    fields: { count },
  });
}
