
import { test, expect, describe } from "bun:test";
import {
  formatNumber,
  formatCompact,
  formatMs,
  formatPercent,
  formatRps,
  formatTime,
  formatTimeMs,
  formatAgo,
  truncate,
  shortId,
  fakeTraceId,
  statusLabel,
  statusColor,
  levelColor,
  clamp,
} from "../format";

describe("formatNumber", () => {
  test("formats integers with thousands separators", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  test("respects fractionDigits", () => {
    expect(formatNumber(3.14159, 2)).toBe("3.14");
    expect(formatNumber(3.14159, 4)).toBe("3.1416");
  });
});

describe("formatCompact", () => {
  test("small numbers are returned as-is", () => {
    expect(formatCompact(0)).toBe("0");
    expect(formatCompact(42)).toBe("42");
    expect(formatCompact(999)).toBe("999");
  });

  test("thousands use k suffix", () => {
    expect(formatCompact(1000)).toBe("1.0k");
    expect(formatCompact(12500)).toBe("12.5k");
  });

  test("millions use M suffix", () => {
    expect(formatCompact(1_000_000)).toBe("1.00M");
    expect(formatCompact(2_500_000)).toBe("2.50M");
  });
});

describe("formatMs", () => {
  test("sub-millisecond uses microseconds", () => {
    expect(formatMs(0.5)).toBe("500µs");
    expect(formatMs(0.1)).toBe("100µs");
  });

  test("1-10ms uses two decimal places", () => {
    expect(formatMs(1)).toBe("1.00ms");
    
    expect(formatMs(5.555)).toBe("5.55ms");
    expect(formatMs(7.123)).toBe("7.12ms");
  });

  test("10-1000ms uses whole milliseconds", () => {
    expect(formatMs(50)).toBe("50ms");
    expect(formatMs(999)).toBe("999ms");
  });

  test("over 1 second uses seconds", () => {
    expect(formatMs(1000)).toBe("1.00s");
    expect(formatMs(2500)).toBe("2.50s");
  });
});

describe("formatPercent", () => {
  test("converts fraction to percentage", () => {
    expect(formatPercent(0.5)).toBe("50.0%");
    expect(formatPercent(0.123456, 2)).toBe("12.35%");
  });

  test("handles zero and one", () => {
    expect(formatPercent(0)).toBe("0.0%");
    expect(formatPercent(1)).toBe("100.0%");
  });
});

describe("formatRps", () => {
  test("under 10 uses one decimal", () => {
    expect(formatRps(5)).toBe("5.0 rps");
    expect(formatRps(9.99)).toBe("10.0 rps");
  });

  test("10+ uses whole number", () => {
    expect(formatRps(42)).toBe("42 rps");
    expect(formatRps(100.7)).toBe("101 rps");
  });
});

describe("formatTime", () => {
  test("returns HH:MM:SS in 24h format", () => {
    const ts = new Date("2025-01-01T12:34:56Z").getTime();
    const result = formatTime(ts);
    
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe("formatTimeMs", () => {
  test("appends milliseconds", () => {
    const ts = new Date("2025-01-01T12:34:56.123Z").getTime();
    const result = formatTimeMs(ts);
    expect(result).toMatch(/\.\d{3}$/);
  });
});

describe("formatAgo", () => {
  test("just now for < 1 second", () => {
    const now = Date.now();
    expect(formatAgo(now, now)).toBe("just now");
    expect(formatAgo(now - 500, now)).toBe("just now");
  });

  test("seconds", () => {
    const now = Date.now();
    expect(formatAgo(now - 30_000, now)).toBe("30s ago");
  });

  test("minutes", () => {
    const now = Date.now();
    expect(formatAgo(now - 120_000, now)).toBe("2m ago");
  });

  test("hours", () => {
    const now = Date.now();
    expect(formatAgo(now - 2 * 3600_000, now)).toBe("2h ago");
  });
});

describe("truncate", () => {
  test("returns original if shorter than max", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  test("adds ellipsis when truncated", () => {
    expect(truncate("hello world", 8)).toBe("hello w…");
  });
});

describe("shortId", () => {
  test("includes prefix", () => {
    expect(shortId("req_")).toMatch(/^req_/);
  });

  test("is non-empty without prefix", () => {
    expect(shortId().length).toBeGreaterThan(0);
  });
});

describe("fakeTraceId", () => {
  test("is 16 hex chars", () => {
    expect(fakeTraceId()).toMatch(/^[0-9a-f]{16}$/);
  });

  test("generates different values", () => {
    const a = fakeTraceId();
    const b = fakeTraceId();
    
    expect(a).not.toBe(b);
  });
});

describe("statusLabel", () => {
  test("2xx is Success", () => {
    expect(statusLabel(200)).toBe("Success");
    expect(statusLabel(204)).toBe("Success");
  });
  test("4xx is Client Error", () => {
    expect(statusLabel(404)).toBe("Client Error");
  });
  test("5xx is Server Error", () => {
    expect(statusLabel(500)).toBe("Server Error");
  });
});

describe("statusColor", () => {
  test("2xx is emerald", () => {
    expect(statusColor(200)).toBe("text-emerald-400");
  });
  test("4xx is amber", () => {
    expect(statusColor(404)).toBe("text-amber-400");
  });
  test("5xx is rose", () => {
    expect(statusColor(500)).toBe("text-rose-400");
  });
});

describe("levelColor", () => {
  test("debug is slate", () => {
    expect(levelColor("debug")).toBe("text-slate-400");
  });
  test("info is cyan", () => {
    expect(levelColor("info")).toBe("text-cyan-400");
  });
  test("warn is amber", () => {
    expect(levelColor("warn")).toBe("text-amber-400");
  });
  test("error is rose", () => {
    expect(levelColor("error")).toBe("text-rose-400");
  });
});

describe("clamp", () => {
  test("returns value when in range", () => {
    expect(clamp(5, 1, 10)).toBe(5);
  });
  test("clamps to minimum", () => {
    expect(clamp(-5, 1, 10)).toBe(1);
  });
  test("clamps to maximum", () => {
    expect(clamp(15, 1, 10)).toBe(10);
  });
});
