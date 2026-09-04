"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border/60 bg-card/40 backdrop-blur-sm",
        "shadow-[0_1px_0_0_oklch(1_0_0/0.04)_inset,0_8px_24px_-12px_oklch(0_0_0/0.4)]",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-border/60 px-5 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground/80">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

interface MetricLabelProps {
  children: ReactNode;
  className?: string;
}

export function MetricLabel({ children, className }: MetricLabelProps) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70",
        className,
      )}
    >
      {children}
    </span>
  );
}

interface MetricValueProps {
  children: ReactNode;
  className?: string;
}

export function MetricValue({ children, className }: MetricValueProps) {
  return (
    <span
      className={cn(
        "tnum font-mono text-2xl font-medium leading-none tracking-tight text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
