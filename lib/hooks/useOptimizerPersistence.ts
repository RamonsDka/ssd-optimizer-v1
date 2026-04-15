"use client";

// ─── useOptimizerPersistence ────────────────────────────────────────────────
// Custom hook that persists TeamRecommendation in localStorage.
//
// V2 Update: Now uses session-scoped keys to isolate data per browser.
//
// Contract:
// - On mount (client only): loads last saved result from localStorage.
// - On save(result): persists the result and updates local state.
// - On clear(): removes the persisted entry and resets state to null.
//
// Hydration note: state initializes to null (SSR-safe).
// The actual localStorage read happens inside useEffect to avoid
// server/client mismatch.

import { useState, useEffect, useCallback } from "react";
import type { TeamRecommendation } from "@/types";
import { getSessionKey } from "@/lib/session/session-manager";

const STORAGE_KEY = "sdd-optimizer-last-result" as const;

interface UseOptimizerPersistenceReturn {
  /** The persisted (or freshly generated) recommendation. null if none exists. */
  recommendation: TeamRecommendation | null;
  /** Call this when the optimizer returns a new result. Saves to localStorage. */
  save: (result: TeamRecommendation) => void;
  /** Removes the persisted result from localStorage and resets state to null. */
  clear: () => void;
  /** True while the initial localStorage read is in progress. */
  isHydrating: boolean;
}

export function useOptimizerPersistence(): UseOptimizerPersistenceReturn {
  const [recommendation, setRecommendation] = useState<TeamRecommendation | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  // On mount — read from localStorage (client-only, safe from SSR mismatch)
  useEffect(() => {
    try {
      const sessionKey = getSessionKey(STORAGE_KEY);
      const raw = localStorage.getItem(sessionKey);
      if (raw) {
        const parsed = JSON.parse(raw) as TeamRecommendation;
        setRecommendation(parsed);
      }
    } catch {
      // Corrupted data — silently discard
      const sessionKey = getSessionKey(STORAGE_KEY);
      localStorage.removeItem(sessionKey);
    } finally {
      setIsHydrating(false);
    }
  }, []);

  const save = useCallback((result: TeamRecommendation) => {
    try {
      const sessionKey = getSessionKey(STORAGE_KEY);
      localStorage.setItem(sessionKey, JSON.stringify(result));
    } catch {
      // localStorage full or unavailable — degrade gracefully (state still updated)
    }
    setRecommendation(result);
  }, []);

  const clear = useCallback(() => {
    try {
      const sessionKey = getSessionKey(STORAGE_KEY);
      localStorage.removeItem(sessionKey);
    } catch {
      // No-op
    }
    setRecommendation(null);
  }, []);

  return { recommendation, save, clear, isHydrating };
}
