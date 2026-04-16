"use client";

// ─── AppearanceSection (4.2.2) ────────────────────────────────────────────────
// Settings section for Appearance preferences.
// Uses:
//   - useUIPreferences() for theme + defaultViewMode (persisted in localStorage)
//
// Theme note: only "dark" is functional at this time.
// "light" is rendered as a disabled/coming-soon option.

import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsSelect } from "@/components/settings/controls/SettingsSelect";
import { useUIPreferences } from "@/lib/hooks/useUIPreferences";
import type { AppTheme } from "@/lib/hooks/useUIPreferences";
import type { ViewMode } from "@/components/shared/ViewModeSelector";
import type { SelectOption } from "@/components/settings/controls/SettingsSelect";

// ─── Data ─────────────────────────────────────────────────────────────────────

const THEME_OPTIONS: SelectOption[] = [
  { value: "dark",  label: "🌙 Dark (active)" },
  { value: "light", label: "☀️ Light (coming soon)" },
];

const VIEW_MODE_OPTIONS: SelectOption[] = [
  { value: "grid",    label: "Grid — Card layout" },
  { value: "list",    label: "List — Detailed rows" },
  { value: "table",   label: "Table — Compact data" },
  { value: "compact", label: "Compact — Dense overview" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AppearanceSection() {
  const { preferences, setTheme, setDefaultViewMode } = useUIPreferences();

  return (
    <SettingsSection
      title="Appearance"
      description="Visual theme and default layout for model and optimizer views."
      accent="tertiary"
    >
      <div className="border border-outline-variant/20 bg-surface-container-low px-6">
        {/* Theme selector — light is disabled until theme system is wired */}
        <SettingsSelect
          id="theme-select"
          label="Theme"
          description="Light theme is coming in a future update."
          value={preferences.theme}
          onChange={(val) => setTheme(val as AppTheme)}
          options={THEME_OPTIONS}
        />

        {/* Default view mode — persisted and used as initial state on model/optimizer pages */}
        <SettingsSelect
          id="viewmode-select"
          label="Default View Mode"
          description="Initial layout when opening Models or Optimizer pages."
          value={preferences.defaultViewMode}
          onChange={(val) => setDefaultViewMode(val as ViewMode)}
          options={VIEW_MODE_OPTIONS}
        />
      </div>
    </SettingsSection>
  );
}
