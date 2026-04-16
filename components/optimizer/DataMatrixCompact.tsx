"use client";

import { cn } from "@/lib/utils/cn";
import type { PhaseAssignment, Tier } from "@/types";
import { getPhaseLabel } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface DataMatrixCompactProps {
  phases: PhaseAssignment[];
  tier: Tier;
  onPhaseClick?: (assignment: PhaseAssignment) => void;
}

export default function DataMatrixCompact({ phases, tier, onPhaseClick }: DataMatrixCompactProps) {
  const { lang } = useLanguage();

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      {phases.map((assignment) => (
        <button
          key={assignment.phase}
          onClick={() => onPhaseClick?.(assignment)}
          title={`${getPhaseLabel(assignment.phase, lang)}: ${assignment.primary.name}`}
          className={cn(
            "flex flex-col items-center justify-center p-3 bg-surface-container-highest",
            "hover:bg-surface-container-high transition-colors text-center"
          )}
        >
          <div className="font-mono text-[9px] uppercase tracking-wider text-on-surface-variant truncate w-full">
            {getPhaseLabel(assignment.phase, lang)}
          </div>
          <div className="font-bold text-primary font-mono text-xs mt-1">
            {Math.round(assignment.score * 100)}%
          </div>
        </button>
      ))}
    </div>
  );
}
