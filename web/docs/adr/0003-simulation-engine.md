# ADR-0003: Built-in simulation engine for offline preview

**Status:** Accepted

## Summary

The dashboard ships with a TypeScript simulation engine that reproduces
the behavior of the Go relay — token bucket rate limiter, circuit breaker
state machine, round-robin load balancer, structured logging. When the real
relay isn't reachable, the dashboard runs on the simulator so it's always
explorable.

## Context

The dashboard's primary audience is a reviewer looking at the portfolio
piece in a preview environment. The Go backend isn't running in that
environment — and even if it were, configuring JWT tokens and Prometheus
endpoints just to see the dashboard would be friction.

But the dashboard also needs to *work* against a real relay when one is
available, so it's not just a static mockup.

## Decision

Build a faithful simulator in `src/lib/gateway/mock-engine.ts` that mirrors
the Go middleware:

- **Token bucket** — same algorithm as `internal/middleware/ratelimit`,
  using the same default `rate=100, burst=50`.
- **Circuit breaker** — same state machine (closed → open → half-open →
  closed) with the same thresholds (`MaxFailures=5, Timeout=30s,
  HalfOpenLimit=3`).
- **Round-robin balancer** — same selection strategy as
  `internal/proxy/proxy.go`.
- **Structured logs** — emits `slog`-shaped entries with the same fields
  (method, path, status, duration, backend, trace_id).

The store's `mode` field (`auto` | `live` | `simulated`) controls which
source is used. In `auto` mode, a probe to `/health` determines
reachability; if it fails, the simulator takes over.

## Consequences

**Positive**

- The dashboard is always explorable — reviewers can poke around without
  running anything
- The simulator is a teaching tool — the "Inject failure burst" button
  demonstrates the circuit breaker tripping in real time
- The TypeScript types in `types.ts` mirror the Go structs, so the boundary
  between frontend and backend is explicit
- Writing the simulator forced me to actually understand the Go code, not
  just consume it

**Negative**

- Two implementations of the same logic — if the Go code changes, the
  simulator has to follow. Mitigated by unit tests in
  `__tests__/mock-engine.test.ts` that pin the expected behavior.
- The simulator's traffic patterns are synthetic — they look real but
  aren't statistically representative of any actual workload.

## Alternatives considered

- **Static JSON fixtures** — read a canned `metrics.json`. Easy but the
  dashboard would look dead — no live updates, no circuit breaker
  transitions. Reject.
- **MSW (Mock Service Worker)** — intercept `fetch` calls and return mocked
  responses. Good for testing but doesn't help with the simulation *engine*
  (rate limit, breaker) — only with HTTP responses.
- **Don't ship a simulator** — require the Go backend to be running.
  Acceptable for a production tool, fatal for a portfolio piece.

The simulator is the most distinctive feature of this dashboard. It's the
difference between "I built a frontend for a Go backend" and "I understand
the Go backend well enough to reproduce it".
