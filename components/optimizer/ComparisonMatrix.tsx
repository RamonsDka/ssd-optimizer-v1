"use client";

// ─── ComparisonMatrix ─────────────────────────────────────────────────────────
// Side-by-side comparison of Scoring V2 vs V3 for each SDD phase.
//
// Shows:
//   - The primary model selected per phase under each engine version
//   - The score each engine assigned to that model
//   - A delta indicator (V3 - V2) with colour coding
//   - A coverage badge ("V3 OIM" or "V2 Arena") signalling data source
//
// Task: 7.5.2

import { useMemo } from "react";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Minus, Database, Zap } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { TeamRecommendation, SddPhase, Tier } from "@/types";
import { SDD_PHASE_LABELS } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComparisonMatrixProps {
  /** V2 recommendation (from the LM Arena scoring engine) */
  v2Recommendation: TeamRecommendation;
  /** V3 recommendation (from the OIM multi-dimensional engine), or null if unavailable */
  v3Recommendation: TeamRecommendation | null;
  /** Which tier to display */
  activeTier: Tier;
  /** Called when the user changes the active tier */
  onSelectTier?: (tier: Tier) => void;
  /** Additional class names */
  className?: string;
}

interface MatrixRow {
  phase: SddPhase | string;
  phaseLabel: string;
  v2Model: string;
  v2Score: number;
  v3Model: string | null;
  v3Score: number | null;
  delta: number | null;
  modelChanged: boolean;
  v3Available: boolean;
}

// ─── Tier color map ───────────────────────────────────────────────────────────

const TIER_COLORS: Record<Tier, string> = {
  PREMIUM:  "border-secondary text-secondary",
  BALANCED: "border-primary text-primary",
  ECONOMIC: "border-outline text-on-surface-variant",
};

const TIER_BAR_COLORS: Record<Tier, string> = {
  PREMIUM:  "bg-secondary",
  BALANCED: "bg-primary",
  ECONOMIC: "bg-outline",
};

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, colorClass }: { score: number; colorClass: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  return (
    <div className="flex items-center gap-2 mt-0.5">
      <div className="w-16 h-0.5 bg-surface-container-highest">
        <div
          className={cn("h-full transition-all duration-500", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] font-mono text-on-surface-variant tabular-nums">
        {(score * 100).toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Delta badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-on-surface-variant/40">
        <Minus size={9} />
        —
      </span>
    );
  }
  const pct = (delta * 100).toFixed(1);
  if (Math.abs(delta) < 0.005) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-on-surface-variant">
        <Minus size={9} />
        ≈0
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400">
        <TrendingUp size={9} />+{pct}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-error/80">
      <TrendingDown size={9} />{pct}%
    </span>
  );
}

// ─── Tier toggle ──────────────────────────────────────────────────────────────

const TIERS: Tier[] = ["PREMIUM", "BALANCED", "ECONOMIC"];

function TierToggle({
  active,
  onChange,
}: {
  active: Tier;
  onChange?: (tier: Tier) => void;
}) {
  return (
    <div className="flex gap-1">
      {TIERS.map((tier) => (
        <button
          key={tier}
          onClick={() => onChange?.(tier)}
          className={cn(
            "px-3 py-1 font-mono text-[9px] uppercase tracking-widest border transition-colors",
            active === tier
              ? cn("border-opacity-100", TIER_COLORS[tier], "bg-surface-container-high")
              : "border-outline-variant/20 text-on-surface-variant/50 hover:border-outline-variant/40 hover:text-on-surface-variant"
          )}
        >
          {tier}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComparisonMatrix({
  v2Recommendation,
  v3Recommendation,
  activeTier,
  onSelectTier,
  className,
}: ComparisonMatrixProps) {
  const { lang } = useLanguage();

  const tierKey = activeTier.toLowerCase() as "premium" | "balanced" | "economic";

  const rows = useMemo<MatrixRow[]>(() => {
    const v2Profile = v2Recommendation[tierKey];
    const v3Profile = v3Recommendation?.[tierKey] ?? null;

    return v2Profile.phases.map((v2Phase) => {
      const phaseId = v2Phase.phase;

      const v3Phase = v3Profile?.phases.find((p) => p.phase === phaseId) ?? null;

      const v2Score = v2Phase.score ?? 0;
      const v3Score = v3Phase?.score ?? null;
      const delta = v3Score !== null ? v3Score - v2Score : null;
      const modelChanged =
        v3Phase !== null &&
        v3Phase.primary.id !== v2Phase.primary.id;

      const phaseLabel =
        phaseId in SDD_PHASE_LABELS
          ? SDD_PHASE_LABELS[phaseId as SddPhase][lang]
          : phaseId;

      return {
        phase: phaseId,
        phaseLabel,
        v2Model: v2Phase.primary.name ?? v2Phase.primary.id,
        v2Score,
        v3Model: v3Phase?.primary.name ?? v3Phase?.primary.id ?? null,
        v3Score,
        delta,
        modelChanged,
        v3Available: v3Phase !== null,
      };
    });
  }, [v2Recommendation, v3Recommendation, tierKey, lang]);

  const totalPhases = rows.length;
  const changedPhases = rows.filter((r) => r.modelChanged).length;
  const v3AvailableCount = rows.filter((r) => r.v3Available).length;
  const avgDelta =
    rows.filter((r) => r.delta !== null).length > 0
      ? rows.reduce((sum, r) => sum + (r.delta ?? 0), 0) /
        rows.filter((r) => r.delta !== null).length
      : null;

  const barColor = TIER_BAR_COLORS[activeTier];

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <div className="bg-surface-container-low">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-high border-l-4 border-primary flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-mono font-bold text-xs uppercase tracking-[0.2em] text-primary">
              V2 vs V3 Comparison Matrix
            </h3>
            <p className="text-[9px] font-mono text-on-surface-variant/60 mt-0.5">
              Side-by-side scoring engine comparison across all SDD phases
            </p>
          </div>
          <TierToggle active={activeTier} onChange={onSelectTier} />
        </div>

        {/* Summary bar */}
        <div className="px-6 py-3 bg-surface-container flex flex-wrap gap-6 border-b border-outline-variant/10">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-mono text-on-surface-variant/60 uppercase tracking-widest">
              Phases
            </span>
            <span className="text-sm font-mono font-bold text-on-surface">
              {totalPhases}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-mono text-on-surface-variant/60 uppercase tracking-widest">
              Model Changes
            </span>
            <span
              className={cn(
                "text-sm font-mono font-bold",
                changedPhases > 0 ? "text-secondary" : "text-on-surface-variant"
              )}
            >
              {changedPhases}
              <span className="text-[9px] text-on-surface-variant font-normal ml-1">
                / {totalPhases}
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-mono text-on-surface-variant/60 uppercase tracking-widest">
              V3 Coverage
            </span>
            <span
              className={cn(
                "text-sm font-mono font-bold",
                v3AvailableCount === totalPhases
                  ? "text-emerald-400"
                  : v3AvailableCount > 0
                  ? "text-secondary"
                  : "text-on-surface-variant/40"
              )}
            >
              {v3AvailableCount}
              <span className="text-[9px] text-on-surface-variant font-normal ml-1">
                / {totalPhases}
              </span>
            </span>
          </div>
          {avgDelta !== null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-mono text-on-surface-variant/60 uppercase tracking-widest">
                Avg Delta
              </span>
              <DeltaBadge delta={avgDelta} />
            </div>
          )}
        </div>

        {/* Table */}
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="text-on-surface-variant border-b border-outline-variant/10">
              <th className="px-4 py-3 font-normal uppercase tracking-widest text-[9px] w-32">Phase</th>
              {/* V2 columns */}
              <th className="px-4 py-3 font-normal uppercase tracking-widest text-[9px] border-l border-outline-variant/10">
                <span className="flex items-center gap-1">
                  <Database size={8} className="text-on-surface-variant/60" />
                  V2 Model
                </span>
              </th>
              <th className="px-4 py-3 font-normal uppercase tracking-widest text-[9px]">V2 Score</th>
              {/* V3 columns */}
              <th className="px-4 py-3 font-normal uppercase tracking-widest text-[9px] border-l border-outline-variant/10">
                <span className="flex items-center gap-1">
                  <Zap size={8} className="text-primary/60" />
                  V3 Model
                </span>
              </th>
              <th className="px-4 py-3 font-normal uppercase tracking-widest text-[9px]">V3 Score</th>
              {/* Delta column */}
              <th className="px-4 py-3 font-normal uppercase tracking-widest text-[9px] border-l border-outline-variant/10">
                Δ Delta
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <motion.tr
                key={row.phase}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                className={cn(
                  "border-b border-outline-variant/5 transition-colors",
                  row.modelChanged && "bg-surface-container/60"
                )}
              >
                {/* Phase */}
                <td className="px-4 py-3">
                  <span className="text-[10px] font-mono text-on-surface-variant font-medium">
                    {row.phaseLabel}
                  </span>
                  <div className="text-[8px] text-on-surface-variant/40 mt-0.5">
                    {row.phase}
                  </div>
                </td>

                {/* V2 model */}
                <td className="px-4 py-3 border-l border-outline-variant/10">
                  <span
                    className="text-[10px] text-on-surface break-words leading-tight block max-w-[140px]"
                    title={row.v2Model}
                  >
                    {row.v2Model}
                  </span>
                  <span className="text-[8px] font-mono text-on-surface-variant/40 mt-0.5 inline-flex items-center gap-1">
                    <Database size={7} />
                    LM Arena
                  </span>
                </td>

                {/* V2 score */}
                <td className="px-4 py-3">
                  <ScoreBar score={row.v2Score} colorClass="bg-outline" />
                </td>

                {/* V3 model */}
                <td className="px-4 py-3 border-l border-outline-variant/10">
                  {row.v3Available && row.v3Model ? (
                    <>
                      <span
                        className={cn(
                          "text-[10px] break-words leading-tight block max-w-[140px]",
                          row.modelChanged ? "text-primary font-semibold" : "text-on-surface"
                        )}
                        title={row.v3Model}
                      >
                        {row.v3Model}
                      </span>
                      <span className="text-[8px] font-mono text-primary/50 mt-0.5 inline-flex items-center gap-1">
                        <Zap size={7} />
                        OIM Matrix
                        {row.modelChanged && (
                          <span className="text-secondary ml-1">↑ changed</span>
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="text-[9px] text-on-surface-variant/30 font-mono">
                      — no OIM data
                    </span>
                  )}
                </td>

                {/* V3 score */}
                <td className="px-4 py-3">
                  {row.v3Score !== null ? (
                    <ScoreBar score={row.v3Score} colorClass={barColor} />
                  ) : (
                    <span className="text-[9px] text-on-surface-variant/30 font-mono">—</span>
                  )}
                </td>

                {/* Delta */}
                <td className="px-4 py-3 border-l border-outline-variant/10">
                  <DeltaBadge delta={row.delta} />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-outline-variant/5 text-[9px] font-mono text-on-surface-variant/40 flex justify-between">
          <span>
            V2: LM Arena weighted scoring · V3: OIM multi-dimensional matrix
          </span>
          <span>
            {v3AvailableCount > 0
              ? `V3 data available for ${v3AvailableCount}/${totalPhases} phases`
              : "V3 OIM data not yet populated"}
          </span>
        </div>
      </div>
    </div>
  );
}
