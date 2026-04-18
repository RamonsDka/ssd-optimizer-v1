"use client";

import { LayoutGrid, List, Table, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export type ViewMode = 'grid' | 'list' | 'table' | 'compact';

interface ViewModeSelectorProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewModeSelector({ mode, onChange, className }: ViewModeSelectorProps) {
  const { t } = useLanguage();

  const modes: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
    { id: 'grid', icon: <LayoutGrid size={14} />, label: t("optimizer", "viewGrid") },
    { id: 'list', icon: <List size={14} />, label: t("optimizer", "viewList") },
    { id: 'table', icon: <Table size={14} />, label: t("optimizer", "viewTable") },
    { id: 'compact', icon: <Minimize2 size={14} />, label: t("optimizer", "viewCompact") },
  ];

  return (
    <div className={cn("flex items-center bg-surface-container-low border border-outline-variant/30 p-1", className)}>
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-all",
            mode === m.id
              ? "bg-primary text-on-primary font-bold"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          )}
          title={m.label}
        >
          {m.icon}
          <span className="hidden sm:inline">{m.label}</span>
        </button>
      ))}
    </div>
  );
}
