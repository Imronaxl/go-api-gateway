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
    title: "Добро пожаловать в Relay Control Plane",
    body: "Этот дашборд — фронтенд-компаньон к сервису go-api-gateway. Он обращается к relay на :8080 и к Prometheus на :9090, а при недоступности бэкенда переключается на встроенный симулятор. Пройдёмся коротко.",
  },
  {
    target: '[data-tour="view-overview"]',
    title: "Обзор",
    body: "Главная страница. Живые KPI (RPS, p99-латентность, error rate, состояние circuit breaker), график трафика, цепочка middleware и пул бэкендов. Кнопка «Инжектить всплеск ошибок» позволяет увидеть, как circuit breaker срабатывает в реальном времени.",
    view: "overview",
  },
  {
    target: '[data-tour="view-playground"]',
    title: "Песочница",
    body: "Отправляйте реальные запросы через gateway. Выберите пресет, нажмите «Отправить» и изучите per-stage timing waterfall — видно, сколько миллисекунд добавляет каждая стадия middleware поверх ответа бэкенда.",
    view: "playground",
  },
  {
    target: '[data-tour="view-metrics"]',
    title: "Метрики",
    body: "Графики в стиле Prometheus: тренд латентности (p50/p95/p99), гистограмма латентности, распределение статус-кодов. Переключитесь в режим «live» в верхней панели, чтобы скрапить реальный /metrics endpoint.",
    view: "metrics",
  },
  {
    target: '[data-tour="view-architecture"]',
    title: "Архитектура",
    body: "Визуальная диаграмма цепочки middleware. Кликните по info-точкам рядом с любым понятием (circuit breaker, rate limiting, JWT), чтобы открыть письменное объяснение паттерна — пригодится, если эти паттерны для вас новые.",
    view: "architecture",
  },
  {
    target: '[data-tour="hint-badge"]',
    title: "Горячие клавиши",
    body: "Нажмите ⌘K (или Ctrl+K) где угодно, чтобы открыть командную палитру. Нажмите ? для полной шпаргалки. Цифры 1–6 переключают разделы. R — перепроверить gateway.",
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
          aria-label="Пропустить тур"
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
                Назад
              </Button>
            )}
            <Button
              size="sm"
              onClick={onNext}
              className="h-7 gap-1 bg-cyan-500/90 font-mono text-[11px] text-slate-950 hover:bg-cyan-400"
            >
              {stepNum === total - 1 ? "Завершить" : "Далее"}
              {stepNum < total - 1 && <ChevronRight className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
