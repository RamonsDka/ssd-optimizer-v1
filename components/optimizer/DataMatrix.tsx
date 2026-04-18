"use client";

// ─── DataMatrix ────────────────────────────────────────────────────────────────
// 2×5 grid of PhaseCards (10 SDD phases). Orchestrates display for active profile.
// The SDD Orchestrator panel is driven dynamically from the 'sdd-onboard' phase
// in the active profile — no more hardcoded static model data.

import { useState } from "react";
import { RefreshCw, Download, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils/cn";
import PhaseCard, { PhaseCardSkeleton } from "./PhaseCard";
import DataMatrixList from "./DataMatrixList";
import DataMatrixTable from "./DataMatrixTable";
import DataMatrixCompact from "./DataMatrixCompact";
import ModelDetailModal from "./ModelDetailModal";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useCopyFeedback } from "@/lib/hooks/useCopyFeedback";
import type { PhaseAssignment, Tier, ModelRecord } from "@/types";
import { getPhaseLabel } from "@/types";
import type { ViewMode } from "@/components/shared/ViewModeSelector";

interface DataMatrixProps {
  phases: PhaseAssignment[];
  tier: Tier;
  viewMode: ViewMode;
  loading?: boolean;
  onRefresh?: () => void;
  onPhaseClick?: (assignment: PhaseAssignment) => void;
}

export default function DataMatrix({
  phases,
  tier,
  viewMode,
  loading = false,
  onRefresh,
  onPhaseClick,
}: DataMatrixProps) {
  const { t, lang } = useLanguage();
  const { copied, copy } = useCopyFeedback();
  const [selectedOrchestratorModel, setSelectedOrchestratorModel] = useState<ModelRecord | null>(null);

  // Map phases to use language-aware labels
  const localizedPhases = phases.map(phase => ({
    ...phase,
    phaseLabel: getPhaseLabel(phase.phase, lang)
  }));

  // ── Dynamic Orchestrator data ─────────────────────────────────────────────
  // Drive the SDD Orchestrator panel from the 'sdd-onboard' PhaseAssignment
  // in the active profile. Falls back to null when profiles aren't loaded yet.
  const orchestratorAssignment = localizedPhases.find(
    (p) => p.phase === "sdd-onboard"
  ) ?? null;

  const orchestratorPrimary = orchestratorAssignment?.primary ?? null;
  const orchestratorFallbacks = orchestratorAssignment?.fallbacks ?? [];
  const orchestratorScore = orchestratorAssignment?.score ?? null;
  const orchestratorReason = orchestratorAssignment?.reason ?? null;

  // Build downloadable JSON
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify({ tier, phases: localizedPhases }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sdd-profile-${tier.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy the model list as plain text (one model per phase)
  const handleCopy = () => {
    if (localizedPhases.length === 0) return;
    const lines = localizedPhases.map(
      (p) =>
        `[${p.phase}] ${p.primary.name} (${p.primary.providerId}) — ${tier}`
    );
    copy(lines.join("\n"));
  };

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-primary" />
          <h2 className="text-xl font-black tracking-widest uppercase font-label">
            {t("optimizer", "phaseMappingTitle")}
          </h2>
        </div>
        <div className="flex gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="bg-surface-container-high p-2 text-on-surface hover:bg-surface-bright transition-colors disabled:opacity-40"
              aria-label={t("optimizer", "refreshLabel")}
            >
              <motion.span
                animate={loading ? { rotate: 360 } : { rotate: 0 }}
                transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
                className="block"
              >
                <RefreshCw size={16} />
              </motion.span>
            </button>
          )}

          {/* Copy model list button — green checkmark on success */}
          <button
            onClick={handleCopy}
            disabled={loading || localizedPhases.length === 0}
            className="bg-surface-container-high p-2 text-on-surface hover:bg-surface-bright transition-colors disabled:opacity-40 relative overflow-hidden"
            aria-label={t("optimizer", "copyModelList")}
            title={t("optimizer", "copyModelList")}
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="block text-emerald-400"
                >
                  <Check size={16} />
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="block"
                >
                  <Copy size={16} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <button
            onClick={handleDownload}
            disabled={loading || localizedPhases.length === 0}
            className="bg-surface-container-high p-2 text-on-surface hover:bg-surface-bright transition-colors disabled:opacity-40"
            aria-label={t("optimizer", "downloadProfile")}
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* SDD Orchestrator — driven by the sdd-onboard phase assignment */}
      <div className="bg-surface-container-low mb-4 border-l-2 border-primary group hover:bg-surface-container transition-colors">
        <div className="p-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">

          {/* Left: identity */}
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono text-primary uppercase tracking-widest opacity-70">
              {t("optimizer", "orchestratorLabel")}
            </span>
            <h3 className="font-label text-lg font-black uppercase text-on-surface mt-1 tracking-tight">
              {t("optimizer", "orchestratorTitle")}
            </h3>
            <p className="text-on-surface-variant text-xs mt-2 leading-relaxed max-w-xs">
              {t("optimizer", "orchestratorDesc")}
            </p>
          </div>

          {/* Center: primary model (from sdd-onboard phase) */}
          <div className="flex-1 min-w-0">
            {orchestratorPrimary ? (
              <>
                <button
                  onClick={() => setSelectedOrchestratorModel(orchestratorPrimary)}
                  className="text-left w-full group/primary"
                  title={t("optimizer", "viewModelDetails")}
                >
                  <div className="font-mono text-lg font-black text-on-surface group-hover/primary:text-secondary transition-colors break-words leading-tight hyphens-auto">
                    {orchestratorPrimary.name}
                  </div>
                  <div className="font-mono text-[9px] text-on-surface-variant/50 mt-0.5">
                    {orchestratorPrimary.providerId}
                  </div>
                </button>
                {/* Spec chips */}
                <div className="flex flex-wrap gap-1 mt-3">
                  <span className="text-[9px] bg-surface-container-highest px-1.5 py-0.5 font-mono text-on-surface-variant">
                    {(orchestratorPrimary.contextWindow / 1000).toFixed(0)}k
                  </span>
                  <span className="text-[9px] bg-surface-container-highest px-1.5 py-0.5 font-mono text-on-surface-variant">
                    ${orchestratorPrimary.costPer1M.toFixed(2)}
                  </span>
                  {orchestratorScore !== null && (
                    <span className="text-[9px] bg-surface-container-highest px-1.5 py-0.5 font-mono text-secondary">
                      {Math.round(orchestratorScore * 100)}%
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-[10px] font-mono text-on-surface-variant/40 animate-pulse">
                —
              </div>
            )}
          </div>

          {/* Right: fallbacks (from sdd-onboard phase) */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-mono uppercase text-outline-variant">
                {t("optimizer", "fallbacks")} ({orchestratorFallbacks.length})
              </span>
              <div className="w-2 h-2 bg-primary opacity-20 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="space-y-1.5">
              {orchestratorFallbacks.length === 0 && (
                <div className="text-[9px] font-mono text-on-surface-variant/40">
                  {t("optimizer", "noFallbacks")}
                </div>
              )}
              {orchestratorFallbacks.map((fb, idx) => (
                <button
                  key={fb.id}
                  onClick={() => setSelectedOrchestratorModel(fb)}
                  className="w-full flex items-center justify-between bg-surface-container-highest px-3 py-1.5 hover:bg-surface-container-high transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[8px] font-mono text-on-surface-variant/40 shrink-0">
                      F{idx + 1}
                    </span>
                    <span className="font-mono text-[10px] text-on-surface break-words leading-tight hyphens-auto" title={fb.name}>
                      {fb.name}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono text-on-surface-variant/50 shrink-0 ml-2">
                    {(fb.contextWindow / 1000).toFixed(0)}k
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Orchestrator Model Detail Modal */}
      <ModelDetailModal
        model={selectedOrchestratorModel}
        phase="sdd-onboard"
        reason={
          selectedOrchestratorModel?.id === orchestratorPrimary?.id
            ? orchestratorReason
            : null
        }
        score={
          selectedOrchestratorModel?.id === orchestratorPrimary?.id
            ? orchestratorScore
            : null
        }
        onClose={() => setSelectedOrchestratorModel(null)}
      />

      {/* Dynamic View rendering */}
      {viewMode === "list" ? (
        <DataMatrixList
          phases={localizedPhases}
          tier={tier}
          onPhaseClick={onPhaseClick}
        />
      ) : viewMode === "table" ? (
        <DataMatrixTable
          phases={localizedPhases}
          tier={tier}
          onPhaseClick={onPhaseClick}
        />
      ) : viewMode === "compact" ? (
        <DataMatrixCompact
          phases={localizedPhases}
          tier={tier}
          onPhaseClick={onPhaseClick}
        />
      ) : (
        <div
          className={cn(
            "grid gap-[1px] bg-outline-variant/20",
            "grid-cols-1 md:grid-cols-2 lg:grid-cols-5"
          )}
        >
          {loading
            ? Array.from({ length: 10 }).map((_, i) => (
                <PhaseCardSkeleton key={i} />
              ))
            : localizedPhases.map((assignment) => (
                <PhaseCard
                  key={assignment.phase}
                  assignment={assignment}
                  accentTier={tier}
                  onPhaseClick={onPhaseClick}
                />
              ))}
        </div>
      )}
    </section>
  );
}
