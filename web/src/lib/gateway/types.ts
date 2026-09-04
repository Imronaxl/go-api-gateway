export type GatewayMode = "auto" | "live" | "simulated";
export type ConnectionStatus = "connected" | "degraded" | "disconnected";
export type CircuitBreakerState = "closed" | "open" | "half-open";
export type BackendHealth = "healthy" | "degraded" | "unhealthy";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface MiddlewareStage {
  id: string;
  name: string;
  package: string;
  description: string;
  enabled: boolean;
  overheadMs: number;
}

export interface Backend {
  id: string;
  url: string;
  protocol: "http" | "grpc";
  weight: number;
  alive: boolean;
  health: BackendHealth;
  requestsHandled: number;
  avgLatencyMs: number;
  errorRate: number;
  trafficShare: number;
}

export interface MetricPoint {
  ts: number;
  value: number;
}

export interface LatencyBucket {
  le: number;
  count: number;
}

export interface MetricSnapshot {
  ts: number;
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  rateLimited: number;
  totalRequests: number;
  latencyBuckets: LatencyBucket[];
  statusCodes: Record<number, number>;
}

export interface RateLimitConfig {
  rate: number;
  burst: number;
}

export interface CircuitBreakerConfig {
  maxFailures: number;
  timeoutMs: number;
  halfOpenLimit: number;
}

export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  msSinceLastFailure: number;
  config: CircuitBreakerConfig;
}

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
  fields: Record<string, string | number | boolean>;
}

export interface PlaygroundRequest {
  id: string;
  ts: number;
  method: HttpMethod;
  path: string;
  headers: Record<string, string>;
  body: string;
}

export interface PlaygroundResponse {
  requestId: string;
  totalMs: number;
  stages: Array<{ stage: string; ms: number }>;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  servedBy: "live" | "simulated";
  backendId?: string;
}

export interface RecentRequest {
  id: string;
  ts: number;
  method: HttpMethod;
  path: string;
  status: number;
  durationMs: number;
  backendId: string;
  traceId: string;
}

export interface GatewayConfig {
  baseUrl: string;
  jwtToken: string;
  metricsUrl: string;
  mode: GatewayMode;
  rateLimit: RateLimitConfig;
  circuitBreaker: CircuitBreakerConfig;
}

export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  baseUrl: "http://localhost:8080",
  jwtToken:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
  metricsUrl: "http://localhost:9090/metrics",
  mode: "auto",
  rateLimit: { rate: 100, burst: 50 },
  circuitBreaker: { maxFailures: 5, timeoutMs: 30_000, halfOpenLimit: 3 },
};

export const MIDDLEWARE_CHAIN: MiddlewareStage[] = [
  {
    id: "logging",
    name: "Logging",
    package: "internal/middleware/logging",
    description:
      "Structured slog output. Emits method, path, and duration for every request.",
    enabled: true,
    overheadMs: 0.08,
  },
  {
    id: "tracing",
    name: "Tracing",
    package: "internal/middleware/tracing",
    description:
      "OpenTelemetry server span. Extracts upstream context and starts a relay-request span.",
    enabled: true,
    overheadMs: 0.12,
  },
  {
    id: "auth",
    name: "JWT Auth",
    package: "internal/middleware/auth",
    description:
      "Validates the `Authorization: Bearer <token>` header. Rejects with 401 on missing or malformed tokens.",
    enabled: true,
    overheadMs: 0.18,
  },
  {
    id: "ratelimit",
    name: "Rate Limit",
    package: "internal/middleware/ratelimit",
    description:
      "Per-client token bucket. Returns 429 with a Retry-After header when the bucket is empty.",
    enabled: true,
    overheadMs: 0.05,
  },
  {
    id: "loadbalancer",
    name: "Load Balancer",
    package: "internal/proxy",
    description:
      "Round-robin selection across healthy backends. Skips backends whose Alive flag is false.",
    enabled: true,
    overheadMs: 0.03,
  },
  {
    id: "circuitbreaker",
    name: "Circuit Breaker",
    package: "internal/middleware/circuitbreaker",
    description:
      "Tracks per-backend failures. Opens after MaxFailures, half-opens after Timeout, closes after HalfOpenLimit successes.",
    enabled: true,
    overheadMs: 0.04,
  },
];
