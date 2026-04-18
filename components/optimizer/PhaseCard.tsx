"use client";

// ─── PhaseCard ────────────────────────────────────────────────────────────────
// Displays a single SDD phase assignment: primary model + fallbacks dropdown.

import { useState } from "react";
import { ChevronDown, AlertTriangle, Bot, Layers } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import ModelDetailModal from "./ModelDetailModal";
import type { PhaseAssignment, ModelRecord } from "@/types";

// ─── Phase → icon label mapping ───────────────────────────────────────────────

const PHASE_INDEX: Record<string, string> = {
  "sdd-explore":  "P-00",
  "sdd-propose":  "P-01",
  "sdd-spec":     "P-02",
  "sdd-design":   "P-03",
  "sdd-tasks":    "P-04",
  "sdd-apply":    "P-05",
  "sdd-verify":   "P-06",
  "sdd-archive":  "P-07",
  "sdd-init":     "P-08",
  "sdd-onboard":  "P-09",
};

/**
 * Get phase index label. For custom phases, returns "C-XX" format.
 */
function getPhaseIndex(phase: string): string {
  if (phase in PHASE_INDEX) {
    return PHASE_INDEX[phase];
  }
  // Custom phase: generate index based on hash
  const hash = phase.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `C-${String(hash % 100).padStart(2, '0')}`;
}

interface PhaseCardProps {
  assignment: PhaseAssignment;
  /** Color variant driven by the active profile tier */
  accentTier: "PREMIUM" | "BALANCED" | "ECONOMIC";
  /** Show loading skeleton */
  loading?: boolean;
  /** Called when the user clicks to view phase detail roster */
  onPhaseClick?: (assignment: PhaseAssignment) => void;
}

export default function PhaseCard({ assignment, accentTier, loading = false, onPhaseClick }: PhaseCardProps) {
  const [open, setOpen] = useState(true); // Start with fallbacks expanded by default
  const [selectedModel, setSelectedModel] = useState<ModelRecord | null>(null);
  const { t } = useLanguage();

  if (loading) {
    return <PhaseCardSkeleton />;
  }

  const { phase, phaseLabel, primary, fallbacks, score, warnings, reason, aiConfidence } = assignment;
  const phaseId = getPhaseIndex(phase);
  const scorePct = Math.round(score * 100);
  const hasWarnings = warnings.length > 0;

  const accentTextClass =
    accentTier === "PREMIUM"
      ? "text-secondary"
      : accentTier === "BALANCED"
      ? "text-primary"
      : "text-on-surface-variant";

  const accentBgClass =
    accentTier === "PREMIUM"
      ? "bg-secondary"
      : accentTier === "BALANCED"
      ? "bg-primary"
      : "bg-outline-variant";

  // Full model name for the card title (V2 fix: multiline)
  const shortModelName = primary.name;

  // Handler for clicking on model cells (primary or fallbacks)
  const handleModelClick = (model: ModelRecord) => {
    // Only pass reasoning if it's the primary model, 
    // fallbacks might need specific reasoning if available, 
    // but primary is the safe bet for now.
    setSelectedModel(model);
  };

  const closeModal = () => {
    setSelectedModel(null);
  };

  return (
    <>
      <div
        className={cn(
          "bg-surface-container-low flex flex-col gap-4 group transition-colors relative",
          hasWarnings && "border-l-2 border-error/40",
          "hover:bg-surface-container"
        )}
      >
      {/* Header row */}
      <div className="p-6 pb-0 flex justify-between items-start">
        <span className={cn("text-[10px] font-mono", accentTextClass, "opacity-60")}>
          {phaseId}
        </span>
        <div
          className={cn(
            "w-2 h-2 transition-colors",
            accentBgClass,
            "opacity-20 group-hover:opacity-100"
          )}
        />
      </div>

      {/* Phase label + roster trigger */}
      <div className="px-6 flex items-center justify-between">
        <h4 className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
          {phaseLabel}
        </h4>
        {onPhaseClick && (
          <button
            onClick={() => onPhaseClick(assignment)}
            className={cn(
              "flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest",
              "text-on-surface-variant/40 hover:text-primary transition-colors"
            )}
            aria-label={`${t("optimizer", "roster")} — ${phaseLabel}`}
            title={t("optimizer", "rosterTooltip")}
          >
            <Layers size={10} />
            {t("optimizer", "rosterLabel")}
          </button>
        )}
      </div>

      {/* Primary model name */}
      <div className="px-6">
        <div
          className={cn(
            "font-mono text-lg font-bold text-on-surface transition-colors cursor-pointer break-words leading-tight hyphens-auto",
            `group-hover:${accentTextClass}`
          )}
          title={primary.name}
          onClick={() => handleModelClick(primary)}
        >
          {shortModelName}
        </div>
        <div className="font-mono text-[9px] text-on-surface-variant/50 truncate mt-0.5">
          {primary.providerId}
        </div>
        {primary.discoveredByAI && (
          <AICategoryBadge confidence={aiConfidence} />
        )}
      </div>

      {/* Specs chips */}
      <div className="px-6 flex flex-wrap gap-1">
        <SpecChip label={`${(primary.contextWindow / 1000).toFixed(0)}k`} />
        <SpecChip label={`$${primary.costPer1M.toFixed(2)}`} />
        <SpecChip label={`${scorePct}%`} accent={accentTier} />
        {primary.discoveredByAI && <SpecChip label="AI" icon={<Bot size={8} />} />}
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="px-6">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[9px] font-mono text-error/70">
              <AlertTriangle size={9} className="shrink-0 mt-0.5" />
              <span className="leading-tight">{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Fallbacks section - always expanded */}
      <div className="mt-auto px-6 pb-6">
        <div className="w-full pt-4 border-t border-white/5 flex justify-between items-center">
          <span className="text-[9px] font-mono uppercase text-outline-variant">
            {t("optimizer", "fallbacks")} ({fallbacks.length})
          </span>
        </div>

        <div className="pt-3 space-y-1.5">
          {fallbacks.length === 0 && (
            <div className="text-[9px] font-mono text-on-surface-variant/40">
              {t("optimizer", "noFallbacks")}
            </div>
          )}
          {fallbacks.map((fb, idx) => (
            <div
              key={fb.id}
              className="flex items-center justify-between bg-surface-container-highest px-3 py-1.5 cursor-pointer hover:bg-surface-container-high transition-colors"
              onClick={() => handleModelClick(fb)}
            >
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-on-surface-variant/40">
                  F{idx + 1}
                </span>
                <span
                  className="font-mono text-[10px] text-on-surface break-words leading-tight hyphens-auto"
                  title={fb.name}
                >
                  {fb.name}
                </span>
              </div>
              <span className="text-[8px] font-mono text-on-surface-variant/50">
                {(fb.contextWindow / 1000).toFixed(0)}k
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
      
      {/* Model Detail Modal */}
      <ModelDetailModal
        model={selectedModel}
        phase={phase}
        reason={selectedModel ? reason : null}
        score={selectedModel ? score : null}
        onClose={closeModal}
      />
    </>
  );
}

// ─── SpecChip ─────────────────────────────────────────────────────────────────

function SpecChip({
  label,
  accent,
  icon,
}: {
  label: string;
  accent?: "PREMIUM" | "BALANCED" | "ECONOMIC";
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "text-[9px] bg-surface-container-highest px-1.5 py-0.5 font-mono flex items-center gap-0.5",
        accent === "PREMIUM"
          ? "text-secondary"
          : accent === "BALANCED"
          ? "text-primary"
          : "text-on-surface-variant"
      )}
    >
      {icon}
      {label}
    </span>
  );
}

// ─── AICategoryBadge ──────────────────────────────────────────────────────────

/**
 * Inline badge shown when the primary model was categorized by Gemini AI.
 * Displays a warning indicator and the AI-derived confidence percentage.
 */
function AICategoryBadge({ confidence }: { confidence?: number }) {
  const { t } = useLanguage();
  const confidencePct = confidence !== undefined
    ? Math.round(confidence * 100)
    : null;

  return (
    <div className="flex items-center gap-1 mt-1.5">
      <span className="text-[8px] font-mono text-secondary/80 tracking-tight leading-none">
        ⚠ {t("optimizer", "categoryBadge")}
      </span>
      {confidencePct !== null && (
        <span className="text-[8px] font-mono text-on-surface-variant/50 tracking-tight leading-none">
          · {t("optimizer", "confidenceLabel")}: {confidencePct}%
        </span>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function PhaseCardSkeleton() {
  return (
    <div className="bg-surface-container-low p-6 flex flex-col gap-4 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="h-3 w-8 bg-surface-container-highest" />
        <div className="w-2 h-2 bg-surface-container-highest" />
      </div>
      <div className="h-2 w-24 bg-surface-container-highest" />
      <div className="h-5 w-40 bg-surface-container-highest" />
      <div className="flex gap-1">
        <div className="h-4 w-10 bg-surface-container-highest" />
        <div className="h-4 w-12 bg-surface-container-highest" />
        <div className="h-4 w-8 bg-surface-container-highest" />
      </div>
      <div className="mt-auto pt-4 border-t border-white/5 h-4 w-24 bg-surface-container-highest" />
    </div>
  );
}
