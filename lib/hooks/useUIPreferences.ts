"use client";

// ─── useUIPreferences ─────────────────────────────────────────────────────────
// Custom hook that manages user-controlled UI preferences via localStorage.
// These are SEPARATE from FeatureFlags (API connectivity status) in useSettings.
//
// Managed preferences:
//   - timezone: IANA timezone string (default: Intl.DateTimeFormat default)
//   - theme: 'dark' | 'light' (dark-only for now; light is future)
//   - defaultViewMode: 'grid' | 'list' | 'table' | 'compact'
//   - autoSave: boolean (default: true) — auto-persist optimizer results
//   - historyRetention: '7d' | '30d' | '90d' | 'forever' — history purge window
//
// Each preference uses getSessionKey() for session-scoped storage isolation.
// All reads happen inside useEffect to guard against SSR.

import { useState, useEffect, useCallback } from "react";
import { getSessionKey } from "@/lib/session/session-manager";
import type { ViewMode } from "@/components/shared/ViewModeSelector";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppTheme = "dark" | "light";
export type HistoryRetention = "7d" | "30d" | "90d" | "forever";

export interface UIPreferences {
  timezone: string;
  theme: AppTheme;
  defaultViewMode: ViewMode;
  autoSave: boolean;
  historyRetention: HistoryRetention;
  confidenceThreshold: number;
}

export interface UseUIPreferencesReturn {
  preferences: UIPreferences;
  setTimezone: (tz: string) => void;
  setTheme: (theme: AppTheme) => void;
  setDefaultViewMode: (mode: ViewMode) => void;
  setAutoSave: (enabled: boolean) => void;
  setHistoryRetention: (retention: HistoryRetention) => void;
  setConfidenceThreshold: (value: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  timezone:            "sdd-ui-timezone",
  theme:               "sdd-ui-theme",
  defaultViewMode:     "sdd-ui-defaultViewMode",
  autoSave:            "sdd-ui-autoSave",
  historyRetention:    "sdd-ui-historyRetention",
  confidenceThreshold: "sdd-ui-confidenceThreshold",
} as const;

const VALID_RETENTION: HistoryRetention[] = ["7d", "30d", "90d", "forever"];

function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

const DEFAULTS: UIPreferences = {
  timezone:            getSystemTimezone(),
  theme:               "dark",
  defaultViewMode:     "grid",
  autoSave:            true,
  historyRetention:    "30d",
  confidenceThreshold: 0.5,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUIPreferences(): UseUIPreferencesReturn {
  const [preferences, setPreferences] = useState<UIPreferences>(DEFAULTS);

  // ── Hydrate from localStorage on mount ──────────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const timezone           = localStorage.getItem(getSessionKey(STORAGE_KEYS.timezone));
      const theme              = localStorage.getItem(getSessionKey(STORAGE_KEYS.theme));
      const viewMode           = localStorage.getItem(getSessionKey(STORAGE_KEYS.defaultViewMode));
      const autoSaveRaw        = localStorage.getItem(getSessionKey(STORAGE_KEYS.autoSave));
      const retentionRaw       = localStorage.getItem(getSessionKey(STORAGE_KEYS.historyRetention));
      const thresholdRaw       = localStorage.getItem(getSessionKey(STORAGE_KEYS.confidenceThreshold));
      const parsedThreshold    = thresholdRaw !== null ? parseFloat(thresholdRaw) : NaN;

      setPreferences({
        timezone:            timezone ?? getSystemTimezone(),
        theme:               (theme === "light" ? "light" : "dark") as AppTheme,
        defaultViewMode:     (["grid", "list", "table", "compact"].includes(viewMode ?? "")
          ? (viewMode as ViewMode)
          : "grid"),
        autoSave:            autoSaveRaw === null ? true : autoSaveRaw === "true",
        historyRetention:    (VALID_RETENTION.includes(retentionRaw as HistoryRetention)
          ? (retentionRaw as HistoryRetention)
          : "30d"),
        confidenceThreshold: (!isNaN(parsedThreshold) && parsedThreshold >= 0 && parsedThreshold <= 1)
          ? parsedThreshold
          : 0.5,
      });
    } catch {
      // localStorage unavailable — keep defaults
    }
  }, []);

  // ── Setters ─────────────────────────────────────────────────────────────────

  const setTimezone = useCallback((tz: string): void => {
    setPreferences((prev) => ({ ...prev, timezone: tz }));
    try {
      localStorage.setItem(getSessionKey(STORAGE_KEYS.timezone), tz);
    } catch {
      // ignore
    }
  }, []);

  const setTheme = useCallback((theme: AppTheme): void => {
    setPreferences((prev) => ({ ...prev, theme }));
    try {
      localStorage.setItem(getSessionKey(STORAGE_KEYS.theme), theme);
    } catch {
      // ignore
    }
  }, []);

  const setDefaultViewMode = useCallback((mode: ViewMode): void => {
    setPreferences((prev) => ({ ...prev, defaultViewMode: mode }));
    try {
      localStorage.setItem(getSessionKey(STORAGE_KEYS.defaultViewMode), mode);
    } catch {
      // ignore
    }
  }, []);

  const setAutoSave = useCallback((enabled: boolean): void => {
    setPreferences((prev) => ({ ...prev, autoSave: enabled }));
    try {
      localStorage.setItem(getSessionKey(STORAGE_KEYS.autoSave), String(enabled));
    } catch {
      // ignore
    }
  }, []);

  const setHistoryRetention = useCallback((retention: HistoryRetention): void => {
    setPreferences((prev) => ({ ...prev, historyRetention: retention }));
    try {
      localStorage.setItem(getSessionKey(STORAGE_KEYS.historyRetention), retention);
    } catch {
      // ignore
    }
  }, []);

  const setConfidenceThreshold = useCallback((value: number): void => {
    // Clamp to [0, 1] range
    const clamped = Math.min(1, Math.max(0, value));
    setPreferences((prev) => ({ ...prev, confidenceThreshold: clamped }));
    try {
      localStorage.setItem(getSessionKey(STORAGE_KEYS.confidenceThreshold), String(clamped));
    } catch {
      // ignore
    }
  }, []);

  return {
    preferences,
    setTimezone,
    setTheme,
    setDefaultViewMode,
    setAutoSave,
    setHistoryRetention,
    setConfidenceThreshold,
  };
}
