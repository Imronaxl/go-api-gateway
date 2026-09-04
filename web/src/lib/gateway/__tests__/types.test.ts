import { test, expect, describe } from "bun:test";
import { DEFAULT_GATEWAY_CONFIG, MIDDLEWARE_CHAIN } from "../types";

describe("DEFAULT_GATEWAY_CONFIG", () => {
  test("matches the relay's baked-in defaults", () => {
    expect(DEFAULT_GATEWAY_CONFIG.circuitBreaker.maxFailures).toBe(5);
    expect(DEFAULT_GATEWAY_CONFIG.circuitBreaker.timeoutMs).toBe(30_000);
    expect(DEFAULT_GATEWAY_CONFIG.circuitBreaker.halfOpenLimit).toBe(3);
    expect(DEFAULT_GATEWAY_CONFIG.rateLimit.rate).toBe(100);
    expect(DEFAULT_GATEWAY_CONFIG.rateLimit.burst).toBe(50);
  });

  test("default mode is auto (live with sim fallback)", () => {
    expect(DEFAULT_GATEWAY_CONFIG.mode).toBe("auto");
  });

  test("default ports match docker-compose.yml", () => {
    expect(DEFAULT_GATEWAY_CONFIG.baseUrl).toContain(":8080");
    expect(DEFAULT_GATEWAY_CONFIG.metricsUrl).toContain(":9090");
  });

  test("JWT token is the example from the README", () => {
    expect(DEFAULT_GATEWAY_CONFIG.jwtToken).toContain("eyJ");
    expect(DEFAULT_GATEWAY_CONFIG.jwtToken.split(".")).toHaveLength(3);
  });
});

describe("MIDDLEWARE_CHAIN", () => {
  test("order matches the wrap order in main.go", () => {
    const ids = MIDDLEWARE_CHAIN.map((s) => s.id);
    expect(ids).toEqual([
      "logging",
      "tracing",
      "auth",
      "ratelimit",
      "loadbalancer",
      "circuitbreaker",
    ]);
  });

  test("every stage has a non-empty description and package path", () => {
    for (const stage of MIDDLEWARE_CHAIN) {
      expect(stage.description.length).toBeGreaterThan(20);
      expect(stage.package.startsWith("internal/")).toBe(true);
      expect(stage.overheadMs).toBeGreaterThan(0);
    }
  });
});
