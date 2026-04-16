"use client";

// ─── DataManagementSection (4.2.5) ────────────────────────────────────────────
// Settings section for Data Management.
// Responsibilities:
//   - Auto-save toggle (persisted via useUIPreferences)
//   - History retention select (persisted via useUIPreferences)
//   - Export Data placeholder button
//   - Import Data placeholder button
//
// All preferences are local UI prefs (no server write needed).

import { Download, Upload } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsToggle } from "@/components/settings/controls/SettingsToggle";
import { SettingsSelect } from "@/components/settings/controls/SettingsSelect";
import type { HistoryRetention } from "@/lib/hooks/useUIPreferences";
import type { SelectOption } from "@/components/settings/controls/SettingsSelect";

// ─── Data ─────────────────────────────────────────────────────────────────────

const RETENTION_OPTIONS: SelectOption[] = [
  { value: "7d",      label: "7 days" },
  { value: "30d",     label: "30 days" },
  { value: "90d",     label: "90 days" },
  { value: "forever", label: "Forever (no purge)" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataManagementSectionProps {
  /** Whether optimizer results are auto-saved to localStorage. */
  autoSave: boolean;
  /** Callback when auto-save toggle changes. */
  onAutoSaveChange: (enabled: boolean) => void;
  /** History purge window. */
  historyRetention: HistoryRetention;
  /** Callback when history retention selection changes. */
  onHistoryRetentionChange: (retention: HistoryRetention) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataManagementSection({
  autoSave,
  onAutoSaveChange,
  historyRetention,
  onHistoryRetentionChange,
}: DataManagementSectionProps) {
  const handleExport = () => {
    // Placeholder — future: serialize localStorage / DB export to JSON
    console.info("[DataManagement] Export clicked — not yet implemented.");
  };

  const handleImport = () => {
    // Placeholder — future: open file picker and import JSON
    console.info("[DataManagement] Import clicked — not yet implemented.");
  };

  return (
    <SettingsSection
      title="Data Management"
      description="Control how optimizer results and history are persisted, retained, and transferred."
      accent="tertiary"
    >
      <div className="border border-outline-variant/20 bg-surface-container-low px-6">
        {/* ── Auto-save toggle ─────────────────────────────────────────── */}
        <SettingsToggle
          id="auto-save"
          label="Auto-Save Results"
          description="Automatically persist optimizer results to local storage after each run."
          checked={autoSave}
          onChange={onAutoSaveChange}
        />

        {/* ── History retention select ─────────────────────────────────── */}
        <SettingsSelect
          id="history-retention"
          label="History Retention"
          description="Automatically purge optimization history older than the selected period."
          value={historyRetention}
          onChange={(val) => onHistoryRetentionChange(val as HistoryRetention)}
          options={RETENTION_OPTIONS}
        />

        {/* ── Export / Import placeholder buttons ─────────────────────── */}
        <div className="py-4 flex flex-wrap gap-3">
          {/* Export */}
          <button
            onClick={handleExport}
            title="Export coming soon"
            className={cn(
              "flex items-center gap-2 px-4 py-2",
              "font-mono text-[10px] uppercase tracking-widest",
              "border border-outline-variant/30 text-on-surface-variant/60",
              "hover:border-primary/40 hover:text-primary",
              "transition-colors opacity-60 cursor-not-allowed"
            )}
            disabled
          >
            <Download size={10} />
            Export Data
          </button>

          {/* Import */}
          <button
            onClick={handleImport}
            title="Import coming soon"
            className={cn(
              "flex items-center gap-2 px-4 py-2",
              "font-mono text-[10px] uppercase tracking-widest",
              "border border-outline-variant/30 text-on-surface-variant/60",
              "hover:border-primary/40 hover:text-primary",
              "transition-colors opacity-60 cursor-not-allowed"
            )}
            disabled
          >
            <Upload size={10} />
            Import Data
          </button>

          <span className="self-center font-mono text-[9px] text-on-surface-variant/30 uppercase tracking-widest">
            — coming soon
          </span>
        </div>
      </div>
    </SettingsSection>
  );
}
