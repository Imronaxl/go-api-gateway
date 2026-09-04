"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SHORTCUTS } from "@/lib/gateway/use-keyboard-shortcuts";
import { cn } from "@/lib/utils";

interface CheatSheetDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CheatSheetDialog({ open, onOpenChange }: CheatSheetDialogProps) {
  const groups = ["navigation", "actions"] as const;
  const groupLabels: Record<string, string> = {
    navigation: "навигация",
    actions: "действия",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4 border-border/60 bg-card/95">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">Горячие клавиши</DialogTitle>
          <DialogDescription className="text-xs">
            Дашборд полностью управляется с клавиатуры. Нажмите{" "}
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">?</kbd>{" "}
            где угодно, чтобы снова открыть эту шпаргалку.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group}>
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                {groupLabels[group]}
              </h3>
              <div className="space-y-1">
                {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                  <div
                    key={s.description}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/40"
                  >
                    <span className="text-xs text-foreground/90">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className={cn(
                            "rounded border border-border/60 bg-muted/60 px-1.5 py-0.5",
                            "font-mono text-[10px] text-foreground/80 shadow-[0_1px_0_0_oklch(0_0_0/0.4)]",
                          )}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
