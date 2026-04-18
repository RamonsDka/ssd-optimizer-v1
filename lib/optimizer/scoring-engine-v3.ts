// ─── Scoring Engine V3 — UnifiedModelMatrix Multi-Dimensional ────────────────
// Next-gen scoring that operates over the 5-dimensional UnifiedModelScores
// stored in the OIM (Intelligent Model Matrix Orchestrator).
//
// Formula (per dimension d):
//   rawScore = Σ(requirementVector[d] × modelScore[d])   ← weighted dot product
//   decayed  = rawScore × exp(-λ × ageInDays)            ← time-decay
//   final    = (decayed + ciBonus) clamped to [0, 1]     ← confidence interval boost
//
// Dimensions:
//   coding       — programming / code-generation capability
//   thinking     — reasoning / chain-of-thought capability
//   design       — creative / architecture / design capability
//   instruction  — instruction-following precision
//   context      — context-efficiency (how well the model uses its window)

import { getUnifiedScores } from "@/lib/db/oim-service";
import type { UnifiedModelScores, SddPhase, CustomSddPhase } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A 5-dimensional vector describing how important each capability is
 * for a given scoring context (phase or user requirement).
 * All weights SHOULD sum to 1.0 for interpretable scores.
 */
export interface RequirementVector {
  coding: number;
  thinking: number;
  design: number;
  instruction: number;
  context: number;
}

/**
 * Full score breakdown returned by calculateV3Score.
 */
export interface V3ScoreResult {
  /** Raw weighted dot-product score before time-decay (0-1) */
  rawScore: number;
  /** Score after applying time-decay factor */
  decayedScore: number;
  /** Final score including confidence-interval bonus, clamped to [0, 1] */
  finalScore: number;
  /** Time-decay multiplier applied (0-1, where 1.0 = no decay) */
  decayFactor: number;
  /** Confidence interval bonus applied to the final score */
  ciBonus: number;
  /** How many dimensions had real data (vs null) — used for transparency */
  dimensionCoverage: number;
  /** true when the model had no OIM record at all */
  usedFallback: boolean;
}

// ─── Phase Requirement Vectors ────────────────────────────────────────────────
// Encodes "what matters most" for each of the 10 built-in SDD phases.
// Weights are normalized to sum to 1.0 per phase.

const PHASE_REQUIREMENT_VECTORS: Record<SddPhase, RequirementVector> = {
  "sdd-explore":  { coding: 0.10, thinking: 0.40, design: 0.25, instruction: 0.15, context: 0.10 },
  "sdd-propose":  { coding: 0.10, thinking: 0.35, design: 0.30, instruction: 0.15, context: 0.10 },
  "sdd-spec":     { coding: 0.15, thinking: 0.30, design: 0.15, instruction: 0.30, context: 0.10 },
  "sdd-design":   { coding: 0.20, thinking: 0.35, design: 0.25, instruction: 0.10, context: 0.10 },
  "sdd-tasks":    { coding: 0.20, thinking: 0.25, design: 0.15, instruction: 0.30, context: 0.10 },
  "sdd-apply":    { coding: 0.45, thinking: 0.15, design: 0.10, instruction: 0.20, context: 0.10 },
  "sdd-verify":   { coding: 0.35, thinking: 0.30, design: 0.05, instruction: 0.20, context: 0.10 },
  "sdd-archive":  { coding: 0.15, thinking: 0.20, design: 0.15, instruction: 0.35, context: 0.15 },
  "sdd-init":     { coding: 0.20, thinking: 0.25, design: 0.15, instruction: 0.15, context: 0.25 },
  "sdd-onboard":  { coding: 0.15, thinking: 0.30, design: 0.20, instruction: 0.20, context: 0.15 },
};

// ─── Time-Decay Constants ─────────────────────────────────────────────────────

/**
 * Decay rate λ — controls how quickly old scores lose relevance.
 * Formula: decayFactor = exp(-λ × ageInDays)
 *
 * λ = 0.005 → half-life ≈ 139 days (scores >6 months old are ~25% weight).
 * λ = 0.010 → half-life ≈  69 days (more aggressive decay).
 */
const DECAY_LAMBDA = 0.005;

/**
 * Minimum decay floor — very old scores still contribute at least this much.
 * Prevents complete score collapse for models with no recent data.
 */
const DECAY_FLOOR = 0.30;

// ─── Confidence Interval Bonus ────────────────────────────────────────────────

/**
 * Maximum bonus added when a model has low CI (high certainty in benchmarks).
 * The bonus scales inversely with the CI width stored in rawData.
 * If CI data is absent, no bonus is applied.
 */
const MAX_CI_BONUS = 0.05;

// ─── Fallback Score ───────────────────────────────────────────────────────────

/**
 * Default score used for any dimension that lacks data (null).
 * Set to 0.6 — slightly above mid-range to give partial credit to models
 * with incomplete data rather than penalising them unfairly.
 */
const NULL_DIMENSION_FALLBACK = 0.60;

/**
 * Fallback final score used when a model has NO OIM record whatsoever.
 */
const NO_OIM_RECORD_FALLBACK = 0.40;

// ─── Core Computation ─────────────────────────────────────────────────────────

/**
 * Compute time-decay multiplier for a score snapshot.
 * @param snapshotDate - Date the benchmark data was captured
 * @returns Multiplier in [DECAY_FLOOR, 1.0]
 */
export function computeDecayFactor(snapshotDate: Date): number {
  const ageMs = Date.now() - new Date(snapshotDate).getTime();
  const ageInDays = ageMs / (1000 * 60 * 60 * 24);
  const raw = Math.exp(-DECAY_LAMBDA * ageInDays);
  return Math.max(DECAY_FLOOR, raw);
}

/**
 * Extract confidence-interval bonus from rawData.
 * Expects rawData to contain an optional `ci` numeric field (0–1 CI width).
 * Smaller CI → higher certainty → larger bonus.
 *
 * @param rawData - Raw benchmark payload from UnifiedModelScores
 * @returns Bonus in [0, MAX_CI_BONUS]
 */
export function computeCiBonus(rawData: Record<string, unknown> | null): number {
  if (!rawData || typeof rawData.ci !== "number") return 0;
  const ci = rawData.ci as number;
  // ci=0 → perfect certainty → full bonus; ci=1 → no certainty → no bonus
  const certainty = Math.max(0, Math.min(1, 1 - ci));
  return certainty * MAX_CI_BONUS;
}

/**
 * Weighted dot product of requirement vector × model dimension scores.
 * Missing dimension values (null) are substituted with NULL_DIMENSION_FALLBACK.
 *
 * @param req    - Per-dimension requirement weights
 * @param scores - Multi-dimensional model scores (may contain nulls)
 * @returns Raw score in [0, 1] and how many dimensions had real data
 */
export function weightedDotProduct(
  req: RequirementVector,
  scores: Pick<
    UnifiedModelScores,
    "codingScore" | "thinkingScore" | "designScore" | "instructionScore" | "contextEfficiency"
  >
): { dotProduct: number; coverage: number } {
  const dims: Array<{ weight: number; value: number | null }> = [
    { weight: req.coding,      value: scores.codingScore },
    { weight: req.thinking,    value: scores.thinkingScore },
    { weight: req.design,      value: scores.designScore },
    { weight: req.instruction, value: scores.instructionScore },
    { weight: req.context,     value: scores.contextEfficiency },
  ];

  let weightedSum = 0;
  let totalWeight = 0;
  let realDimensions = 0;

  for (const { weight, value } of dims) {
    const effective = value !== null && value !== undefined ? value : NULL_DIMENSION_FALLBACK;
    weightedSum += weight * effective;
    totalWeight += weight;
    if (value !== null && value !== undefined) realDimensions++;
  }

  const dotProduct = totalWeight > 0 ? weightedSum / totalWeight : NULL_DIMENSION_FALLBACK;
  const coverage = realDimensions / dims.length;

  return { dotProduct, coverage };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculate the V3 score for a model against a given requirement vector.
 *
 * Workflow:
 * 1. Fetch the latest UnifiedModelScores from the OIM service.
 * 2. Compute the weighted dot product (requirement × model dimensions).
 * 3. Apply time-decay based on snapshot age.
 * 4. Add confidence interval bonus if available.
 * 5. Clamp final score to [0, 1].
 *
 * When the model has no OIM record, returns a graceful fallback result
 * with `usedFallback = true` so callers can take appropriate action.
 *
 * @param modelId           - Canonical model identifier (e.g. "anthropic/claude-sonnet-4-5")
 * @param requirementVector - Per-dimension weight vector for the scoring context
 * @returns Full V3ScoreResult with component breakdown
 */
export async function calculateV3Score(
  modelId: string,
  requirementVector: RequirementVector
): Promise<V3ScoreResult> {
  const record = await getUnifiedScores(modelId);

  // ── No OIM record: return graceful fallback ──────────────────────────────
  if (!record) {
    return {
      rawScore: NO_OIM_RECORD_FALLBACK,
      decayedScore: NO_OIM_RECORD_FALLBACK,
      finalScore: NO_OIM_RECORD_FALLBACK,
      decayFactor: 1.0,
      ciBonus: 0,
      dimensionCoverage: 0,
      usedFallback: true,
    };
  }

  // ── Step 1: Weighted dot product ─────────────────────────────────────────
  const { dotProduct, coverage } = weightedDotProduct(requirementVector, record);

  // ── Step 2: Time-decay ───────────────────────────────────────────────────
  const decayFactor = computeDecayFactor(record.snapshotDate);
  const decayedScore = dotProduct * decayFactor;

  // ── Step 3: CI bonus ─────────────────────────────────────────────────────
  const ciBonus = computeCiBonus(record.rawData);

  // ── Step 4: Final score clamped to [0, 1] ────────────────────────────────
  const finalScore = Math.max(0, Math.min(1, decayedScore + ciBonus));

  return {
    rawScore: dotProduct,
    decayedScore,
    finalScore,
    decayFactor,
    ciBonus,
    dimensionCoverage: coverage,
    usedFallback: false,
  };
}

// ─── Phase-Aware API ──────────────────────────────────────────────────────────

/**
 * Convenience wrapper that resolves the RequirementVector automatically
 * from a built-in SDD phase or custom phase weights.
 *
 * For built-in phases: uses PHASE_REQUIREMENT_VECTORS lookup.
 * For custom phases:   converts their categoryWeights to a RequirementVector
 *                      by mapping the 5 OIM dimensions from matching keys.
 *
 * Falls back to an equal-weight vector if the phase is unrecognized.
 *
 * @param modelId      - Canonical model identifier
 * @param phase        - Built-in SddPhase or custom phase name
 * @param customPhases - Optional custom phase definitions from the session
 */
export async function calculateV3ScoreForPhase(
  modelId: string,
  phase: SddPhase | string,
  customPhases: CustomSddPhase[] = []
): Promise<V3ScoreResult> {
  const vector = resolveRequirementVector(phase, customPhases);
  return calculateV3Score(modelId, vector);
}

/**
 * Resolve the RequirementVector for a phase.
 * Exported for testing and comparison utilities.
 */
export function resolveRequirementVector(
  phase: SddPhase | string,
  customPhases: CustomSddPhase[] = []
): RequirementVector {
  // Built-in phase → direct lookup
  if (phase in PHASE_REQUIREMENT_VECTORS) {
    return PHASE_REQUIREMENT_VECTORS[phase as SddPhase];
  }

  // Custom phase → map categoryWeights keys to OIM dimensions
  const custom = customPhases.find((p) => p.name === phase);
  if (custom) {
    return mapCustomWeightsToVector(custom.categoryWeights);
  }

  // Unknown phase → equal weights
  const equal = 1 / 5;
  return { coding: equal, thinking: equal, design: equal, instruction: equal, context: equal };
}

/**
 * Map custom phase categoryWeights (arbitrary keys) to the 5 OIM dimensions.
 * Keys are matched case-insensitively against known dimension aliases.
 */
function mapCustomWeightsToVector(weights: Record<string, number>): RequirementVector {
  const vec: RequirementVector = { coding: 0, thinking: 0, design: 0, instruction: 0, context: 0 };

  const aliases: Record<keyof RequirementVector, string[]> = {
    coding:      ["coding", "code", "programming", "implementation"],
    thinking:    ["thinking", "reasoning", "analysis", "logic", "explore"],
    design:      ["design", "creative", "architecture", "creativity"],
    instruction: ["instruction", "instruction_following", "structured", "precision"],
    context:     ["context", "context_efficiency", "memory"],
  };

  let total = 0;

  for (const [key, value] of Object.entries(weights)) {
    const normalized = key.toLowerCase().replace(/-/g, "_");
    for (const [dim, aliasList] of Object.entries(aliases) as Array<[keyof RequirementVector, string[]]>) {
      if (aliasList.some((alias) => normalized.includes(alias))) {
        vec[dim] += value;
        total += value;
        break;
      }
    }
  }

  // If nothing matched, fall back to equal weights
  if (total === 0) {
    const equal = 1 / 5;
    return { coding: equal, thinking: equal, design: equal, instruction: equal, context: equal };
  }

  // Normalize so weights sum to 1
  const keys = Object.keys(vec) as Array<keyof RequirementVector>;
  for (const k of keys) {
    vec[k] = vec[k] / total;
  }

  return vec;
}

// ─── Batch Scoring ────────────────────────────────────────────────────────────

/**
 * Score multiple models for the same phase in parallel.
 * More efficient than sequential calls when scoring many models.
 *
 * @param modelIds  - Array of canonical model identifiers
 * @param phase     - SddPhase or custom phase name
 * @param customPhases - Optional custom phase definitions
 * @returns Array of {modelId, result} pairs in the same order as input
 */
export async function scoreModelsBatchV3(
  modelIds: string[],
  phase: SddPhase | string,
  customPhases: CustomSddPhase[] = []
): Promise<Array<{ modelId: string; result: V3ScoreResult }>> {
  const vector = resolveRequirementVector(phase, customPhases);

  const results = await Promise.all(
    modelIds.map((modelId) =>
      calculateV3Score(modelId, vector).then((result) => ({ modelId, result }))
    )
  );

  return results;
}

// ─── Exported Constants ───────────────────────────────────────────────────────
// Exposed for testing, comparison utilities, and UI display.

export { PHASE_REQUIREMENT_VECTORS, DECAY_LAMBDA, DECAY_FLOOR, MAX_CI_BONUS, NULL_DIMENSION_FALLBACK };
