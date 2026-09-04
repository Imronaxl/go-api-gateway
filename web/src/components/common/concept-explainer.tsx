"use client";

import { useState, createContext, useContext } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CircuitBoard, Gauge, Shield, Network, Workflow, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ConceptId =
  | "circuit-breaker"
  | "rate-limiting"
  | "jwt-auth"
  | "load-balancing"
  | "tracing"
  | "middleware-chain";

interface Concept {
  id: ConceptId;
  title: string;
  icon: LucideIcon;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
}

const CONCEPTS: Record<ConceptId, Concept> = {
  "circuit-breaker": {
    id: "circuit-breaker",
    title: "Circuit Breaker",
    icon: CircuitBoard,
    summary:
      "A stability pattern that stops calling a failing backend, giving it time to recover instead of piling on more requests.",
    sections: [
      {
        heading: "The problem",
        body: "When a backend becomes slow or starts returning errors, every request that hits it consumes a connection, holds a goroutine, and makes the situation worse. In a high-traffic system this can take down the entire gateway in seconds — a phenomenon called 'cascading failure'.",
      },
      {
        heading: "The three states",
        body: "Closed: requests flow normally. The breaker counts consecutive failures. Open: when failures exceed a threshold, the breaker 'trips' — every request is short-circuited with a 503 immediately, without touching the backend. Half-open: after a cooldown period, a small number of probe requests are allowed through; if they succeed, the breaker closes again.",
      },
      {
        heading: "In this gateway",
        body: "Configured with MaxFailures=5, Timeout=30s, HalfOpenLimit=3. So after 5 consecutive failures the breaker opens for 30 seconds, then allows 3 probe requests. The implementation lives in internal/middleware/circuitbreaker and uses a sync.RWMutex for state transitions.",
      },
      {
        heading: "Worth knowing",
        body: "The classic reference is Martin Fowler's article on the pattern, and the Netflix Hystrix library which popularised it in the JVM world. Modern alternatives include resilience4j (Java), Polly (.NET), and go-resiliency (Go).",
      },
    ],
  },
  "rate-limiting": {
    id: "rate-limiting",
    title: "Rate Limiting",
    icon: Gauge,
    summary:
      "Cap on how many requests a single client can make per second, protecting backends from abusive callers.",
    sections: [
      {
        heading: "The problem",
        body: "A single misbehaving client — a buggy retry loop, a script, or an attacker — can starve other users by consuming all gateway capacity. Rate limiting enforces fairness and protects the downstream services.",
      },
      {
        heading: "Token bucket",
        body: "The algorithm used here. Each client has a bucket that holds up to 'burst' tokens. Every request consumes one token. Tokens refill at a fixed 'rate' per second up to the burst capacity. If the bucket is empty, the request is rejected with 429 and a Retry-After header. The bucket smooths short bursts while still capping sustained throughput.",
      },
      {
        heading: "In this gateway",
        body: "Configured with rate=100 tokens/sec, burst=50. Per-client (keyed by RemoteAddr). The limiter is created lazily per client and stored in a map guarded by a sync.RWMutex. Implemented in internal/middleware/ratelimit using golang.org/x/time/rate.",
      },
      {
        heading: "Other algorithms",
        body: "Fixed window (simple but allows bursts at boundaries), sliding window (smoother but more memory), leaky bucket (constant output rate). Token bucket is the most common choice for API gateways because it allows bursts without long-term overage.",
      },
    ],
  },
  "jwt-auth": {
    id: "jwt-auth",
    title: "JWT Authentication",
    icon: Shield,
    summary:
      "Stateless token-based authentication. The gateway validates a bearer token on every request without consulting a session store.",
    sections: [
      {
        heading: "What is a JWT",
        body: "A JSON Web Token is a compact, URL-safe string with three base64-encoded parts separated by dots: header.payload.signature. The header says which algorithm was used. The payload contains claims (sub, name, iat, exp). The signature proves the issuer holds the secret key.",
      },
      {
        heading: "Why stateless",
        body: "Traditional session auth stores a session id in a cookie and looks it up in a database or Redis on every request. JWTs encode the claims directly in the token — the server just verifies the signature and reads the claims. No session store means horizontal scaling is trivial.",
      },
      {
        heading: "In this gateway",
        body: "The middleware reads the Authorization header, expects the 'Bearer <token>' format, and currently treats any non-empty token as valid. A real implementation would call jwt.Parse with the configured SecretKey and reject expired or malformed tokens. Configured via RELAY_AUTH_SECRET env var.",
      },
      {
        heading: "Trade-offs",
        body: "JWTs can't be easily revoked (no server-side state), so they should have short expirations. Refresh tokens solve this by being long-lived but stored server-side. For high-security apps, add a revocation list or use short-lived access tokens plus rotating refresh tokens.",
      },
    ],
  },
  "load-balancing": {
    id: "load-balancing",
    title: "Round-Robin Load Balancing",
    icon: Network,
    summary:
      "Distributing requests across multiple backend instances so no single one becomes a bottleneck.",
    sections: [
      {
        heading: "Why balance",
        body: "A single backend process has finite CPU, memory, and connection slots. Running several instances behind a load balancer multiplies capacity and provides redundancy — if one crashes, the others keep serving.",
      },
      {
        heading: "Round-robin",
        body: "The simplest non-random strategy: maintain a counter, send request N to backend N % len(pool). Each backend gets an equal share of traffic. This implementation skips backends whose Alive flag is false, so a crashed instance is automatically excluded.",
      },
      {
        heading: "In this gateway",
        body: "Implemented in internal/proxy/proxy.go. The LoadBalancer holds a list of Backend structs and an atomic.Uint32 counter. RoundRobinStrategy increments the counter atomically and indexes into the pool. Selection happens before the request is dispatched, so the breaker and rate limiter can short-circuit earlier.",
      },
      {
        heading: "Other strategies",
        body: "Least connections (pick the backend with fewest in-flight requests), weighted round-robin (give more capacity to bigger instances), consistent hashing (sticky sessions — same client always goes to the same backend), and latency-aware (avoid slow backends).",
      },
    ],
  },
  tracing: {
    id: "tracing",
    title: "OpenTelemetry Tracing",
    icon: Workflow,
    summary:
      "Distributed tracing lets you follow a single request as it crosses process boundaries, revealing where time is spent.",
    sections: [
      {
        heading: "Logs vs metrics vs traces",
        body: "Logs tell you what happened at a point. Metrics tell you how often it happens, in aggregate. Traces tell you what happened to a *specific request* across every service it touched. For debugging latency in a microservice system, traces are essential.",
      },
      {
        heading: "How tracing works",
        body: "Each request gets a trace id. As it crosses service boundaries, the trace id is propagated via headers (W3C Trace Context). Each service creates a 'span' — a named, timed unit of work — and links it to the parent span. The result is a tree of spans showing the full path.",
      },
      {
        heading: "In this gateway",
        body: "internal/middleware/tracing uses the OpenTelemetry SDK to start a server-span for every request, extracting upstream context from incoming headers. Spans are exported via OTLP/gRPC to a collector (port 4317 in docker-compose). From the collector they can be routed to Jaeger, Tempo, or any OTLP-compatible backend.",
      },
      {
        heading: "Why it matters",
        body: "Without tracing, a 500ms request that crosses three services is a mystery — which service was slow? With tracing, you can see the exact span that took 480ms and know immediately. It's the difference between guessing and knowing.",
      },
    ],
  },
  "middleware-chain": {
    id: "middleware-chain",
    title: "Middleware Chain",
    icon: BookOpen,
    summary:
      "Composing cross-cutting concerns (auth, logging, rate limit) as a chain of wrappers around a base handler.",
    sections: [
      {
        heading: "The pattern",
        body: "Each middleware is a function that takes an http.Handler and returns a new http.Handler that wraps it. They can run code before calling next, after, or short-circuit entirely. Chaining several together produces an onion — the outermost runs first on the way in and last on the way out.",
      },
      {
        heading: "Order matters",
        body: "In this gateway the order is logging → tracing → auth → ratelimit → handler. Logging wraps everything so it sees the total duration. Tracing needs to start a span before any work happens. Auth runs before rate limit so unauthenticated requests are rejected cheaply. Rate limit is the last gate before the request hits the proxy.",
      },
      {
        heading: "In this gateway",
        body: "Implemented in cmd/relay/main.go with a manual composition: logging(tracing(auth(ratelimit(handler)))). Each middleware lives in its own package under internal/middleware and exports a constructor that takes its config and returns the wrapper function.",
      },
      {
        heading: "Alternatives",
        body: "Some frameworks (Express, Koa, Echo) use an explicit array of middlewares executed in order. Go's net/http prefers function composition because it has zero allocations per request beyond the closure capture. Either way, the conceptual model is the same: a pipeline of transformers.",
      },
    ],
  },
};

interface ExplainerContextValue {
  open: (id: ConceptId) => void;
}

const ExplainerContext = createContext<ExplainerContextValue | null>(null);

export function ConceptExplainerProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ConceptId | null>(null);

  return (
    <ExplainerContext.Provider value={{ open: setActive }}>
      {children}
      <ConceptExplainerModal id={active} onClose={() => setActive(null)} />
    </ExplainerContext.Provider>
  );
}

export function useConceptExplainer() {
  const ctx = useContext(ExplainerContext);
  if (!ctx) {
    throw new Error("useConceptExplainer must be used inside ConceptExplainerProvider");
  }
  return ctx;
}

function ConceptExplainerModal({
  id,
  onClose,
}: {
  id: ConceptId | null;
  onClose: () => void;
}) {
  const concept = id ? CONCEPTS[id] : null;

  return (
    <Dialog open={concept !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl gap-4 border-border/60 bg-card/95">
        {concept && <ConceptBody concept={concept} />}
      </DialogContent>
    </Dialog>
  );
}

function ConceptBody({ concept }: { concept: Concept }) {
  const Icon = concept.icon;
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-cyan-500/10 p-2 text-cyan-300">
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <DialogTitle className="font-mono text-base">{concept.title}</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              {concept.summary}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
        {concept.sections.map((section, idx) => (
          <section key={idx}>
            <h3 className="mb-1 font-mono text-[11px] uppercase tracking-wider text-cyan-300/80">
              {section.heading}
            </h3>
            <p className="text-sm leading-relaxed text-foreground/85">{section.body}</p>
          </section>
        ))}
      </div>
    </>
  );
}

export function InfoDot({ concept, className }: { concept: ConceptId; className?: string }) {
  const { open } = useConceptExplainer();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        open(concept);
      }}
      className={
        "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-foreground/40 " +
        "text-muted-foreground/60 transition-colors hover:border-cyan-500/60 hover:text-cyan-300 " +
        (className ?? "")
      }
      aria-label={`Explain ${concept}`}
      title="Click to learn more"
    >
      <span className="font-mono text-[8px] leading-none">i</span>
    </button>
  );
}
