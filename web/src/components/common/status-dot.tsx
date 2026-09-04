"use client";

import { cn } from "@/lib/utils";

type Tone = "emerald" | "amber" | "rose" | "cyan" | "slate";

const TONE_MAP: Record<Tone, { dot: string; glow: string; text: string }> = {
  emerald: { dot: "bg-emerald-400", glow: "glow-emerald", text: "text-emerald-400" },
  amber: { dot: "bg-amber-400", glow: "glow-amber", text: "text-amber-400" },
  rose: { dot: "bg-rose-400", glow: "glow-rose", text: "text-rose-400" },
  cyan: { dot: "bg-cyan-400", glow: "glow-cyan", text: "text-cyan-400" },
  slate: { dot: "bg-slate-500", glow: "", text: "text-slate-400" },
};

interface StatusDotProps {
  tone: Tone;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StatusDot({
  tone,
  pulse = false,
  size = "md",
  className,
}: StatusDotProps) {
  const t = TONE_MAP[tone];
  const sizes = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-2.5 w-2.5",
  };
  return (
    <span
      className={cn(
        "inline-block rounded-full",
        sizes[size],
        t.dot,
        pulse && "pulse-ring",
        t.glow,
        className,
      )}
      aria-hidden
    />
  );
}

interface BadgeProps {
  tone: Tone;
  label: string;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ tone, label, pulse = false, className }: BadgeProps) {
  const t = TONE_MAP[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        t.text,
        className,
      )}
    >
      <StatusDot tone={tone} pulse={pulse} size="sm" />
      {label}
    </span>
  );
}
