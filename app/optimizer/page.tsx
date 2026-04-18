"use client";

// ─── Optimizer Page ─────────────────────────────────────────────────────────
// Next.js 15 App Router — Client Component wrapper.
// Wires InputModule → /api/optimize → ProfileSelector + DataMatrix.
//
// Batch 2 additions:
// - GuideSteps shown BEFORE results arrive, hidden once recommendation exists.
// - useOptimizerPersistence: result survives page navigation via localStorage.
//
// Batch 7.4 additions (OIM Terminal UI):
// - TerminalUI: real-time OIM orchestration log streamed during /api/optimize.
// - ScoringReasoning panel: collapsible breakdown of per-phase model selection.
//
// Batch 7.5 additions (A/B testing + ComparisonMatrix):
// - ScoringVersionToggle: lets users switch between V2 / V3 / Auto scoring.
// - ComparisonMatrix: side-by-side V2 vs V3 breakdown shown after results arrive.
// - scoringVersion state is passed as a query-param to /api/optimize.

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trash2, GitCompare, Database, Zap, Cpu } from "lucide-react";
import InputModule from "@/components/optimizer/InputModule";
import AdvancedOptions from "@/components/optimizer/AdvancedOptions";
import CustomPhasesManager from "@/components/optimizer/CustomPhasesManager";
import { ViewModeSelector, type ViewMode } from "@/components/shared/ViewModeSelector";
import ProfileSelector from "@/components/optimizer/ProfileSelector";
import DataMatrix from "@/components/optimizer/DataMatrix";
import ComparisonTable from "@/components/optimizer/ComparisonTable";
import ComparisonMatrix from "@/components/optimizer/ComparisonMatrix";
import ErrorBanner from "@/components/optimizer/ErrorBanner";
import PhaseDetailModal from "@/components/optimizer/PhaseDetailModal";
import GuideSteps from "@/components/optimizer/GuideSteps";
import TerminalUI, { type ScoringReasoningEntry } from "@/components/optimizer/TerminalUI";
import { useOptimizerPersistence } from "@/lib/hooks/useOptimizerPersistence";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getSessionKey } from "@/lib/session/session-manager";
import { clearRecreateQueryPayload, readRecreateQueryPayload } from "@/lib/session/recreate-query";
import { cn } from "@/lib/utils/cn";
import type { Tier, PhaseAssignment, SddPhase, TeamRecommendation, RecreateQueryPayload } from "@/types";
import { getPhaseLabel } from "@/types";
import type { TerminalEvent } from "@/components/ui/TerminalOverlay";

// ─── Scoring strategy type (mirrors oim-orchestrator.ts) ──────────────────────
// "env" is the default: defers engine selection to SCORING_VERSION in .env.
// "v2"/"v3" are explicit overrides for A/B testing only.
// "auto" is kept for backward compatibility (localStorage may hold the old value).
type ScoringStrategy = "v2" | "v3" | "auto" | "env";

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

  // ── OIM Terminal state (Task 7.4.3 & 7.4.4) ─────────────────────────────
  const [terminalEvents, setTerminalEvents] = useState<TerminalEvent[]>([]);
  const [scoringReasoning, setScoringReasoning] = useState<ScoringReasoningEntry[]>([]);

  // ── A/B Scoring Version Toggle (Task 7.5.3) ──────────────────────────────
  // scoringStrategy drives which engine /api/optimize will use.
  // Default is "env": defers to SCORING_VERSION in .env so the feature flag
  // controls production behavior without UI intervention.
  // "v2"/"v3" are explicit A/B overrides.
  // Backward-compat: old "auto" values from localStorage are treated as "env".
  const [scoringStrategy, setScoringStrategy] = useState<ScoringStrategy>(() => {
    if (typeof window === "undefined") return "env";
    const saved = localStorage.getItem(getSessionKey("scoringStrategy")) as ScoringStrategy | null;
    // Migrate legacy "auto" → "env" on load
    if (saved === "auto") return "env";
    return saved ?? "env";
  });
  const [showComparisonMatrix, setShowComparisonMatrix] = useState(false);
  // v2Snap and v3Snap hold the last result from each version for side-by-side display
  const [v2Snap, setV2Snap] = useState<TeamRecommendation | null>(null);
  const [v3Snap, setV3Snap] = useState<TeamRecommendation | null>(null);
  // resolvedScoringVersion is what the API actually used (useful when strategy=auto)
  const [resolvedScoringVersion, setResolvedScoringVersion] = useState<"v2" | "v3" | null>(null);

  /** Push a single event into the terminal log */
  const pushTerminalEvent = useCallback((event: TerminalEvent) => {
    setTerminalEvents((prev) => [...prev, event]);
  }, []);

  /** Clear the terminal log */
  const clearTerminal = useCallback(() => {
    setTerminalEvents([]);
  }, []);

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

  // Persist scoringStrategy to localStorage on every change
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(getSessionKey("scoringStrategy"), scoringStrategy);
  }, [scoringStrategy]);

  const handlePhaseClick = useCallback((assignment: PhaseAssignment) => {
    setSelectedPhase(assignment.phase);
    setSelectedPhaseAssignment(assignment);
  }, []);

  // Called by InputModule when /api/optimize returns successfully
  const handleResult = useCallback(
    (result: Parameters<typeof save>[0], meta?: { scoringVersion?: string }) => {
      save(result);       // persists to localStorage + updates state
      setError(null);
      setLoadingProfiles(false);

      // ── Track version snaps for ComparisonMatrix (Task 7.5.3) ──────────
      const usedVersion = (meta?.scoringVersion ?? scoringStrategy === "v3" ? "v3" : "v2") as "v2" | "v3";
      setResolvedScoringVersion(usedVersion);
      if (usedVersion === "v3") {
        setV3Snap(result as TeamRecommendation);
      } else {
        setV2Snap(result as TeamRecommendation);
      }

      // ── Populate OIM terminal events from result (Task 7.4.3) ──────────
      const now = new Date().toISOString();
      pushTerminalEvent({
        type: "success",
        message: `OIM pipeline completed — profiles generated (engine: ${usedVersion.toUpperCase()}).`,
        timestamp: now,
      });

      // ── Build scoring reasoning entries from balanced profile (Task 7.4.4) ─
      try {
        const balancedPhases = result.balanced?.phases ?? [];
        const entries: ScoringReasoningEntry[] = balancedPhases.map((assignment) => ({
          phase: assignment.phase,
          phaseLabel: getPhaseLabel(assignment.phase, lang),
          modelName: assignment.primary?.name ?? assignment.primary?.id ?? "—",
          score: assignment.score ?? 0,
          reason: assignment.reason ?? "No reasoning available.",
        }));
        setScoringReasoning(entries);

        if (entries.length > 0) {
          pushTerminalEvent({
            type: "info",
            message: `Scoring reasoning ready — ${entries.length} phase assignments explained.`,
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
        // Non-critical; reasoning panel will remain empty
      }
    },
    [save, pushTerminalEvent, lang, scoringStrategy]
  );

  // Called by InputModule when it starts loading (before result arrives)
  const handleLoadingStart = useCallback(() => {
    setLoadingProfiles(true);
    // Seed the terminal with pipeline-start events
    const ts = () => new Date().toISOString();
    const strategyLabel =
      scoringStrategy === "v3"
        ? "V3 (OIM multi-dimensional)"
        : scoringStrategy === "v2"
        ? "V2 (LM Arena)"
        : t("optimizer", "strategyEnvFallback");
    setTerminalEvents([
      { type: "info",     message: `Initialising OIM orchestration pipeline — strategy: ${strategyLabel}`, timestamp: ts() },
      { type: "progress", message: "Parsing model list and resolving canonical IDs…", timestamp: ts() },
      { type: "progress", message: "Querying database for known models…",             timestamp: ts() },
      { type: "info",     message: "Handing off to OIM Orchestrator…",               timestamp: ts() },
    ]);
    setScoringReasoning([]);
  }, [scoringStrategy]);

  // Called by InputModule on any API/network error
  const handleError = useCallback((msg: string) => {
    setError(msg);
    setLoadingProfiles(false);
    pushTerminalEvent({ type: "error", message: `Pipeline error: ${msg}`, timestamp: new Date().toISOString() });
  }, [pushTerminalEvent]);

  // Handle explicit result reset
  const handleClear = useCallback(() => {
    clear();
    setActiveTier("BALANCED");
    setError(null);
    setV2Snap(null);
    setV3Snap(null);
    setResolvedScoringVersion(null);
    setShowComparisonMatrix(false);
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

      {/* ── A/B Scoring Version Toggle (Task 7.5.3) ─────────────────────────── */}
      <div className="flex items-center gap-3 py-3 px-4 bg-surface-container border border-outline-variant/20">
        <Cpu size={12} className="text-primary/60 shrink-0" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant/70 shrink-0">
          {t("optimizer", "scoringEngineLabel")}
        </span>
        <div className="flex gap-1 ml-auto">
          {(["env", "v2", "v3"] as ScoringStrategy[]).map((s) => {
            const icon = s === "v2" ? <Database size={9} /> : s === "v3" ? <Zap size={9} /> : <Cpu size={9} />;
            // "env" shows the human-friendly label; "v2"/"v3" show their version tags
            const label = s === "env" ? t("optimizer", "strategyEnv") : s.toUpperCase();
            return (
              <button
                key={s}
                onClick={() => setScoringStrategy(s)}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest border transition-colors",
                  scoringStrategy === s
                    ? "border-primary text-primary bg-primary/10"
                    : "border-outline-variant/20 text-on-surface-variant/50 hover:border-outline-variant/40 hover:text-on-surface-variant"
                )}
              >
                {icon}
                {label}
              </button>
            );
          })}
        </div>
        {resolvedScoringVersion && (
          <span className="font-mono text-[8px] text-on-surface-variant/40 shrink-0 ml-2">
            {t("optimizer", "lastEngineLabel")} {resolvedScoringVersion.toUpperCase()}
          </span>
        )}
      </div>

      {/* ── Step 1: Input ────────────────────────────────────────────────────── */}
      <InputModule
        onResult={handleResult}
        onError={handleError}
        onLoadingStart={handleLoadingStart}
        initialValue={recreatePayload?.input ?? ""}
        scoringVersion={scoringStrategy}
      />

      {/* ── OIM Terminal Log (Task 7.4.3 & 7.4.4) ──────────────────────────── */}
      <AnimatePresence>
        {(terminalEvents.length > 0 || loadingProfiles) && (
          <motion.div
            key="terminal-ui"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <TerminalUI
              events={terminalEvents}
              loading={loadingProfiles}
              onClear={clearTerminal}
              reasoningEntries={scoringReasoning}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
                  {t("optimizer", "sddOrchestratorTitle")}
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

      {/* ── Step 5: V2 vs V3 Comparison Matrix (Task 7.5.2 / 7.5.3) ─────────── */}
      <AnimatePresence>
        {recommendation && (v2Snap || v3Snap) && (
          <motion.div
            key="comparison-matrix-section"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
          >
            <section>
              {/* Section header with toggle */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-primary" />
                  <div>
                    <h2 className="text-xl font-black tracking-widest uppercase font-label">
                      {t("optimizer", "v2v3Title")}
                    </h2>
                    <p className="text-[9px] font-mono text-on-surface-variant/50 mt-0.5 uppercase tracking-widest">
                      {t("optimizer", "v2v3Subtitle")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowComparisonMatrix((prev) => !prev)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest border transition-colors",
                    showComparisonMatrix
                      ? "border-primary/40 text-primary bg-primary/10"
                      : "border-outline-variant/30 text-on-surface-variant/60 hover:border-outline-variant/50"
                  )}
                >
                  <GitCompare size={10} />
                  {showComparisonMatrix ? t("optimizer", "hideMatrix") : t("optimizer", "showMatrix")}
                </button>
              </div>

              <AnimatePresence>
                {showComparisonMatrix && (
                  <motion.div
                    key="comparison-matrix"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <ComparisonMatrix
                      v2Recommendation={v2Snap ?? recommendation}
                      v3Recommendation={v3Snap}
                      activeTier={activeTier}
                      onSelectTier={setActiveTier}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hint when no comparison data yet */}
              {!showComparisonMatrix && !v3Snap && (
                <p className="text-[9px] font-mono text-on-surface-variant/30 px-4">
                  {t("optimizer", "v3HintText")}
                </p>
              )}
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
