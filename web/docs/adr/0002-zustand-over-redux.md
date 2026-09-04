# ADR-0002: Zustand over Redux/Context for global state

**Status:** Accepted

## Summary

Global dashboard state (gateway config, metrics, logs, backends, circuit
breaker, view) lives in a single Zustand store. React Context is used only
for the concept explainer, which is a self-contained feature.

## Context

The dashboard has a moderately complex state shape:

- Static-ish config (gateway URL, JWT, rate limit, mode)
- High-frequency metrics (1.5s tick pushes a new snapshot)
- Action-driven state (playground responses, simulation controls)
- View state (current view, modal open/close)

We need a single source of truth so the sidebar's "live RPS" footer updates
when the metrics tick fires, without prop-drilling or manual event buses.

## Decision

Use Zustand. The store is defined in `src/lib/gateway/store.ts` as a single
`create<GatewayState>()` call. Components subscribe with selector functions
that return only the slice they care about, so a metrics tick that updates
`metrics` doesn't re-render the sidebar (which only reads `view`).

## Consequences

**Positive**

- ~50 lines of store code total — no reducers, no action types, no provider
  tree
- Selector-based subscriptions give us fine-grained re-render control for
  free
- The store is a plain object — easy to inspect from devtools, easy to test
- Works perfectly with the `useEffect`-driven simulation tick

**Negative**

- No built-in devtools time-travel like Redux Toolkit offers
- No middleware ecosystem (but we don't need one for this scale)
- Persisting state to localStorage requires manual wiring (we do this for
  the onboarding "completed" flag, which lives in its own useState)

## Alternatives considered

- **Redux Toolkit** — the gold standard for large apps, but adds
  `configureStore`, `createSlice`, `useSelector`, `useDispatch` boilerplate
  that's overkill for ~10 state fields.
- **React Context + useReducer** — works but causes re-render storms unless
  you split contexts, which fragments the state model.
- **Jotai/Recoil** — atom-based models are elegant but introduce a mental
  model shift. Zustand's "one store, many selectors" pattern is closer to
  what most React developers already know.

Zustand hits the sweet spot: Redux's single-store mental model without the
ceremony.
