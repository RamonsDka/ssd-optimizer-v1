"use client";

// ─── Optimizer Page ─────────────────────────────────────────────────────────
// Next.js 15 App Router — Client Component wrapper.
// Wires InputModule → /api/optimize → ProfileSelector + DataMatrix.
//
// Batch 2 additions:
// - GuideSteps shown BEFORE results arrive, hidden once recommendation exists.
// - useOptimizerPersistence: result survives page navigation via localStorage.

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trash2, Rocket, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import InputModule from "@/components/optimizer/InputModule";
import AdvancedOptions from "@/components/optimizer/AdvancedOptions";
import CustomPhasesManager from "@/components/optimizer/CustomPhasesManager";
import { ViewModeSelector, type ViewMode } from "@/components/shared/ViewModeSelector";
import ProfileSelector from "@/components/optimizer/ProfileSelector";
import DataMatrix from "@/components/optimizer/DataMatrix";
import ComparisonTable from "@/components/optimizer/ComparisonTable";
import ErrorBanner from "@/components/optimizer/ErrorBanner";
import PhaseDetailModal from "@/components/optimizer/PhaseDetailModal";
import GuideSteps from "@/components/optimizer/GuideSteps";
import { useOptimizerPersistence } from "@/lib/hooks/useOptimizerPersistence";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getSessionKey } from "@/lib/session/session-manager";
import { clearRecreateQueryPayload, readRecreateQueryPayload } from "@/lib/session/recreate-query";
import type { Tier, PhaseAssignment, SddPhase, DeployResponse, RecreateQueryPayload } from "@/types";

export default function OptimizerPage() {
  const { recommendation, save, clear, isHydrating } = useOptimizerPersistence();
  const { t, lang } = useLanguage();
  const [activeTier, setActiveTier] = useState<Tier>("BALANCED");
  const [recreatePayload] = useState<RecreateQueryPayload | null>(() => readRecreateQueryPayload());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";

    const sessionKey = getSessionKey("viewMode");
    const saved = localStorage.getItem(sessionKey) as ViewMode | null;
    return saved ?? "grid";
  });
  const [error, setError] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<SddPhase | string | null>(null);
  const [selectedPhaseAssignment, setSelectedPhaseAssignment] = useState<PhaseAssignment | null>(null);

  useEffect(() => {
    if (recreatePayload) {
      clearRecreateQueryPayload();
    }
  }, [recreatePayload]);

  // Persist viewMode to localStorage on every change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionKey = getSessionKey("viewMode");
    localStorage.setItem(sessionKey, viewMode);
  }, [viewMode]);

  const handlePhaseClick = useCallback((assignment: PhaseAssignment) => {
    setSelectedPhase(assignment.phase);
    setSelectedPhaseAssignment(assignment);
  }, []);

  // Called by InputModule when /api/optimize returns successfully
  const handleResult = useCallback(
    (result: Parameters<typeof save>[0]) => {
      save(result);       // persists to localStorage + updates state
      setError(null);
      setLoadingProfiles(false);
    },
    [save]
  );

  // Called by InputModule on any API/network error
  const handleError = useCallback((msg: string) => {
    setError(msg);
    setLoadingProfiles(false);
  }, []);

  // Handle explicit result reset
  const handleClear = useCallback(() => {
    clear();
    setActiveTier("BALANCED");
    setError(null);
  }, [clear]);


  // Derive per-profile stats for ProfileSelector
  const profileStats = recommendation
    ? {
        PREMIUM: {
          totalCost: recommendation.premium.totalEstimatedCost,
          avgContext: recommendation.premium.avgContextWindow,
        },
        BALANCED: {
          totalCost: recommendation.balanced.totalEstimatedCost,
          avgContext: recommendation.balanced.avgContextWindow,
        },
        ECONOMIC: {
          totalCost: recommendation.economic.totalEstimatedCost,
          avgContext: recommendation.economic.avgContextWindow,
        },
      }
    : undefined;

  // Active profile phases
  const activeProfile = recommendation
    ? recommendation[activeTier.toLowerCase() as "premium" | "balanced" | "economic"]
    : null;

  return (
    <div className="w-full max-w-7xl mx-auto px-8 py-8 space-y-8">
      {/* Page header */}
      <div className="mb-0 border-l-4 border-primary pl-6">
        <h1 className="text-4xl font-black uppercase tracking-tighter text-on-surface">
          {t("optimizer", "title")}
        </h1>
        <p className="font-mono text-xs text-primary/60 uppercase tracking-widest mt-2">
          {t("optimizer", "subtitle")}
        </p>
      </div>

      {/* Error Banner */}
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* ── Step 1: Input ────────────────────────────────────────────────────── */}
      <InputModule
        onResult={handleResult}
        onError={handleError}
        initialValue={recreatePayload?.input ?? ""}
      />
      
      {/* ── Advanced Options ──────────────────────────────────────────────────── */}
      <AdvancedOptions initialOptions={recreatePayload?.advancedOptions ?? null} />

      {/* ── Custom Phases ─────────────────────────────────────────────────────── */}
      <CustomPhasesManager />
      
      {recommendation && (
        <ViewModeSelector mode={viewMode} onChange={setViewMode} className="mb-6" />
      )}

      {/* ── Inline Guide — visible ONLY while no recommendation exists ──────── */}
      <AnimatePresence>
        {!isHydrating && !recommendation && (
          <motion.div
            key="guide-steps"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <GuideSteps />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Persistent result banner + clear action ──────────────────────────── */}
      <AnimatePresence>
        {recommendation && (
          <motion.div
            key="persistence-banner"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-between px-4 py-3 bg-surface-container border border-outline-variant/30 border-l-4 border-l-secondary"
          >
            <div>
              <span className="font-mono text-xs text-secondary uppercase tracking-widest">
                {t("optimizer", "resultRecovered")}
              </span>
              <p className="text-on-surface-variant text-xs mt-0.5">
                {lang === "es"
                  ? `Generado el ${new Date(recommendation.generatedAt).toLocaleString("es-AR")}. Navegá entre páginas sin perder esta sesión.`
                  : `Generated on ${new Date(recommendation.generatedAt).toLocaleString("en-US")}. Navigate between pages without losing this session.`}
              </p>
            </div>
            <button
              onClick={handleClear}
              title={t("optimizer", "clearTooltip")}
              className="flex items-center gap-2 px-4 py-2 border border-error/30 text-error font-mono text-xs uppercase tracking-widest hover:bg-error/10 transition-colors shrink-0 ml-4"
            >
              <Trash2 size={12} />
              {t("optimizer", "clearButton")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Step 2: Profile Selection (only visible once we have results) ─────── */}
      <AnimatePresence>
        {recommendation && (
          <motion.div
            key="profile-selector"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <ProfileSelector
              selected={activeTier}
              onSelect={setActiveTier}
              stats={profileStats}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Step 3: Phase Grid ────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {(recommendation || loadingProfiles) && (
          <motion.div
            key={`data-matrix-${activeTier}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {/* SDD Orchestrator Rectangle */}
            <div className="mb-6 p-4 bg-primary-container border border-primary/30 rounded-sm">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-primary rounded-full" />
                <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-on-primary-container">
                  SDD ORCHESTRATOR
                </h3>
              </div>
            </div>
            
            <DataMatrix
              phases={activeProfile?.phases ?? []}
              tier={activeTier}
              viewMode={viewMode}
              loading={loadingProfiles}
              onRefresh={() => {
                // Noop — user re-submits from InputModule
              }}
              onPhaseClick={handlePhaseClick}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Step 4: Comparison Table ─────────────────────────────────────────── */}
      <AnimatePresence>
        {recommendation && (
          <motion.div
            key="comparison-table"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
          >
            <section>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1 h-8 bg-secondary" />
                <h2 className="text-xl font-black tracking-widest uppercase font-label">
                  {t("optimizer", "comparisonTitle")}
                </h2>
              </div>
              <ComparisonTable
                recommendation={recommendation}
                activeTier={activeTier}
                onSelectTier={setActiveTier}
              />
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom padding for fixed footer */}
      <div className="h-16" />

      {/* ── Phase Detail Modal ────────────────────────────────────────────────── */}
      <PhaseDetailModal
        phase={selectedPhase}
        primaryModel={selectedPhaseAssignment?.primary ?? null}
        onClose={() => {
          setSelectedPhase(null);
          setSelectedPhaseAssignment(null);
        }}
      />
    </div>
  );
}
