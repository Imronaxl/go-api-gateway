# ADR-0001: Single-route SPA with internal view switching

**Status:** Accepted

## Summary

The dashboard is implemented as a single Next.js route (`/`) that switches
between six views (Overview, Playground, Metrics, Backends, Logs,
Architecture) via internal state, rather than using one route per view.

## Context

The dashboard has six top-level views with no meaningful URL semantics —
they don't represent resources, they're just panels in a console. We
considered two options:

1. **Multi-route** — `/overview`, `/playground`, `/metrics`, etc., each with
   its own `page.tsx` and shared layout.
2. **Single-route SPA** — one `page.tsx`, a Zustand `view` field, and a
   switch statement in the shell.

The dashboard also runs in a sandboxed preview environment where the dev
server is the only thing exposed. Deep-linking to specific views isn't a
requirement for the portfolio use case.

## Decision

Go with the single-route SPA. View state lives in the Zustand store; the
shell reads `view` and renders the matching component. Keyboard shortcuts
(`1`–`6`) and the command palette (`⌘K`) switch views instantly without any
network round-trip.

## Consequences

**Positive**

- Zero routing boilerplate — no `loading.tsx`, no `error.tsx` per route
- Instant view switches — no navigation latency, no layout shift
- The Zustand store becomes the single source of truth for everything,
  including "where am I"
- Works in any preview environment without configuring rewrites

**Negative**

- No deep-linking — you can't bookmark `/playground` and arrive there
- Browser back button doesn't switch views (could be fixed with
  `history.pushState`, but isn't worth the complexity for a portfolio piece)
- All views are always bundled — no per-route code splitting

## Alternatives considered

- **Next.js App Router with one route per view** — cleaner URL semantics,
  built-in code splitting, but adds ~6 files of boilerplate and the
  navigation latency is noticeable in this use case.
- **React Router inside the single route** — would give us URLs without
  Next.js routing, but adds a dependency and is redundant given how few
  views exist.

For a production SRE tool that users bookmark and share links to, the
multi-route approach would win. For a portfolio dashboard, the SPA is the
right call.
