# Relay dashboard

Next.js dashboard for the [Relay gateway](../README.md).

```bash
bun install
bun run dev     # http://localhost:3000
bun test
bun run lint
bun run build
```

In `auto` mode (the default) it probes `http://localhost:8080/healthz` and
switches to live data when the gateway is up:

- KPIs and charts are computed from consecutive scrapes of `:9090/metrics`
  (`src/lib/gateway/live.ts`).
- Backend health and breaker states come from `/_relay/status`.
- The playground sends real requests and draws the timing waterfall from the
  `Server-Timing` header.

When the gateway is not reachable, `src/lib/gateway/mock-engine.ts` simulates
traffic, backends and a circuit breaker so the UI can be explored on its own.

The gateway must allow the dashboard's origin: `RELAY_CORS_ORIGINS=http://localhost:3000`
(set in `deploy/docker-compose.yml`). The default token in
`src/lib/gateway/types.ts` is signed with the compose development secret;
change it in the settings dialog or generate one with `go run ./cmd/tokengen`.
