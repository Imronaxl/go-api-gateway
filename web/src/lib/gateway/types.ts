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
  protocol: "http" | "https";
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
  // Signed with the docker-compose default secret (local-dev-secret-change-me).
  // Generate your own with: go run ./cmd/tokengen -sub dashboard -ttl 0
  jwtToken:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkYXNoYm9hcmQiLCJpYXQiOjE3OTQwNTg4NzJ9.eZ_SWTnx0LvWy9L1mGlo5rxSnzyGp_v2Z15N-oTY0hI",
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
      "One slog JSON line per request with status, bytes, duration, backend, subject and trace id.",
    enabled: true,
    overheadMs: 0.02,
  },
  {
    id: "tracing",
    name: "Tracing",
    package: "internal/middleware/tracing",
    description:
      "OpenTelemetry server span that continues the caller's W3C trace context and returns X-Trace-Id.",
    enabled: true,
    overheadMs: 0.01,
  },
  {
    id: "ratelimit",
    name: "Rate Limit",
    package: "internal/middleware/ratelimit",
    description:
      "Token bucket per client IP. Answers 429 with Retry-After. Runs before auth so bad tokens are limited too.",
    enabled: true,
    overheadMs: 0.002,
  },
  {
    id: "auth",
    name: "JWT Auth",
    package: "internal/middleware/auth",
    description:
      "Verifies the HS256 signature, exp and nbf of the bearer token. Rejects alg=none and anything not HS256 with 401.",
    enabled: true,
    overheadMs: 0.02,
  },
  {
    id: "loadbalancer",
    name: "Load Balancer",
    package: "internal/proxy",
    description:
      "Round-robin over backends that passed their last health check and whose breaker admits the request.",
    enabled: true,
    overheadMs: 0.001,
  },
  {
    id: "circuitbreaker",
    name: "Circuit Breaker",
    package: "internal/circuitbreaker",
    description:
      "One breaker per backend. Opens after MaxFailures consecutive errors, half-opens after the timeout, closes after successful probes.",
    enabled: true,
    overheadMs: 0.001,
  },
];
