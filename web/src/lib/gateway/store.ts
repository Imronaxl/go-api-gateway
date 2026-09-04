"use client";

import { create } from "zustand";
import {
  DEFAULT_GATEWAY_CONFIG,
  type Backend,
  type CircuitBreakerStatus,
  type ConnectionStatus,
  type GatewayConfig,
  type GatewayMode,
  type LogEntry,
  type MetricSnapshot,
  type PlaygroundRequest,
  type PlaygroundResponse,
  type RecentRequest,
} from "./types";
import {
  tick,
  simulatePlaygroundRequest,
  resetSimulation,
  forceCircuitBreakerState as simForceCb,
  toggleBackend as simToggleBackend,
  injectFailureBurst as simInjectFailures,
} from "./mock-engine";
import {
  probeGateway,
  sendLiveRequest,
  fetchPrometheusMetrics,
  type ParsedMetrics,
} from "./client";

export type ViewId =
  | "overview"
  | "playground"
  | "metrics"
  | "backends"
  | "logs"
  | "architecture";

interface GatewayState {
  config: GatewayConfig;
  view: ViewId;

  metrics: MetricSnapshot | null;
  metricsHistory: MetricSnapshot[];
  backends: Backend[];
  circuitBreaker: CircuitBreakerStatus;
  recent: RecentRequest[];
  logs: LogEntry[];

  connection: ConnectionStatus;
  probeLatencyMs: number | null;
  effectiveMode: GatewayMode;
  prometheus: ParsedMetrics | null;

  lastResponse: PlaygroundResponse | null;
  responseHistory: PlaygroundResponse[];
  sendingRequest: boolean;

  setView: (v: ViewId) => void;
  updateConfig: (patch: Partial<GatewayConfig>) => void;
  setMode: (m: GatewayMode) => void;

  runTick: () => void;
  probe: () => Promise<void>;
  sendRequest: (req: PlaygroundRequest) => Promise<void>;
  resetSim: () => void;
  forceCb: (target: "closed" | "open" | "half-open") => void;
  toggleBackend: (id: string) => void;
  injectFailures: (count?: number) => void;
}

export const useGatewayStore = create<GatewayState>((set, get) => ({
  config: { ...DEFAULT_GATEWAY_CONFIG },
  view: "overview",

  metrics: null,
  metricsHistory: [],
  backends: [],
  circuitBreaker: {
    state: "closed",
    failures: 0,
    successes: 0,
    msSinceLastFailure: 0,
    config: DEFAULT_GATEWAY_CONFIG.circuitBreaker,
  },
  recent: [],
  logs: [],

  connection: "disconnected",
  probeLatencyMs: null,
  effectiveMode: "simulated",
  prometheus: null,

  lastResponse: null,
  responseHistory: [],
  sendingRequest: false,

  setView: (v) => set({ view: v }),

  updateConfig: (patch) =>
    set((s) => ({
      config: { ...s.config, ...patch },
      circuitBreaker: {
        ...s.circuitBreaker,
        config: patch.circuitBreaker ?? s.circuitBreaker.config,
      },
    })),

  setMode: (m) =>
    set((s) => ({ config: { ...s.config, mode: m } })),

  runTick: () => {
    const cfg = get().config;

    if (cfg.mode === "live" && get().connection === "connected") return;

    const result = tick(cfg);
    set({
      metrics: result.snapshot,
      metricsHistory: [
        ...get().metricsHistory,
        result.snapshot,
      ].slice(-60),
      backends: result.backends,
      circuitBreaker: result.circuitBreaker,
      recent: result.recent,
      logs: result.logs,
      effectiveMode: "simulated",
    });
  },

  probe: async () => {
    const cfg = get().config;
    if (cfg.mode === "simulated") {
      set({ connection: "disconnected", effectiveMode: "simulated" });
      return;
    }
    const result = await probeGateway(cfg);
    if (result.reachable) {
      const prom = await fetchPrometheusMetrics(cfg);
      set({
        connection: result.latencyMs > 500 ? "degraded" : "connected",
        probeLatencyMs: result.latencyMs,
        effectiveMode: "live",
        prometheus: prom,
      });
    } else {
      set({
        connection: "disconnected",
        effectiveMode: cfg.mode === "auto" ? "simulated" : "live",
      });
    }
  },

  sendRequest: async (req) => {
    set({ sendingRequest: true });
    const cfg = get().config;
    try {
      let res: PlaygroundResponse;
      if (cfg.mode === "live" || (cfg.mode === "auto" && get().connection === "connected")) {
        res = await sendLiveRequest(req, cfg);
      } else {
        res = simulatePlaygroundRequest(req, cfg);
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 400));
      }
      set((s) => ({
        lastResponse: res,
        responseHistory: [res, ...s.responseHistory].slice(0, 20),
        sendingRequest: false,
      }));
    } catch (err) {
      set({ sendingRequest: false });
      throw err;
    }
  },

  resetSim: () => {
    resetSimulation();
    set({
      metrics: null,
      metricsHistory: [],
      recent: [],
      logs: [],
    });
    get().runTick();
  },

  forceCb: (target) => {
    simForceCb(target);
    get().runTick();
  },

  toggleBackend: (id) => {
    simToggleBackend(id);
    get().runTick();
  },

  injectFailures: (count = 6) => {
    simInjectFailures(count);
    get().runTick();
  },
}));

export function useView() {
  return useGatewayStore((s) => s.view);
}

export function useConnection() {
  return useGatewayStore((s) => ({
    connection: s.connection,
    effectiveMode: s.effectiveMode,
    probeLatencyMs: s.probeLatencyMs,
  }));
}
