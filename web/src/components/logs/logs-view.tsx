"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Filter,
  Pause,
  Play,
  Trash2,
  Download,
  ScrollText,
} from "lucide-react";
import { useGatewayStore } from "@/lib/gateway/store";
import { Panel, MetricLabel } from "@/components/common/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { LogLevel } from "@/lib/gateway/types";
import { formatTimeMs, levelColor } from "@/lib/gateway/format";

const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

export function LogsView() {
  const logs = useGatewayStore((s) => s.logs);
  const resetSim = useGatewayStore((s) => s.resetSim);

  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [search, setSearch] = useState("");
  const [paused, setPaused] = useState(false);

  
  const [frozen, setFrozen] = useState<typeof logs | null>(null);
  const visibleLogs = paused ? (frozen ?? logs) : logs;

  const filtered = useMemo(() => {
    let result = visibleLogs;
    if (levelFilter !== "all") {
      result = result.filter((l) => l.level === levelFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          JSON.stringify(l.fields).toLowerCase().includes(q),
      );
    }
    return result;
  }, [visibleLogs, levelFilter, search]);

  const handlePause = () => {
    if (!paused) {
      
      setFrozen(logs);
      setPaused(true);
    } else {
      
      setFrozen(null);
      setPaused(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relay-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col gap-3 p-6">
      {}
      <Panel bodyClassName="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            <Filter className="h-3 w-3" />
            Фильтры
          </div>
          <Select
            value={levelFilter}
            onValueChange={(v: LogLevel | "all") => setLevelFilter(v)}
          >
            <SelectTrigger className="h-8 w-32 font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-mono text-xs">все уровни</SelectItem>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l} className="font-mono text-xs">
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-1 items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2">
            <Search className="h-3 w-3 text-muted-foreground/60" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="поиск по сообщению или полям…"
              className="h-8 border-0 bg-transparent px-0 font-mono text-xs shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
              className={cn(
                "h-8 gap-2 font-mono text-xs",
                paused && "border-amber-500/40 text-amber-300",
              )}
            >
              {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {paused ? "Продолжить" : "Пауза"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-8 gap-2 font-mono text-xs"
            >
              <Download className="h-3 w-3" />
              Экспорт
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetSim}
              className="h-8 gap-2 font-mono text-xs"
            >
              <Trash2 className="h-3 w-3" />
              Очистить
            </Button>
          </div>
        </div>
      </Panel>

      {}
      <Panel
        title="Поток логов"
        description="JSON-вывод slog, новые сверху"
        actions={
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
            <span>{filtered.length} показано</span>
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  paused ? "bg-amber-400" : "bg-emerald-400 pulse-ring",
                )}
              />
              {paused ? "пауза" : "стримится"}
            </span>
          </div>
        }
        bodyClassName="p-0"
        className="flex-1"
      >
        <div className="h-[calc(100vh-280px)] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground/50">
              <ScrollText className="h-6 w-6" />
              <p className="font-mono text-xs">Нет записей, соответствующих текущим фильтрам</p>
            </div>
          ) : (
            <table className="w-full text-left font-mono text-[11px]">
              <tbody>
                {filtered.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                  >
                    <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground/60 tnum">
                      {formatTimeMs(log.ts)}
                    </td>
                    <td className={cn("w-16 px-1 py-1.5 uppercase", levelColor(log.level))}>
                      {log.level}
                    </td>
                    <td className="px-3 py-1.5 text-foreground">{log.message}</td>
                    <td className="px-3 py-1.5 text-muted-foreground/70">
                      {Object.entries(log.fields).map(([k, v]) => (
                        <span key={k} className="mr-3">
                          <span className="text-cyan-300/80">{k}</span>
                          <span className="text-muted-foreground/40">=</span>
                          <span className="text-foreground/80">
                            {typeof v === "string" ? v : JSON.stringify(v)}
                          </span>
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}
