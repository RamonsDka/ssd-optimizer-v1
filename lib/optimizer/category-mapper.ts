// ─── Category Mapper — SDD Phase → LM Arena Categories ───────────────────────
// Maps each SDD phase to relevant LM Arena categories with weights that sum to 1.
// Used by scoring-engine-v2 to calculate arena-weighted scores.

import type { SddPhase } from "@/types";
import type { LMArenaCategory } from "@/lib/sync/lmarena-client";

export interface CategoryWeight {
  category: LMArenaCategory;
  weight: number;
}

/**
 * Phase-to-category mapping with weights.
 * Weights must sum to 1.0 for each phase.
 */
export const PHASE_CATEGORY_WEIGHTS: Record<SddPhase, CategoryWeight[]> = {
  "sdd-explore": [
    { category: "reasoning", weight: 0.4 },
    { category: "analysis", weight: 0.3 },
    { category: "long-context", weight: 0.2 },
    { category: "creative-writing", weight: 0.1 },
  ],
  "sdd-propose": [
    { category: "reasoning", weight: 0.35 },
    { category: "instruction-following", weight: 0.25 },
    { category: "structured-output", weight: 0.2 },
    { category: "creative-writing", weight: 0.2 },
  ],
  "sdd-spec": [
    { category: "instruction-following", weight: 0.4 },
    { category: "structured-output", weight: 0.3 },
    { category: "reasoning", weight: 0.2 },
    { category: "analysis", weight: 0.1 },
  ],
  "sdd-design": [
    { category: "reasoning", weight: 0.35 },
    { category: "coding", weight: 0.25 },
    { category: "analysis", weight: 0.2 },
    { category: "planning", weight: 0.2 },
  ],
  "sdd-tasks": [
    { category: "planning", weight: 0.4 },
    { category: "instruction-following", weight: 0.25 },
    { category: "reasoning", weight: 0.2 },
    { category: "structured-output", weight: 0.15 },
  ],
  "sdd-apply": [
    { category: "coding", weight: 0.5 },
    { category: "instruction-following", weight: 0.25 },
    { category: "reasoning", weight: 0.15 },
    { category: "structured-output", weight: 0.1 },
  ],
  "sdd-verify": [
    { category: "coding", weight: 0.4 },
    { category: "reasoning", weight: 0.3 },
    { category: "analysis", weight: 0.2 },
    { category: "instruction-following", weight: 0.1 },
  ],
  "sdd-archive": [
    { category: "summarization", weight: 0.4 },
    { category: "structured-output", weight: 0.3 },
    { category: "instruction-following", weight: 0.2 },
    { category: "coding", weight: 0.1 },
  ],
  "sdd-init": [
    { category: "long-context", weight: 0.5 },
    { category: "analysis", weight: 0.25 },
    { category: "reasoning", weight: 0.15 },
    { category: "coding", weight: 0.1 },
  ],
  "sdd-onboard": [
    { category: "instruction-following", weight: 0.35 },
    { category: "reasoning", weight: 0.25 },
    { category: "long-context", weight: 0.2 },
    { category: "dialogue", weight: 0.2 },
  ],
};

/**
 * Get relevant LM Arena categories for a given SDD phase.
 * Returns array of category weights sorted by weight descending.
 */
export function getRelevantCategories(phase: SddPhase): CategoryWeight[] {
  return PHASE_CATEGORY_WEIGHTS[phase] ?? [];
}

/**
 * Validate that all phase weights sum to 1.0 (within tolerance).
 * Throws error if validation fails.
 */
export function validateCategoryWeights(): void {
  const tolerance = 0.001;
  const phases = Object.keys(PHASE_CATEGORY_WEIGHTS) as SddPhase[];

  for (const phase of phases) {
    const weights = PHASE_CATEGORY_WEIGHTS[phase];
    const sum = weights.reduce((acc, w) => acc + w.weight, 0);

    if (Math.abs(sum - 1.0) > tolerance) {
      throw new Error(
        `Phase ${phase} weights sum to ${sum.toFixed(3)}, expected 1.0`
      );
    }
  }
}

/**
 * Get all unique categories used across all phases.
 */
export function getAllUsedCategories(): Set<LMArenaCategory> {
  const categories = new Set<LMArenaCategory>();
  const phases = Object.keys(PHASE_CATEGORY_WEIGHTS) as SddPhase[];

  for (const phase of phases) {
    const weights = PHASE_CATEGORY_WEIGHTS[phase];
    for (const { category } of weights) {
      categories.add(category);
    }
  }

  return categories;
}
