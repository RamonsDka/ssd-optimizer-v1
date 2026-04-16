"use client";

// ─── AdvancedScoringSection (4.2.4) ──────────────────────────────────────────
// Settings section for Advanced Scoring configuration.
// Responsibilities:
//   - Toggle feature flags that influence the scoring engine behaviour.
//     These are user-controlled local overrides (via useSettings.update()).
//   - Provide a confidence threshold slider (SettingsSlider, local UI pref
//     managed by useUIPreferences — no server round-trip needed).
//
// Feature flag overrides written are:
//   - geminiConfigured: boolean (enables/disables AI discovery pass)
//
// Note: databaseConnected and nodeEnv are server-derived, read-only — not
// exposed here.  openrouterConfigured is shown read-only in DataSync section.

import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsToggle } from "@/components/settings/controls/SettingsToggle";
import { SettingsSlider } from "@/components/settings/controls/SettingsSlider";
import type { FeatureFlags } from "@/app/api/settings/route";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdvancedScoringSectionProps {
  /** Current resolved feature flags (server + local overrides merged). */
  flags: FeatureFlags;
  /**
   * Partial update for user-controllable flags.
   * Only geminiConfigured is exposed as a toggle here.
   */
  onFlagChange: (overrides: Partial<Pick<FeatureFlags, "geminiConfigured">>) => void;
  /** Confidence threshold [0, 1]. Managed by useUIPreferences. */
  confidenceThreshold: number;
  /** Called when the slider changes. */
  onThresholdChange: (value: number) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdvancedScoringSection({
  flags,
  onFlagChange,
  confidenceThreshold,
  onThresholdChange,
}: AdvancedScoringSectionProps) {
  return (
    <SettingsSection
      title="Advanced Scoring"
      description="Control the scoring engine flags and confidence parameters used during model optimization."
      accent="secondary"
    >
      <div className="border border-outline-variant/20 bg-surface-container-low px-6">
        {/* ── Gemini AI Discovery toggle ──────────────────────────────── */}
        <SettingsToggle
          id="flag-gemini-ai"
          label="Gemini AI Discovery"
          description="Uses Gemini AI to categorize models and surface AI-discovered candidates. Requires GEMINI_API_KEY."
          checked={flags.geminiConfigured}
          onChange={(val) => onFlagChange({ geminiConfigured: val })}
          disabled={false}
          disabledReason="GEMINI_API_KEY is not set in the environment."
        />

        {/* ── OpenRouter sync status (read-only indicator) ────────────── */}
        <SettingsToggle
          id="flag-openrouter"
          label="OpenRouter Sync"
          description="Enables automatic model catalogue sync from OpenRouter. Managed via OPENROUTER_API_KEY."
          checked={flags.openrouterConfigured}
          onChange={() => {
            // Read-only — driven by server env var; toggle is informational
          }}
          disabled
          disabledReason="Controlled by OPENROUTER_API_KEY environment variable. Toggle in Data Sync section."
        />

        {/* ── Database connectivity (read-only indicator) ─────────────── */}
        <SettingsToggle
          id="flag-database"
          label="Database Connection"
          description="PostgreSQL connection required for all scoring and history operations."
          checked={flags.databaseConnected}
          onChange={() => {
            // Read-only — server-derived; not user-toggleable
          }}
          disabled
          disabledReason="Reflects live DATABASE_URL connection status. Not user-configurable."
        />

        {/* ── Confidence threshold slider ─────────────────────────────── */}
        <SettingsSlider
          id="confidence-threshold"
          label="Confidence Threshold"
          description="Minimum model confidence score to be included in optimizer results. Lower values include more candidates; higher values are more selective."
          value={confidenceThreshold}
          onChange={onThresholdChange}
          min={0}
          max={1}
          step={0.05}
          format={formatPct}
        />
      </div>
    </SettingsSection>
  );
}
