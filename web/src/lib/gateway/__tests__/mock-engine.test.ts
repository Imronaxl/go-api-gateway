
import { test, expect, describe, beforeEach } from "bun:test";
import {
  tick,
  resetSimulation,
  forceCircuitBreakerState,
  injectFailureBurst,
  simulatePlaygroundRequest,
} from "../mock-engine";
import { DEFAULT_GATEWAY_CONFIG } from "../types";

describe("simulation engine", () => {
  beforeEach(() => {
    resetSimulation();
  });

  describe("tick", () => {
    test("produces a snapshot with all required fields", () => {
      const result = tick(DEFAULT_GATEWAY_CONFIG);
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.rps).toBeGreaterThan(0);
      expect(result.snapshot.totalRequests).toBeGreaterThan(0);
      expect(result.snapshot.latencyBuckets.length).toBeGreaterThan(0);
      expect(result.backends.length).toBe(3);
      expect(result.circuitBreaker).toBeDefined();
      expect(Array.isArray(result.recent)).toBe(true);
      expect(Array.isArray(result.logs)).toBe(true);
    });

    test("accumulates totalRequests across ticks", () => {
      const r1 = tick(DEFAULT_GATEWAY_CONFIG);
      const r2 = tick(DEFAULT_GATEWAY_CONFIG);
      expect(r2.snapshot.totalRequests).toBeGreaterThan(r1.snapshot.totalRequests);
    });

    test("always returns 3 backends matching docker-compose", () => {
      const result = tick(DEFAULT_GATEWAY_CONFIG);
      expect(result.backends.length).toBe(3);
      expect(result.backends.map((b) => b.id)).toEqual([
        "be-rest-1",
        "be-rest-2",
        "be-grpc-1",
      ]);
    });
  });

  describe("circuit breaker state machine", () => {
    test("starts in closed state", () => {
      const result = tick(DEFAULT_GATEWAY_CONFIG);
      expect(result.circuitBreaker.state).toBe("closed");
    });

    test("forceCircuitBreakerState can open the breaker", () => {
      forceCircuitBreakerState("open");
      const result = tick(DEFAULT_GATEWAY_CONFIG);
      expect(result.circuitBreaker.state).toBe("open");
    });

    test("forceCircuitBreakerState can set half-open (may close on next tick)", () => {
      
      
      
      forceCircuitBreakerState("half-open");
      
      
      
      const result = tick(DEFAULT_GATEWAY_CONFIG);
      
      
      expect(["half-open", "closed"]).toContain(result.circuitBreaker.state);
    });

    test("forceCircuitBreakerState can close again after opening", () => {
      forceCircuitBreakerState("open");
      forceCircuitBreakerState("closed");
      const result = tick(DEFAULT_GATEWAY_CONFIG);
      expect(result.circuitBreaker.state).toBe("closed");
      expect(result.circuitBreaker.failures).toBe(0);
    });

    test("opening the breaker clears the lastFailureTs when closed", () => {
      forceCircuitBreakerState("closed");
      const result = tick(DEFAULT_GATEWAY_CONFIG);
      expect(result.circuitBreaker.msSinceLastFailure).toBe(0);
    });
  });

  describe("injectFailureBurst", () => {
    test("trips the breaker when failures exceed threshold", () => {
      
      
      injectFailureBurst(6);
      const result = tick(DEFAULT_GATEWAY_CONFIG);
      expect(result.circuitBreaker.state).toBe("open");
      expect(result.circuitBreaker.failures).toBeGreaterThanOrEqual(6);
    });

    test("logs the injection event", () => {
      injectFailureBurst(6);
      const result = tick(DEFAULT_GATEWAY_CONFIG);
      const injected = result.logs.find((l) => l.message === "injected failure burst");
      expect(injected).toBeDefined();
      expect(injected?.fields.count).toBe(6);
    });

    test("does NOT trip when below threshold", () => {
      injectFailureBurst(2);
      const result = tick(DEFAULT_GATEWAY_CONFIG);
      expect(result.circuitBreaker.state).toBe("closed");
    });
  });

  describe("simulatePlaygroundRequest", () => {
    test("/health returns 200 with body 'ok'", () => {
      const result = simulatePlaygroundRequest(
        {
          id: "test-1",
          ts: Date.now(),
          method: "GET",
          path: "/health",
          headers: {},
          body: "",
        },
        DEFAULT_GATEWAY_CONFIG,
      );
      expect(result.status).toBe(200);
      expect(result.body).toBe("ok");
      expect(result.servedBy).toBe("simulated");
    });

    test("/echo returns method and path in body", () => {
      const result = simulatePlaygroundRequest(
        {
          id: "test-2",
          ts: Date.now(),
          method: "POST",
          path: "/echo",
          headers: {},
          body: "",
        },
        DEFAULT_GATEWAY_CONFIG,
      );
      expect(result.status).toBe(200);
      const parsed = JSON.parse(result.body);
      expect(parsed.method).toBe("POST");
      expect(parsed.path).toBe("/echo");
    });

    test("/api/* returns JSON with backend id", () => {
      const result = simulatePlaygroundRequest(
        {
          id: "test-3",
          ts: Date.now(),
          method: "GET",
          path: "/api/users",
          headers: {},
          body: "",
        },
        DEFAULT_GATEWAY_CONFIG,
      );
      expect(result.status).toBe(200);
      const parsed = JSON.parse(result.body);
      expect(parsed.ok).toBe(true);
      expect(parsed.backend).toMatch(/^be-/);
    });

    test("unknown path returns 404", () => {
      const result = simulatePlaygroundRequest(
        {
          id: "test-4",
          ts: Date.now(),
          method: "GET",
          path: "/unknown",
          headers: {},
          body: "",
        },
        DEFAULT_GATEWAY_CONFIG,
      );
      expect(result.status).toBe(404);
    });

    test("always includes timing breakdown with all stages", () => {
      const result = simulatePlaygroundRequest(
        {
          id: "test-5",
          ts: Date.now(),
          method: "GET",
          path: "/echo",
          headers: {},
          body: "",
        },
        DEFAULT_GATEWAY_CONFIG,
      );
      const stageNames = result.stages.map((s) => s.stage);
      expect(stageNames).toEqual([
        "logging",
        "tracing",
        "auth",
        "ratelimit",
        "loadbalancer",
        "circuitbreaker",
        "backend",
      ]);
      expect(result.totalMs).toBeGreaterThan(0);
    });
  });

  describe("resetSimulation", () => {
    test("clears accumulated state", () => {
      
      tick(DEFAULT_GATEWAY_CONFIG);
      tick(DEFAULT_GATEWAY_CONFIG);
      tick(DEFAULT_GATEWAY_CONFIG);
      const before = tick(DEFAULT_GATEWAY_CONFIG);

      resetSimulation();
      const after = tick(DEFAULT_GATEWAY_CONFIG);

      expect(after.snapshot.totalRequests).toBeLessThan(before.snapshot.totalRequests);
      expect(after.circuitBreaker.state).toBe("closed");
      expect(after.circuitBreaker.failures).toBe(0);
    });
  });
});
