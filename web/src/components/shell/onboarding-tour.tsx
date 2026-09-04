"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { useGatewayStore, type ViewId } from "@/lib/gateway/store";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "relay.onboarding.completed";

interface TourStep {
  target: string;
  title: string;
  body: string;
  view?: ViewId;
}

const STEPS: TourStep[] = [
  {
    target: '[data-tour="sidebar"]',
    title: "Welcome to Relay Control Plane",
    body: "This dashboard is the frontend companion to the go-api-gateway relay service. It speaks to the relay at :8080 and Prometheus at :9090 — and falls back to a built-in simulator when the backend isn't running. Let's take a quick tour.",
  },
  {
    target: '[data-tour="view-overview"]',
    title: "Overview",
    body: "The landing page. Live KPIs (RPS, p99 latency, error rate, circuit breaker state), a traffic chart, the middleware chain, and the backend pool. Use the 'Inject failure burst' button to watch the circuit breaker trip in real time.",
    view: "overview",
  },
  {
    target: '[data-tour="view-playground"]',
    title: "Playground",
    body: "Send real requests through the gateway. Pick a preset, hit Send, and inspect the per-stage timing waterfall — you can see exactly how many milliseconds each middleware stage adds on top of the backend response.",
    view: "playground",
  },
  {
    target: '[data-tour="view-metrics"]',
    title: "Metrics",
    body: "Prometheus-style charts: latency trend (p50/p95/p99), a latency histogram, status code distribution. Switch to 'live' mode in the top bar to scrape the real /metrics endpoint.",
    view: "metrics",
  },
  {
    target: '[data-tour="view-architecture"]',
    title: "Architecture",
    body: "A visual diagram of the middleware chain. Click the info dots next to any concept (circuit breaker, rate limiting, JWT) to open a written explainer — useful if you're new to these patterns.",
    view: "architecture",
  },
  {
    target: '[data-tour="hint-badge"]',
    title: "Keyboard shortcuts",
    body: "Press ⌘K (or Ctrl+K) anywhere to open the command palette. Press ? for the full cheat sheet. Numbers 1–6 jump between views. R re-probes the gateway.",
  },
];

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const setView = useGatewayStore((s) => s.setView);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = window.localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const id = setTimeout(() => setActive(true), 600);
      return () => clearTimeout(id);
    }
  }, []);

  const finish = (completed: boolean) => {
    setActive(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, completed ? "completed" : "skipped");
    }
  };

  const next = () => {
    if (step >= STEPS.length - 1) {
      finish(true);
      return;
    }
    const nextStep = step + 1;
    const target = STEPS[nextStep];
    if (target.view) setView(target.view);
    setStep(nextStep);
  };

  const prev = () => {
    if (step === 0) return;
    const prevStep = step - 1;
    const target = STEPS[prevStep];
    if (target.view) setView(target.view);
    setStep(prevStep);
  };

  if (!active) return null;

  const current = STEPS[step];

  return (
    <TourPopover
      step={current}
      stepNum={step}
      total={STEPS.length}
      onNext={next}
      onPrev={prev}
      onSkip={() => finish(false)}
    />
  );
}

function TourPopover({
  step,
  stepNum,
  total,
  onNext,
  onPrev,
  onSkip,
}: {
  step: TourStep;
  stepNum: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-6">
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-[2px]"
        onClick={onSkip}
        aria-hidden
      />

      <div className="relative w-full max-w-lg rounded-lg border border-cyan-500/30 bg-card/95 p-5 shadow-2xl">
        <button
          type="button"
          onClick={onSkip}
          className="absolute right-3 top-3 rounded p-1 text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground"
          aria-label="Skip tour"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-start gap-3">
          <div className="rounded-md bg-cyan-500/10 p-2 text-cyan-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="font-mono text-sm font-semibold text-foreground">
                {step.title}
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                {stepNum + 1} / {total}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {step.body}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i === stepNum ? "w-4 bg-cyan-400" : "w-1 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {stepNum > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrev}
                className="h-7 gap-1 font-mono text-[11px]"
              >
                <ChevronLeft className="h-3 w-3" />
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={onNext}
              className="h-7 gap-1 bg-cyan-500/90 font-mono text-[11px] text-slate-950 hover:bg-cyan-400"
            >
              {stepNum === total - 1 ? "Finish" : "Next"}
              {stepNum < total - 1 && <ChevronRight className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
