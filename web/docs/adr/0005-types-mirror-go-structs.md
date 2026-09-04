# ADR-0005: TypeScript domain types mirror Go structs

**Status:** Accepted

## Summary

The TypeScript types in `src/lib/gateway/types.ts` are deliberately shaped
to match the Go structs in `internal/middleware/*` and `cmd/relay/main.go`.
Default values in `DEFAULT_GATEWAY_CONFIG` match the constants baked into
the Go code.

## Context

The dashboard speaks to a Go backend. There's no OpenAPI spec or codegen —
the contract between frontend and backend is implicit, defined by reading
the Go source. Without discipline, the two sides drift: someone changes
`MaxFailures` from 5 to 10 in `main.go` and the dashboard still shows 5.

## Decision

Manually mirror the Go structs as TypeScript interfaces, with comments
pointing to the source file. Pin the default values with unit tests.

Examples:

| TypeScript type            | Go source                              |
| -------------------------- | -------------------------------------- |
| `RateLimitConfig`          | `internal/middleware/ratelimit/Config` |
| `CircuitBreakerConfig`     | `internal/middleware/circuitbreaker/Config` |
| `Backend`                  | `internal/proxy/Backend`               |
| `MIDDLEWARE_CHAIN` order   | wrap order in `cmd/relay/main.go`      |

The test in `__tests__/types.test.ts` asserts that
`DEFAULT_GATEWAY_CONFIG.circuitBreaker.maxFailures === 5` and that
`MIDDLEWARE_CHAIN` is in the exact order `logging, tracing, auth,
ratelimit, loadbalancer, circuitbreaker` — matching the Go wrap order. If
either side changes without the other following, the test fails.

## Consequences

**Positive**

- The contract between frontend and backend is explicit and testable
- Reading the TypeScript types tells you the shape of the Go backend
- New contributors can find the Go source for any frontend type via the
  JSDoc comment
- Drift is caught by CI, not by users

**Negative**

- Manual sync — if a Go struct changes, the TypeScript type and its test
  have to be updated by hand. With codegen (OpenAPI, protobuf) this would
  be automatic.
- The TypeScript types can't capture Go-specific semantics (e.g. atomic
  operations, mutex protection) — those are documented in comments only.

## Alternatives considered

- **OpenAPI spec + codegen** — the right answer for a production system
  with many consumers. Overkill for a single-frontend portfolio piece,
  and the Go backend doesn't expose a spec.
- **protobuf + buf** — same as above, plus the relay doesn't have a .proto
  for its HTTP API.
- **Don't bother** — let the types drift. Unacceptable for any code that
  wants to be taken seriously.

This ADR is the kind of thing an interviewer will ask about: "how do you
keep the frontend and backend in sync?" The answer — manual mirroring with
unit tests — is honest, pragmatic, and shows awareness of the trade-offs.
