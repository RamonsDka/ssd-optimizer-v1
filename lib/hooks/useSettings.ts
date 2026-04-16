"use client";

// ─── useSettings ─────────────────────────────────────────────────────────────
// Custom hook that manages settings state:
//   - Fetches from GET /api/settings on mount
//   - Persists user-controlled feature flag overrides in localStorage
//   - Provides update() to write overrides to /api/settings (no-op endpoint
//     for now — persists locally; the orchestrator wires real write logic)
//
// Contract:
//   - data: null while loading or on error
//   - loading: true during initial fetch and any subsequent refresh
//   - error: string | null — populated on fetch failure
//   - refresh(): re-fetches from the API
//   - update(partial): merges a partial flags update into local state and
//     persists the override to localStorage
//   - clearOverrides(): removes any local overrides; next refresh gets fresh data
//
// SSR safety: localStorage reads happen inside useEffect only.

import { useState, useEffect, useCallback } from "react";
import type {
  SettingsResponse,
  SettingsErrorResponse,
  SystemStats,
  FeatureFlags,
} from "@/app/api/settings/route";
import { getSessionKey } from "@/lib/session/session-manager";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Merged view: server data + any user-applied local overrides. */
export interface SettingsState {
  stats: SystemStats;
  flags: FeatureFlags;
}

/** Shape of locally-persisted flag overrides in localStorage. */
type FlagOverrides = Partial<Omit<FeatureFlags, "nodeEnv" | "databaseConnected">>;

export interface UseSettingsReturn {
  /** Current settings data. null while loading or if a fatal error occurred. */
  data: SettingsState | null;
  /** True during initial fetch or manual refresh. */
  loading: boolean;
  /** Error message from the last failed fetch. null when healthy. */
  error: string | null;
  /** Re-fetches settings from the API. */
  refresh: () => Promise<void>;
  /**
   * Merges a partial update into feature flags and persists to localStorage.
   * This is for user-controlled preferences (e.g. UI toggles).
   * Server-side flags (databaseConnected, nodeEnv) cannot be overridden.
   */
  update: (overrides: FlagOverrides) => void;
  /** Removes all local overrides. State reverts to pure server data on next refresh. */
  clearOverrides: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OVERRIDES_KEY = "sdd-settings-overrides" as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSettings(): UseSettingsReturn {
  const [data, setData] = useState<SettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Reads persisted overrides from localStorage (SSR-safe). */
  const readOverrides = useCallback((): FlagOverrides => {
    if (typeof window === "undefined") return {};
    try {
      const sessionKey = getSessionKey(OVERRIDES_KEY);
      const raw = localStorage.getItem(sessionKey);
      if (!raw) return {};
      return JSON.parse(raw) as FlagOverrides;
    } catch {
      return {};
    }
  }, []);

  /** Writes overrides to localStorage (SSR-safe). */
  const writeOverrides = useCallback((overrides: FlagOverrides): void => {
    if (typeof window === "undefined") return;
    try {
      const sessionKey = getSessionKey(OVERRIDES_KEY);
      localStorage.setItem(sessionKey, JSON.stringify(overrides));
    } catch {
      // localStorage full or unavailable — degrade gracefully
    }
  }, []);

  // ── Core fetch ──────────────────────────────────────────────────────────────

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings");
      const json = (await res.json()) as SettingsResponse | SettingsErrorResponse;

      if (!res.ok || !json.success) {
        setError((json as SettingsErrorResponse).error ?? `HTTP ${res.status}`);
        return;
      }

      const serverData = json as SettingsResponse;
      const overrides = readOverrides();

      setData({
        stats: serverData.stats,
        flags: {
          ...serverData.flags,
          // Merge user overrides on top of server data
          ...overrides,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red desconocido");
    } finally {
      setLoading(false);
    }
  }, [readOverrides]);

  // ── Update (local overrides) ─────────────────────────────────────────────────

  const update = useCallback(
    (overrides: FlagOverrides): void => {
      const current = readOverrides();
      const merged: FlagOverrides = { ...current, ...overrides };
      writeOverrides(merged);

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          flags: { ...prev.flags, ...overrides },
        };
      });
    },
    [readOverrides, writeOverrides]
  );

  // ── Clear overrides ──────────────────────────────────────────────────────────

  const clearOverrides = useCallback((): void => {
    if (typeof window === "undefined") return;
    try {
      const sessionKey = getSessionKey(OVERRIDES_KEY);
      localStorage.removeItem(sessionKey);
    } catch {
      // No-op
    }
    // Revert in-memory state back to pure server data (no re-fetch needed)
    setData((prev) => {
      if (!prev) return prev;
      // Re-apply no overrides — next refresh will be clean
      return prev;
    });
  }, []);

  // ── Initial load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error, refresh, update, clearOverrides };
}
