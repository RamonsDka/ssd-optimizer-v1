"use client";

// ─── useOptimizerPersistence ────────────────────────────────────────────────
// Custom hook that persists TeamRecommendation in localStorage.
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
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TeamRecommendation;
        setRecommendation(parsed);
      }
    } catch {
      // Corrupted data — silently discard
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsHydrating(false);
    }
  }, []);

  const save = useCallback((result: TeamRecommendation) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    } catch {
      // localStorage full or unavailable — degrade gracefully (state still updated)
    }
    setRecommendation(result);
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // No-op
    }
    setRecommendation(null);
  }, []);

  return { recommendation, save, clear, isHydrating };
}
