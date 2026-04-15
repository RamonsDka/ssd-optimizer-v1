"use client";

// ─── PhaseDetailModal ─────────────────────────────────────────────────────────
// Shows model details for a clicked PhaseCard AND a paginated list of all other
// models registered in that same phase/category, grouped by tier.
//
// Data fetched from GET /api/phases/[phase].

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Cpu, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import Modal, { ModalSkeleton, ModalSection } from "@/components/ui/Modal";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationSection } from "@/lib/i18n/translations";
import type { PhaseDetailResponse, PhaseModelEntry } from "@/app/api/phases/[phase]/route";
import type { Tier, PhaseAssignment, SddPhase } from "@/types";
import { SDD_PHASE_LABELS } from "@/types";

type TFn = (section: TranslationSection, key: string) => string;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhaseDetailModalProps {
  /** The SDD phase slug (e.g. "sdd-apply") or null to close */
  phase: SddPhase | null;
  /** The primary model from the PhaseCard that was clicked */
  primaryModel?: PhaseAssignment["primary"] | null;
  onClose: () => void;
}

// ─── Tier styles ──────────────────────────────────────────────────────────────

const TIER_ACCENT: Record<Tier, string> = {
  PREMIUM: "text-secondary",
  BALANCED: "text-primary",
  ECONOMIC: "text-on-surface-variant",
};

const TIER_BAR: Record<Tier, string> = {
  PREMIUM: "bg-secondary",
  BALANCED: "bg-primary",
  ECONOMIC: "bg-outline-variant",
};

const TIER_BORDER: Record<Tier, string> = {
  PREMIUM: "border-secondary",
  BALANCED: "border-primary",
  ECONOMIC: "border-outline-variant",
};

const TIER_ORDER: Tier[] = ["PREMIUM", "BALANCED", "ECONOMIC"];

const PAGE_SIZE = 10;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhaseDetailModal({
  phase,
  primaryModel,
  onClose,
}: PhaseDetailModalProps) {
  const { t, lang } = useLanguage();
  const [data, setData] = useState<PhaseDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const phaseLabel = phase ? (SDD_PHASE_LABELS[phase][lang] ?? phase) : "";

  const fetchData = useCallback(
    (p: number) => {
      if (!phase) return;
      let cancelled = false;
      setLoading(true);
      setError(null);

      fetch(`/api/phases/${encodeURIComponent(phase)}?page=${p}&limit=${PAGE_SIZE}`)
        .then((res) => res.json())
        .then((json) => {
          if (cancelled) return;
          if (!json.success) {
            setError(json.error ?? "Error desconocido");
          } else {
            setData(json as PhaseDetailResponse);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Error de red");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => { cancelled = true; };
    },
    [phase]
  );

  useEffect(() => {
    if (!phase) {
      setData(null);
      setError(null);
      setPage(1);
      return;
    }
    setPage(1);
    fetchData(1);
  }, [phase, fetchData]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchData(newPage);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <Modal
      open={!!phase}
      onClose={onClose}
      title={phaseLabel ? `PHASE: ${phaseLabel.toUpperCase()}` : "PHASE DETAIL"}
      subtitle={phase ?? undefined}
      maxWidth="max-w-3xl"
    >
      <div className="p-6 space-y-8">

        {/* ── Primary model highlight ───────────────────────────────────── */}
        {primaryModel && (
          <ModalSection label={t("optimizer", "assignedModel")}>
            <PrimaryModelCard model={primaryModel} />
          </ModalSection>
        )}

        {/* ── Phase roster by tier ─────────────────────────────────────── */}
        <ModalSection label={`${t("optimizer", "globalRoster")} ${data ? `(${data.total} ${data.total === 1 ? t("optimizer", "models") : t("optimizer", "modelsPlural")})` : ""}`}>
          {loading && <ModalSkeleton rows={4} />}

          {!loading && error && (
            <div className="border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">
              <span className="font-bold">[ERROR]</span> {error}
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-6">
              {TIER_ORDER.map((tier) => {
                const models = data.data[tier];
                if (models.length === 0) return null;
                return (
                  <TierGroup key={tier} tier={tier} models={models} t={t} />
                );
              })}

              {data.total === 0 && (
                <div className="py-8 text-center font-mono text-xs text-on-surface-variant/40 uppercase tracking-widest">
                  {t("optimizer", "noData")}
                </div>
              )}
            </div>
          )}
        </ModalSection>

        {/* ── Pagination ────────────────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
              {t("optimizer", "page")} {page} {t("optimizer", "of")} {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 font-mono text-xs uppercase tracking-widest",
                  "border border-outline-variant/30 text-on-surface-variant",
                  "hover:border-primary hover:text-primary transition-colors",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                <ChevronLeft size={12} />
                {t("optimizer", "previous")}
              </button>
              <button
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 font-mono text-xs uppercase tracking-widest",
                  "border border-outline-variant/30 text-on-surface-variant",
                  "hover:border-primary hover:text-primary transition-colors",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                {t("optimizer", "next")}
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── TierGroup ────────────────────────────────────────────────────────────────

function TierGroup({ tier, models, t }: { tier: Tier; models: PhaseModelEntry[]; t: TFn }) {
  return (
    <div className="space-y-2">
      {/* Tier header */}
      <div className={cn("flex items-center gap-2 border-l-2 pl-3", TIER_BORDER[tier])}>
        <span className={cn("font-mono text-[10px] uppercase tracking-widest font-bold", TIER_ACCENT[tier])}>
          {tier}
        </span>
        <span className="font-mono text-[9px] text-on-surface-variant/40">
          — {models.length} {models.length !== 1 ? t("optimizer", "modelsPlural") : t("optimizer", "models")}
        </span>
      </div>

      {/* Model rows */}
      <div className="space-y-px">
        {models.map((m) => (
          <PhaseModelRow key={m.modelId} model={m} tier={tier} />
        ))}
      </div>
    </div>
  );
}

// ─── PhaseModelRow ────────────────────────────────────────────────────────────

function PhaseModelRow({ model, tier }: { model: PhaseModelEntry; tier: Tier }) {
  const scoreProxy = Math.min(100, model.strengths.length * 20 + 40);

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 bg-surface-container-low border border-outline-variant/10 hover:bg-surface-container transition-colors items-center">
      {/* Name + provider */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Cpu size={10} className="text-on-surface-variant/40 shrink-0" />
          <span className="font-mono text-xs text-on-surface break-words leading-tight" title={model.modelId}>
            {model.modelName}
          </span>
        </div>
        <span className="font-mono text-[9px] text-on-surface-variant/40 ml-4">
          {model.providerId}
        </span>
      </div>

      {/* Context window */}
      <span className="font-mono text-[10px] text-on-surface-variant whitespace-nowrap">
        {(model.contextWindow / 1000).toFixed(0)}k
      </span>

      {/* Score bar */}
      <div className="w-16 flex items-center gap-1.5">
        <TrendingUp size={9} className="text-on-surface-variant/30 shrink-0" />
        <div className="flex-1 h-1 bg-surface-container-highest">
          <motion.div
            className={cn("h-full", TIER_BAR[tier])}
            initial={{ width: 0 }}
            animate={{ width: `${scoreProxy}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Score number */}
      <span className={cn("font-mono text-[10px] tabular-nums w-8 text-right", TIER_ACCENT[tier])}>
        {Math.round(model.score * 100)}%
      </span>
    </div>
  );
}

// ─── PrimaryModelCard ─────────────────────────────────────────────────────────

function PrimaryModelCard({ model }: { model: PhaseAssignment["primary"] }) {
  const tier = model.tier;
  const scoreProxy = Math.min(100, model.strengths.length * 20 + 40);

  return (
    <div className={cn("border-l-4 pl-4 py-3 bg-surface-container-highest", TIER_BORDER[tier])}>
      <div className="flex items-center justify-between">
        <div>
          <span className={cn("font-mono text-sm font-bold", TIER_ACCENT[tier])}>
            {model.name}
          </span>
          <p className="font-mono text-[10px] text-on-surface-variant mt-0.5">
            {model.providerId} · {(model.contextWindow / 1000).toFixed(0)}k ctx · ${model.costPer1M.toFixed(2)}/1M
          </p>
        </div>
        <span className={cn("font-mono text-xs uppercase tracking-widest font-bold", TIER_ACCENT[tier])}>
          {scoreProxy}%
        </span>
      </div>

      {/* Score bar */}
      <div className="mt-3 h-1.5 w-full bg-surface-container-low">
        <motion.div
          className={cn("h-full", TIER_BAR[tier])}
          initial={{ width: 0 }}
          animate={{ width: `${scoreProxy}%` }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        />
      </div>
    </div>
  );
}
