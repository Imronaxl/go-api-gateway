/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import {
  backendsFromStatus,
  breakerFromStatus,
  histogramQuantile,
  parsePrometheus,
  parseServerTiming,
  snapshotFromScrapes,
} from "../live";
import { DEFAULT_GATEWAY_CONFIG } from "../types";

function scrape(ts: number, ok: number, err: number, fast: number, slow: number) {
  const text = `
# HELP relay_http_requests_total Requests handled by the gateway.
# TYPE relay_http_requests_total counter
relay_http_requests_total{backend="b1",code="200",method="GET"} ${ok}
relay_http_requests_total{backend="b1",code="502",method="GET"} ${err}
relay_ratelimit_rejected_total 3
relay_http_request_duration_seconds_bucket{backend="b1",le="0.01"} ${fast}
relay_http_request_duration_seconds_bucket{backend="b1",le="0.1"} ${fast + slow}
relay_http_request_duration_seconds_bucket{backend="b1",le="+Inf"} ${fast + slow}
relay_http_request_duration_seconds_sum{backend="b1"} 1.5
relay_http_request_duration_seconds_count{backend="b1"} ${fast + slow}
`;
  return { ts, samples: parsePrometheus(text) };
}

describe("parsePrometheus", () => {
  test("reads names, labels and values and skips comments", () => {
    const samples = parsePrometheus('# HELP x\nfoo{a="1",b="two words"} 4.5\nbar 7\n');
    expect(samples).toEqual([
      { name: "foo", labels: { a: "1", b: "two words" }, value: 4.5 },
      { name: "bar", labels: {}, value: 7 },
    ]);
  });
});

describe("histogramQuantile", () => {
  test("interpolates inside the bucket like PromQL", () => {
    const b = new Map([
      [0.01, 50],
      [0.1, 100],
      [Infinity, 100],
    ]);
    expect(histogramQuantile(0.5, b)).toBeCloseTo(10);
    expect(histogramQuantile(0.75, b)).toBeCloseTo(55);
  });

  test("returns 0 with no observations", () => {
    expect(histogramQuantile(0.99, new Map([[Infinity, 0]]))).toBe(0);
  });
});

describe("snapshotFromScrapes", () => {
  test("computes rates over the interval between scrapes", () => {
    const prev = scrape(0, 100, 0, 100, 0);
    const curr = scrape(2000, 116, 4, 100, 20);
    const snap = snapshotFromScrapes(prev, curr);

    expect(snap.rps).toBeCloseTo(10); // 20 new requests in 2 s
    expect(snap.errorRate).toBeCloseTo(0.2); // 4 of 20
    expect(snap.totalRequests).toBe(120);
    expect(snap.statusCodes).toEqual({ 200: 116, 502: 4 });
    // all 20 new requests fell into the 10-100 ms bucket
    expect(snap.p50).toBeGreaterThan(10);
    expect(snap.p99).toBeLessThanOrEqual(100);
  });

  test("works for the first scrape", () => {
    const snap = snapshotFromScrapes(null, scrape(0, 10, 0, 10, 0));
    expect(snap.rps).toBe(0);
    expect(snap.totalRequests).toBe(10);
  });
});

describe("status mapping", () => {
  const status = [
    { id: "b1", url: "http://b1:8081", up: true, breaker: "closed" as const },
    { id: "b2", url: "http://b2:8082", up: true, breaker: "open" as const },
    { id: "b3", url: "http://b3:8083", up: false, breaker: "closed" as const },
  ];

  test("backends combine health, breaker and per-backend counters", () => {
    const backends = backendsFromStatus(status, scrape(0, 8, 2, 10, 0).samples);
    expect(backends.map((b) => b.health)).toEqual(["healthy", "degraded", "unhealthy"]);
    expect(backends.map((b) => b.alive)).toEqual([true, false, false]);
    expect(backends[0].requestsHandled).toBe(10);
    expect(backends[0].errorRate).toBeCloseTo(0.2);
    expect(backends[0].avgLatencyMs).toBeCloseTo(150);
  });

  test("breaker shows the worst backend state", () => {
    expect(breakerFromStatus(status, DEFAULT_GATEWAY_CONFIG).state).toBe("open");
    expect(breakerFromStatus([status[0]], DEFAULT_GATEWAY_CONFIG).state).toBe("closed");
  });
});

describe("parseServerTiming", () => {
  test("splits stages from the total", () => {
    const { stages, totalMs } = parseServerTiming(
      "ratelimit;dur=0.001, auth;dur=0.020, balancer;dur=0.001, upstream;dur=4.500, total;dur=4.600",
    );
    expect(stages.map((s) => s.stage)).toEqual(["ratelimit", "auth", "balancer", "upstream"]);
    expect(stages[3].ms).toBe(4.5);
    expect(totalMs).toBe(4.6);
  });

  test("handles a missing header", () => {
    expect(parseServerTiming(null)).toEqual({ stages: [], totalMs: null });
  });
});
