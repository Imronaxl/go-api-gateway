# Architecture Decision Records

This directory contains ADRs for the Relay Control Plane frontend — short
documents capturing *why* a particular architectural choice was made. The
format is based on Michael Nygard's [original
article](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
and the popularised [ADR-tools
layout](https://github.com/joelparkerhenderson/architecture-decision-record).

## Why ADRs?

Code tells you *what* a system does. ADRs tell you *why* the team chose to do
it that way, what alternatives were considered, and what trade-offs were
accepted. They're especially useful for:

- New team members getting up to speed quickly
- Future-you, six months later, wondering "why did we use Zustand here?"
- Performance reviews and architecture audits

## Index

| #    | Title                                       | Status   |
| ---- | ------------------------------------------- | -------- |
| 0001 | [Single-route SPA with internal view switch](0001-single-route-spa.md) | Accepted |
| 0002 | [Zustand over Redux/Context for global state](0002-zustand-over-redux.md) | Accepted |
| 0003 | [Built-in simulation engine for offline preview](0003-simulation-engine.md) | Accepted |
| 0004 | [Dark theme as the default](0004-dark-theme-default.md) | Accepted |
| 0005 | [TypeScript domain types mirror Go structs](0005-types-mirror-go-structs.md) | Accepted |

## Format

Each ADR is a single Markdown file numbered `NNNN-short-title.md` containing:

- **Title** + 1-line summary
- **Status** — Proposed / Accepted / Deprecated / Superseded
- **Context** — the problem and constraints
- **Decision** — what we chose
- **Consequences** — what we gained and what we gave up
- **Alternatives considered** — what else was on the table
