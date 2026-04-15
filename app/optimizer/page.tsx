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
import type { Tier, PhaseAssignment, SddPhase, DeployResponse } from "@/types";

export default function OptimizerPage() {
  const { recommendation, save, clear, isHydrating } = useOptimizerPersistence();
  const { t, lang } = useLanguage();
  const [activeTier, setActiveTier] = useState<Tier>("BALANCED");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const sessionKey = getSessionKey("viewMode");
    const saved = localStorage.getItem(sessionKey) as ViewMode | null;
    if (saved) setViewMode(saved);
  }, []);

  useEffect(() => {
    const sessionKey = getSessionKey("viewMode");
    localStorage.setItem(sessionKey, viewMode);
  }, [viewMode]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<SddPhase | null>(null);
  const [selectedPhaseAssignment, setSelectedPhaseAssignment] = useState<PhaseAssignment | null>(null);
  
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResponse | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

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
    setDeployResult(null);
    setDeployError(null);
  }, [clear]);

  // Handle deploy
  const handleDeploy = useCallback(async () => {
    if (!recommendation?.jobId || deployLoading) return;

    setDeployLoading(true);
    setDeployError(null);
    setDeployResult(null);

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: recommendation.jobId, tier: activeTier }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setDeployError(json.error ?? `Error ${res.status}`);
        return;
      }

      setDeployResult(json as DeployResponse);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setDeployError(msg);
    } finally {
      setDeployLoading(false);
    }
  }, [recommendation, activeTier, deployLoading]);

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
      <InputModule onResult={handleResult} onError={handleError} />
      
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

      {/* ── Deploy Section ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {recommendation && recommendation.jobId && (
          <motion.div
            key="deploy-section"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="border-l-4 border-secondary bg-surface-container p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-secondary">
                  {lang === "es" ? "Deploy 1-Click" : "1-Click Deploy"}
                </h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  {lang === "es"
                    ? `Aplicar configuración ${activeTier} a tu equipo SDD`
                    : `Apply ${activeTier} configuration to your SDD team`}
                </p>
              </div>
              <button
                onClick={handleDeploy}
                disabled={deployLoading || !!deployResult}
                className="flex items-center gap-2 px-6 py-3 bg-secondary text-on-secondary font-mono text-xs uppercase tracking-widest hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deployLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{lang === "es" ? "Desplegando..." : "Deploying..."}</span>
                  </>
                ) : deployResult ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span>{lang === "es" ? "Desplegado" : "Deployed"}</span>
                  </>
                ) : (
                  <>
                    <Rocket size={14} />
                    <span>{lang === "es" ? "Desplegar" : "Deploy"}</span>
                  </>
                )}
              </button>
            </div>

            {/* Deploy Error */}
            {deployError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-4 bg-error-container border border-error/30 text-error"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold uppercase tracking-wider mb-1">
                    {lang === "es" ? "Error de Deploy" : "Deploy Error"}
                  </p>
                  <p className="text-on-error-container">{deployError}</p>
                </div>
              </motion.div>
            )}

            {/* Deploy Success */}
            {deployResult && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-tertiary-container border border-tertiary/30"
              >
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={16} className="text-tertiary" />
                  <p className="font-mono text-xs font-bold uppercase tracking-widest text-tertiary">
                    {lang === "es" ? "Deploy Exitoso" : "Deploy Successful"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-on-surface-variant uppercase tracking-wider">
                      {lang === "es" ? "Aplicadas:" : "Applied:"}
                    </span>
                    <span className="ml-2 font-bold text-tertiary">
                      {deployResult.appliedCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant uppercase tracking-wider">
                      {lang === "es" ? "Omitidas:" : "Skipped:"}
                    </span>
                    <span className="ml-2 font-bold text-on-surface">
                      {deployResult.skippedCount}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
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
