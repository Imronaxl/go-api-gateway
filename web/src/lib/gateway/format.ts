export function formatNumber(n: number, fractionDigits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatCompact(n: number): string {
  if (n < 1000) return Math.round(n).toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}G`;
}

export function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 10) return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatRps(rps: number): string {
  if (rps < 10) return `${rps.toFixed(1)} rps`;
  return `${Math.round(rps)} rps`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTimeMs(ts: number): string {
  const base = new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${base}.${String(ts % 1000).padStart(3, "0")}`;
}

export function formatAgo(ts: number, now = Date.now()): string {
  const seconds = Math.floor((now - ts) / 1000);
  if (seconds < 1) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function shortId(prefix = ""): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}${time}${rand}`;
}

export function fakeTraceId(): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * 16)];
  return out;
}

export function statusLabel(status: number): string {
  if (status < 200) return "Informational";
  if (status < 300) return "Success";
  if (status < 400) return "Redirection";
  if (status < 500) return "Client Error";
  return "Server Error";
}

export function statusColor(status: number): string {
  if (status < 300) return "text-emerald-400";
  if (status < 400) return "text-cyan-400";
  if (status < 500) return "text-amber-400";
  return "text-rose-400";
}

export function levelColor(level: string): string {
  switch (level) {
    case "debug":
      return "text-slate-400";
    case "info":
      return "text-cyan-400";
    case "warn":
      return "text-amber-400";
    case "error":
      return "text-rose-400";
    default:
      return "text-slate-400";
  }
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
