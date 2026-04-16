"use client";

import { cn } from "@/lib/utils/cn";
import type { PhaseAssignment, Tier } from "@/types";
import { getPhaseLabel } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface DataMatrixListProps {
  phases: PhaseAssignment[];
  tier: Tier;
  onPhaseClick?: (assignment: PhaseAssignment) => void;
}

export default function DataMatrixList({ phases, tier, onPhaseClick }: DataMatrixListProps) {
  const { lang } = useLanguage();

  return (
    <div className="space-y-2">
      {phases.map((assignment) => (
        <button
          key={assignment.phase}
          onClick={() => onPhaseClick?.(assignment)}
          className={cn(
            "w-full flex items-center justify-between gap-4 p-4 bg-surface-container-highest",
            "text-left hover:bg-surface-container-high transition-colors border-l-2 border-transparent hover:border-primary"
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="font-mono text-xs text-on-surface-variant uppercase tracking-widest">
              {getPhaseLabel(assignment.phase, lang)}
            </div>
            <div className="font-mono text-sm text-on-surface truncate mt-1">
              {assignment.primary.name}
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="font-mono text-xs text-on-surface-variant/60">
              {assignment.primary.providerId}
            </div>
            <div className="w-16 text-right font-mono text-sm font-bold text-primary">
              {Math.round(assignment.score * 100)}%
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
