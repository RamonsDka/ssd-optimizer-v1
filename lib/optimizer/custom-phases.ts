// ─── Custom SDD Phases ────────────────────────────────────────────────────────
// CRUD helpers for user-defined SDD phases with custom category weights.
// Persisted in localStorage with session-scoped keys.

import { getSessionKey } from "@/lib/session/session-manager";
import type { LMArenaCategory } from "@/lib/sync/lmarena-client";

const STORAGE_KEY = "custom_sdd_phases";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomSddPhase {
  /** Unique identifier (slug format: "custom-phase-name") */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Optional description */
  description?: string;
  /** Category weights (must sum to 1.0) */
  categoryWeights: Record<string, number>;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const WEIGHT_SUM_EPSILON = 0.001;

/**
 * Validate that category weights sum to 1.0 (within epsilon tolerance).
 */
export function validateCategoryWeights(
  weights: Record<string, number>
): { valid: boolean; sum: number; error?: string } {
  const sum = Object.values(weights).reduce((acc, w) => acc + w, 0);
  const valid = Math.abs(sum - 1.0) <= WEIGHT_SUM_EPSILON;

  return {
    valid,
    sum,
    error: valid ? undefined : `Weights sum to ${sum.toFixed(3)}, expected 1.0`,
  };
}

/**
 * Validate phase name format (slug-like: lowercase, hyphens, no spaces).
 */
export function validatePhaseName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Name cannot be empty" };
  }

  const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (!slugPattern.test(name)) {
    return {
      valid: false,
      error: "Name must be lowercase with hyphens (e.g., 'my-custom-phase')",
    };
  }

  return { valid: true };
}

// ─── CRUD Operations ──────────────────────────────────────────────────────────

/**
 * Get all custom phases from localStorage.
 */
export function listCustomPhases(): CustomSddPhase[] {
  if (typeof window === "undefined") return [];

  try {
    const key = getSessionKey(STORAGE_KEY);
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const phases = JSON.parse(raw) as CustomSddPhase[];
    return Array.isArray(phases) ? phases : [];
  } catch (error) {
    console.error("[CustomPhases] Failed to list phases:", error);
    return [];
  }
}

/**
 * Get a single custom phase by name.
 */
export function getCustomPhase(name: string): CustomSddPhase | null {
  const phases = listCustomPhases();
  return phases.find((p) => p.name === name) ?? null;
}

/**
 * Check if a custom phase exists.
 */
export function customPhaseExists(name: string): boolean {
  return getCustomPhase(name) !== null;
}

/**
 * Add a new custom phase.
 * Returns error string if validation fails, null on success.
 */
export function addCustomPhase(
  phase: Omit<CustomSddPhase, "createdAt" | "updatedAt">
): string | null {
  // Validate name
  const nameValidation = validatePhaseName(phase.name);
  if (!nameValidation.valid) {
    return nameValidation.error ?? "Invalid phase name";
  }

  // Check for duplicates
  if (customPhaseExists(phase.name)) {
    return `Phase "${phase.name}" already exists`;
  }

  // Validate weights
  const weightValidation = validateCategoryWeights(phase.categoryWeights);
  if (!weightValidation.valid) {
    return weightValidation.error ?? "Invalid category weights";
  }

  // Create phase with timestamps
  const now = new Date().toISOString();
  const newPhase: CustomSddPhase = {
    ...phase,
    createdAt: now,
    updatedAt: now,
  };

  // Save to localStorage
  try {
    const phases = listCustomPhases();
    phases.push(newPhase);
    const key = getSessionKey(STORAGE_KEY);
    localStorage.setItem(key, JSON.stringify(phases));
    return null; // success
  } catch (error) {
    console.error("[CustomPhases] Failed to add phase:", error);
    return "Failed to save phase to storage";
  }
}

/**
 * Update an existing custom phase.
 * Returns error string if validation fails, null on success.
 */
export function updateCustomPhase(
  name: string,
  updates: Partial<Omit<CustomSddPhase, "name" | "createdAt" | "updatedAt">>
): string | null {
  const phases = listCustomPhases();
  const index = phases.findIndex((p) => p.name === name);

  if (index === -1) {
    return `Phase "${name}" not found`;
  }

  // Validate weights if provided
  if (updates.categoryWeights) {
    const weightValidation = validateCategoryWeights(updates.categoryWeights);
    if (!weightValidation.valid) {
      return weightValidation.error ?? "Invalid category weights";
    }
  }

  // Apply updates
  phases[index] = {
    ...phases[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Save to localStorage
  try {
    const key = getSessionKey(STORAGE_KEY);
    localStorage.setItem(key, JSON.stringify(phases));
    return null; // success
  } catch (error) {
    console.error("[CustomPhases] Failed to update phase:", error);
    return "Failed to save phase to storage";
  }
}

/**
 * Remove a custom phase by name.
 * Returns true if removed, false if not found.
 */
export function removeCustomPhase(name: string): boolean {
  const phases = listCustomPhases();
  const filtered = phases.filter((p) => p.name !== name);

  if (filtered.length === phases.length) {
    return false; // not found
  }

  try {
    const key = getSessionKey(STORAGE_KEY);
    localStorage.setItem(key, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error("[CustomPhases] Failed to remove phase:", error);
    return false;
  }
}

/**
 * Clear all custom phases.
 */
export function clearCustomPhases(): void {
  try {
    const key = getSessionKey(STORAGE_KEY);
    localStorage.removeItem(key);
  } catch (error) {
    console.error("[CustomPhases] Failed to clear phases:", error);
  }
}

// ─── Detection Helpers ────────────────────────────────────────────────────────

/**
 * Check if a phase name is a custom phase (not one of the 10 built-in SDD phases).
 */
export function isCustomPhase(phaseName: string): boolean {
  const builtInPhases = [
    "sdd-explore",
    "sdd-propose",
    "sdd-spec",
    "sdd-design",
    "sdd-tasks",
    "sdd-apply",
    "sdd-verify",
    "sdd-archive",
    "sdd-init",
    "sdd-onboard",
  ];

  return !builtInPhases.includes(phaseName);
}

/**
 * Get category weights for a phase (custom or built-in).
 * Returns null if phase not found.
 */
export function getCategoryWeightsForPhase(
  phaseName: string
): Record<LMArenaCategory, number> | null {
  // Check if it's a custom phase
  if (isCustomPhase(phaseName)) {
    const customPhase = getCustomPhase(phaseName);
    return customPhase?.categoryWeights ?? null;
  }

  // For built-in phases, return null (handled by category-mapper.ts)
  return null;
}
