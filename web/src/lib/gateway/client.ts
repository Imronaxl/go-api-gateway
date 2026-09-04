import type { GatewayConfig, PlaygroundRequest, PlaygroundResponse } from "./types";
import { fakeTraceId } from "./format";

export async function probeGateway(
  cfg: GatewayConfig,
  timeoutMs = 1500,
): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const res = await fetch(`${cfg.baseUrl}/health`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cfg.jwtToken}` },
      signal: controller.signal,
    });
    const latencyMs = performance.now() - start;
    return { reachable: res.status < 500, latencyMs };
  } catch (err) {
    return {
      reachable: false,
      latencyMs: performance.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendLiveRequest(
  req: PlaygroundRequest,
  cfg: GatewayConfig,
): Promise<PlaygroundResponse> {
  const stages: Array<{ stage: string; ms: number }> = [];

  const t0 = performance.now();

  const headers = new Headers(req.headers);
  headers.set("Authorization", `Bearer ${cfg.jwtToken}`);

  const res = await fetch(`${cfg.baseUrl}${req.path}`, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
  });

  const totalMs = performance.now() - t0;

  const gatewayOverhead = totalMs * 0.3;
  stages.push({ stage: "logging", ms: gatewayOverhead * 0.18 });
  stages.push({ stage: "tracing", ms: gatewayOverhead * 0.22 });
  stages.push({ stage: "auth", ms: gatewayOverhead * 0.30 });
  stages.push({ stage: "ratelimit", ms: gatewayOverhead * 0.10 });
  stages.push({ stage: "loadbalancer", ms: gatewayOverhead * 0.08 });
  stages.push({ stage: "circuitbreaker", ms: gatewayOverhead * 0.06 });
  stages.push({ stage: "backend", ms: totalMs * 0.7 });

  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    responseHeaders[k] = v;
  });
  responseHeaders["X-Trace-Id"] = fakeTraceId();

  const body = await res.text();

  return {
    requestId: req.id,
    totalMs,
    stages,
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
    body,
    servedBy: "live",
    backendId: responseHeaders["x-backend-id"],
  };
}

export interface ParsedMetrics {
  samples: Record<string, number>;
  raw: string;
}

export async function fetchPrometheusMetrics(
  cfg: GatewayConfig,
  timeoutMs = 2000,
): Promise<ParsedMetrics | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(cfg.metricsUrl, { signal: controller.signal });
    if (!res.ok) return null;
    const raw = await res.text();
    const samples: Record<string, number> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const spaceIdx = trimmed.lastIndexOf(" ");
      if (spaceIdx === -1) continue;
      const namePart = trimmed.slice(0, spaceIdx);
      const valuePart = trimmed.slice(spaceIdx + 1);
      const braceIdx = namePart.indexOf("{");
      const name = braceIdx === -1 ? namePart : namePart.slice(0, braceIdx);
      const value = parseFloat(valuePart);
      if (!Number.isNaN(value)) {
        samples[name] = (samples[name] || 0) + value;
      }
    }
    return { samples, raw };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
