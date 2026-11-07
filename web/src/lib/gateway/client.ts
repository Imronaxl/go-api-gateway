import type { GatewayConfig, PlaygroundRequest, PlaygroundResponse } from "./types";
import { parsePrometheus, parseServerTiming, type BackendStatus, type Scrape } from "./live";

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function probeGateway(
  cfg: GatewayConfig,
  timeoutMs = 1500,
): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
  const start = performance.now();
  try {
    const res = await withTimeout(timeoutMs, (signal) => fetch(`${cfg.baseUrl}/healthz`, { signal }));
    return { reachable: res.ok, latencyMs: performance.now() - start };
  } catch (err) {
    return {
      reachable: false,
      latencyMs: performance.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function sendLiveRequest(
  req: PlaygroundRequest,
  cfg: GatewayConfig,
): Promise<PlaygroundResponse> {
  const headers = new Headers(req.headers);
  headers.set("Authorization", `Bearer ${cfg.jwtToken}`);

  const t0 = performance.now();
  const res = await fetch(`${cfg.baseUrl}${req.path}`, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
  });
  const body = await res.text();
  const clientMs = performance.now() - t0;

  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    responseHeaders[k] = v;
  });

  // Stage timings come from the gateway itself. Anything the header does not
  // cover (network, CORS, reading the body) is shown as "client".
  const { stages, totalMs } = parseServerTiming(res.headers.get("server-timing"));
  if (totalMs !== null && clientMs > totalMs) {
    stages.push({ stage: "client", ms: clientMs - totalMs });
  }

  return {
    requestId: req.id,
    totalMs: clientMs,
    stages,
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
    body,
    servedBy: "live",
    backendId: res.headers.get("x-backend-id") ?? undefined,
  };
}

export interface ParsedMetrics {
  raw: string;
  scrape: Scrape;
}

export async function fetchPrometheusMetrics(
  cfg: GatewayConfig,
  timeoutMs = 2000,
): Promise<ParsedMetrics | null> {
  try {
    const res = await withTimeout(timeoutMs, (signal) => fetch(cfg.metricsUrl, { signal }));
    if (!res.ok) return null;
    const raw = await res.text();
    return { raw, scrape: { ts: Date.now(), samples: parsePrometheus(raw) } };
  } catch {
    return null;
  }
}

export async function fetchBackendStatus(
  cfg: GatewayConfig,
  timeoutMs = 2000,
): Promise<BackendStatus[] | null> {
  try {
    const res = await withTimeout(timeoutMs, (signal) =>
      fetch(`${cfg.baseUrl}/_relay/status`, {
        headers: { Authorization: `Bearer ${cfg.jwtToken}` },
        signal,
      }),
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { backends: BackendStatus[] };
    return data.backends;
  } catch {
    return null;
  }
}
