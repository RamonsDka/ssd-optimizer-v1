"use client";

// ─── InputModule ──────────────────────────────────────────────────────────────
// Textarea with "Ronin Tactical" focus style. Detects model count live.
// Submits to /api/optimize on click.

import { useState, useCallback } from "react";
import { Loader2, Zap } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { listCustomPhases } from "@/lib/optimizer/custom-phases";
import { readAdvancedOptions } from "@/components/optimizer/AdvancedOptions";
import type { TeamRecommendation } from "@/types";

interface InputModuleProps {
  onResult: (result: TeamRecommendation, meta?: { scoringVersion?: string }) => void;
  onError: (msg: string) => void;
  /** Optional callback fired the moment the user submits, before fetch completes. */
  onLoadingStart?: () => void;
  initialValue?: string;
  /**
   * Scoring strategy to request from /api/optimize.
   * Defaults to "env" so the SCORING_VERSION feature flag in .env governs
   * the backend engine selection. Use "v2"/"v3" only for explicit A/B overrides.
   * "auto" is accepted for backward compatibility but "env" is preferred.
   */
  scoringVersion?: "v2" | "v3" | "auto" | "env";
}

// ─── Detect model count heuristic ─────────────────────────────────────────────
// Split by newlines + commas, filter non-empty, count unique entries.

function countModels(text: string): number {
  const lines = text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  return new Set(lines.map((l) => l.toLowerCase())).size;
}

export default function InputModule({
  onResult,
  onError,
  onLoadingStart,
  initialValue = "",
  // Default is "env": defers engine selection to SCORING_VERSION in .env.
  // This ensures the feature flag controls production behavior when the user
  // has not explicitly selected a version override in the UI.
  scoringVersion = "env",
}: InputModuleProps) {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const { t, lang } = useLanguage();

  const modelCount = countModels(value);

  const handleSubmit = useCallback(async () => {
    if (!value.trim() || loading) return;

    setLoading(true);
    onLoadingStart?.();
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelList: value,
          customPhases: listCustomPhases(),
          advancedOptions: readAdvancedOptions() ?? undefined,
          scoringVersion,
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const raw = await res.text();
        onError(`HTTP ${res.status}: ${raw.slice(0, 160)}`);
        return;
      }

      const json = await res.json();

      if (!res.ok || !json.success) {
        onError(json.error ?? `Error ${res.status}`);
        return;
      }

      const result = json.data as TeamRecommendation;
      result.jobId = json.jobId;
      onResult(result, { scoringVersion: json.scoringVersion ?? scoringVersion });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red desconocido";
      onError(msg);
    } finally {
      setLoading(false);
    }
  }, [value, loading, onResult, onError, onLoadingStart, scoringVersion]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter submits
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <section
      className={cn(
        "p-1 border-l-4 transition-colors duration-200",
        focused ? "border-primary bg-surface-container-low" : "border-outline-variant/40 bg-surface-container-low"
      )}
    >
      <div className="bg-surface-container p-6 space-y-4">
        {/* Label row */}
        <div className="flex justify-between items-end">
          <label
            htmlFor="model-manifest"
            className="font-label text-xs uppercase tracking-[0.2em] text-primary"
          >
            {t("optimizer", "inputLabel")}
          </label>
          <div className="flex gap-4">
            <span className="text-[10px] font-mono text-secondary bg-secondary/10 px-2 py-0.5">
              {t("optimizer", "inputTypoSupport")}
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">
              {t("optimizer", "inputDetected")}{" "}
              <span className={cn("text-primary", modelCount > 0 && "font-bold")}>
                {modelCount}
              </span>
            </span>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          id="model-manifest"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className={cn(
            "w-full bg-surface-container-highest text-on-surface font-mono text-sm p-6",
            "min-h-[200px] placeholder:text-outline-variant resize-y",
            "border-none outline-none focus:ring-0",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "transition-colors duration-200",
            focused && "bg-surface-bright"
          )}
          placeholder={t("optimizer", "inputPlaceholder")}
          aria-label={lang === "es" ? "Lista de modelos a optimizar" : "Model list to optimize"}
        />

        {/* Actions row */}
        <div className="flex justify-between items-center">
          <div className="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest">
            {value.length > 0 && (
              <button
                onClick={() => setValue("")}
                className="hover:text-error transition-colors"
              >
                [ {t("optimizer", "inputClear").replace("[", "").replace("]", "").trim()} ]
              </button>
            )}
          </div>

          <motion.button
            onClick={handleSubmit}
            disabled={loading || modelCount === 0}
            whileHover={!loading && modelCount > 0 ? { scale: 1.02 } : {}}
            whileTap={!loading && modelCount > 0 ? { scale: 0.98 } : {}}
            className={cn(
              "flex items-center gap-2 px-8 py-3 font-black text-xs tracking-widest uppercase transition-all",
              "bg-primary-container text-on-primary-container",
              "hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed"
            )}
            aria-label="Ejecutar optimización"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>{t("optimizer", "inputProcessing")}</span>
              </>
            ) : (
              <>
                <Zap size={14} />
                <span>{t("optimizer", "inputButton")}</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    </section>
  );
}
