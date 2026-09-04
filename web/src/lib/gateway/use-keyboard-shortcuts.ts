"use client";

import { useEffect, useState } from "react";
import { useGatewayStore, type ViewId } from "@/lib/gateway/store";

const VIEW_KEYS: Record<string, ViewId> = {
  "1": "overview",
  "2": "playground",
  "3": "metrics",
  "4": "backends",
  "5": "logs",
  "6": "architecture",
};

export function useKeyboardShortcuts() {
  const setView = useGatewayStore((s) => s.setView);
  const probe = useGatewayStore((s) => s.probe);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isField =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }

      if (isField) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setCheatOpen(true);
        return;
      }

      if (VIEW_KEYS[e.key]) {
        e.preventDefault();
        setView(VIEW_KEYS[e.key]);
        return;
      }

      if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        void probe();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setView, probe]);

  return {
    cheatOpen,
    setCheatOpen,
    paletteOpen,
    setPaletteOpen,
  };
}

export const SHORTCUTS: Array<{
  keys: string[];
  description: string;
  group: "navigation" | "actions";
}> = [
  { keys: ["1"], description: "Перейти в Обзор", group: "navigation" },
  { keys: ["2"], description: "Перейти в Песочницу", group: "navigation" },
  { keys: ["3"], description: "Перейти в Метрики", group: "navigation" },
  { keys: ["4"], description: "Перейти в Бэкенды", group: "navigation" },
  { keys: ["5"], description: "Перейти в Логи", group: "navigation" },
  { keys: ["6"], description: "Перейти в Архитектуру", group: "navigation" },
  { keys: ["⌘", "K"], description: "Открыть командную палитру", group: "actions" },
  { keys: ["?"], description: "Показать горячие клавиши", group: "actions" },
  { keys: ["R"], description: "Перепроверить gateway", group: "actions" },
  { keys: ["Esc"], description: "Закрыть любой диалог", group: "actions" },
];
