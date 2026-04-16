"use client";

import { cn } from "@/lib/utils/cn";
import type { PhaseAssignment, Tier } from "@/types";
import { getPhaseLabel } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface DataMatrixTableProps {
  phases: PhaseAssignment[];
  tier: Tier;
  onPhaseClick?: (assignment: PhaseAssignment) => void;
}

export default function DataMatrixTable({ phases, tier, onPhaseClick }: DataMatrixTableProps) {
  const { lang } = useLanguage();

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-outline-variant/30">
            <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Phase</th>
            <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Model</th>
            <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Provider</th>
            <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant text-right">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {phases.map((assignment) => (
            <tr
              key={assignment.phase}
              onClick={() => onPhaseClick?.(assignment)}
              className="hover:bg-surface-container-high cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 font-mono text-xs text-on-surface">
                {getPhaseLabel(assignment.phase, lang)}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-on-surface">
                {assignment.primary.name}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">
                {assignment.primary.providerId}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-right font-bold text-primary">
                {Math.round(assignment.score * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
