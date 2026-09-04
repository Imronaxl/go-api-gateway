# ADR-0004: Dark theme as the default

**Status:** Accepted

## Summary

The dashboard uses a dark, terminal-inspired theme by default. The `<html>`
element has the `dark` class hard-coded in `layout.tsx`, and no light-mode
toggle is exposed in the UI.

## Context

The dashboard is an SRE / platform engineering tool — the kind of thing
someone stares at on a wall-mounted display in an ops room, or keeps open
in a side monitor all day. The audience is technical and expects
observability tooling to look like Grafana, Datadog, or the Prometheus UI —
all dark by default.

## Decision

Use a dark OKLCH palette built on Tailwind CSS 4 custom properties, with:

- **Background**: deep slate (`oklch(0.16 0.012 240)`) with a subtle 24px
  dot grid for depth
- **Primary accent**: cyan (`oklch(0.78 0.15 195)`) — evokes "active
  request" without the baggage of the default Tailwind blue
- **Status colors**: emerald (healthy), amber (degraded), rose (errors) —
  the standard SRE convention
- **Typography**: Geist Sans for body, Geist Mono for everything numeric or
  code-like, with `tabular-nums` enabled globally so columns align

Light mode tokens are defined in `globals.css` for completeness but the
`<html>` element is hard-coded to `dark` so the theme never flips.

## Consequences

**Positive**

- Matches user expectations for the domain
- Lower eye strain for long sessions
- Glow effects (used on status dots, active nodes) only work on dark
  backgrounds — they're a key part of the visual language
- Charts look better — the cyan/emerald/amber palette pops against slate

**Negative**

- Accessibility: dark themes can reduce contrast for users with certain
  visual impairments. Mitigated by ensuring all text meets WCAG AA
  contrast against its background.
- Printing is broken (but nobody prints a live dashboard)
- Can't be overridden by the user (acceptable for a portfolio piece; in a
  real product we'd add a toggle)

## Alternatives considered

- **Light theme by default** — feels wrong for an SRE tool. Most
  comparable products default to dark.
- **Follow system preference via `next-themes`** — adds a flash of
  incorrect theme on first paint, and the dot-grid background doesn't
  translate well to light mode.
- **Add a manual toggle** — scope creep for a portfolio piece. The dark
  theme is the brand.

The dark theme isn't just an aesthetic choice — it's a domain signal. When
a reviewer opens the dashboard and sees a terminal-inspired dark UI, they
immediately know "this person has used real SRE tools".
