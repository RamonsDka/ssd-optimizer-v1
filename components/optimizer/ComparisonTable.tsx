"use client";

// ─── ComparisonTable ──────────────────────────────────────────────────────────
// Compares the 3 profiles side-by-side: cost, context, coverage, resolved %.

import { Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useCopyFeedback } from "@/lib/hooks/useCopyFeedback";
import type { TeamRecommendation, Tier } from "@/types";

interface ComparisonTableProps {
  recommendation: TeamRecommendation;
  activeTier: Tier;
  onSelectTier: (tier: Tier) => void;
}

interface ProfileRow {
  tier: Tier;
  label: string;
  totalCost: string;
  avgContext: string;
  phasesCovered: number;
  topModel: string;
  colorClass: string;
}

export default function ComparisonTable({
  recommendation,
  activeTier,
  onSelectTier,
}: ComparisonTableProps) {
  const { t, lang } = useLanguage();
  const { copied, copy } = useCopyFeedback();
  const { premium, balanced, economic } = recommendation;

  const rows: ProfileRow[] = [
    {
      tier: "PREMIUM",
      label: "Premium",
      totalCost: `$${premium.totalEstimatedCost.toFixed(2)}`,
      avgContext: `${(premium.avgContextWindow / 1000).toFixed(0)}k`,
      phasesCovered: premium.phases.length,
      topModel: premium.phases[0]?.primary.name ?? "—",
      colorClass: "text-secondary",
    },
    {
      tier: "BALANCED",
      label: "Balanced",
      totalCost: `$${balanced.totalEstimatedCost.toFixed(2)}`,
      avgContext: `${(balanced.avgContextWindow / 1000).toFixed(0)}k`,
      phasesCovered: balanced.phases.length,
      topModel: balanced.phases[0]?.primary.name ?? "—",
      colorClass: "text-primary",
    },
    {
      tier: "ECONOMIC",
      label: "Economic",
      totalCost: `$${economic.totalEstimatedCost.toFixed(2)}`,
      avgContext: `${(economic.avgContextWindow / 1000).toFixed(0)}k`,
      phasesCovered: economic.phases.length,
      topModel: economic.phases[0]?.primary.name ?? "—",
      colorClass: "text-on-surface-variant",
    },
  ];

  // Unresolved models info
  const unresolvedCount = recommendation.unresolvedModels.length;
  const inputCount = recommendation.inputModels.length;

  // Build a plain-text manifest for clipboard export
  const buildManifestText = () => {
    const lines: string[] = [
      `SDD Team Optimizer — Manifest Export`,
      `Generated: ${new Date(recommendation.generatedAt).toLocaleString(lang === "es" ? "es-AR" : "en-US")}`,
      `Input models analyzed: ${inputCount}`,
      "",
    ];

    for (const row of rows) {
      lines.push(`## ${row.tier} PROFILE`);
      lines.push(`  Cost/1M (sum):     ${row.totalCost}`);
      lines.push(`  Avg Context:       ${row.avgContext}`);
      lines.push(`  Phases Covered:    ${row.phasesCovered}/10`);
      lines.push(`  Top Model (Init):  ${row.topModel}`);
      lines.push("");
    }

    return lines.join("\n").trim();
  };

  return (
    <div className="overflow-x-auto">
      <div className="bg-surface-container-low">
        {/* Table header banner */}
        <div className="px-6 py-4 bg-surface-container-high border-l-4 border-secondary flex justify-between items-center">
          <h2 className="font-mono font-bold text-xs uppercase tracking-[0.2em] text-secondary">
            {t("optimizer", "advancedComparison")}
          </h2>
          <div className="flex items-center gap-4">
            {unresolvedCount > 0 && (
              <span className="text-[10px] font-mono text-error/70">
                ⚠ {unresolvedCount}/{inputCount} {t("optimizer", "unresolvedWarn")}
              </span>
            )}
            {/* Copy manifest button — green checkmark on success */}
            <button
              onClick={() => copy(buildManifestText())}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest",
                "border transition-colors",
                copied
                  ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/10"
                  : "border-secondary/30 text-secondary/70 hover:text-secondary hover:border-secondary/60 hover:bg-secondary/5"
              )}
              aria-label="Copiar manifest"
              title="Copiar manifest al portapapeles"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Check size={11} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Copy size={11} />
                  </motion.span>
                )}
              </AnimatePresence>
              {copied ? "Copiado" : "Copy"}
            </button>
          </div>
        </div>

        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="text-on-surface-variant border-b border-outline-variant/10">
              <th className="px-6 py-4 font-normal uppercase tracking-widest">{t("optimizer", "colProfile")}</th>
              <th className="px-6 py-4 font-normal uppercase tracking-widest">{t("optimizer", "colCost")}</th>
              <th className="px-6 py-4 font-normal uppercase tracking-widest">{t("optimizer", "colCtx")}</th>
              <th className="px-6 py-4 font-normal uppercase tracking-widest">{t("optimizer", "colPhases")}</th>
              <th className="px-6 py-4 font-normal uppercase tracking-widest">{t("optimizer", "colTopModel")}</th>
              <th className="px-6 py-4 font-normal uppercase tracking-widest">{t("optimizer", "colCoverage")}</th>
            </tr>
          </thead>
          <tbody className="text-on-surface">
            {rows.map((row) => {
              const isActive = activeTier === row.tier;
              const coveragePct = Math.round((row.phasesCovered / 10) * 100);

              return (
                <tr
                  key={row.tier}
                  onClick={() => onSelectTier(row.tier)}
                  className={cn(
                    "border-b border-outline-variant/5 transition-colors cursor-pointer",
                    isActive
                      ? "bg-surface-container-highest/80"
                      : "hover:bg-surface-container-highest/50"
                  )}
                >
                  {/* Tier name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <div
                          className={cn(
                            "w-1.5 h-1.5",
                            row.tier === "PREMIUM"
                              ? "bg-secondary"
                              : row.tier === "BALANCED"
                              ? "bg-primary"
                              : "bg-outline-variant"
                          )}
                        />
                      )}
                      <span className={cn("font-bold", row.colorClass, !isActive && "opacity-70")}>
                        {row.label.toUpperCase()}
                      </span>
                    </div>
                  </td>

                  {/* Cost */}
                  <td className={cn("px-6 py-4", row.colorClass, !isActive && "opacity-60")}>
                    {row.totalCost}
                  </td>

                  {/* Avg Context */}
                  <td className="px-6 py-4 text-on-surface-variant">
                    {row.avgContext}
                  </td>

                  {/* Phases covered */}
                  <td className="px-6 py-4">
                    <span className={cn(row.colorClass, !isActive && "opacity-60")}>
                      {row.phasesCovered}
                    </span>
                    <span className="text-on-surface-variant">/10</span>
                  </td>

                  {/* Top model */}
                  <td className="px-6 py-4 text-on-surface-variant break-words leading-tight max-w-[160px]">
                    <span title={row.topModel}>
                      {row.topModel}
                    </span>
                  </td>

                  {/* Coverage bar */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1 bg-surface-container-highest">
                        <div
                          className={cn(
                            "h-full transition-all duration-500",
                            row.tier === "PREMIUM"
                              ? "bg-secondary"
                              : row.tier === "BALANCED"
                              ? "bg-primary"
                              : "bg-outline"
                          )}
                          style={{ width: `${coveragePct}%` }}
                        />
                      </div>
                      <span className="text-on-surface-variant text-[9px]">
                        {coveragePct}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer: generated at */}
        <div className="px-6 py-3 border-t border-outline-variant/5 text-[9px] font-mono text-on-surface-variant/40 flex justify-between">
          <span>{t("optimizer", "generatedAt")} {new Date(recommendation.generatedAt).toLocaleString(lang === "es" ? "es-AR" : "en-US")}</span>
          <span>{inputCount} {t("optimizer", "inputAnalyzed")}</span>
        </div>
      </div>
    </div>
  );
}
