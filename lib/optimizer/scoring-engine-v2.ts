// ─── Scoring Engine V2 — LM Arena + Multi-Factor Scoring ─────────────────────
// Next-gen scoring engine that combines LM Arena benchmarks with context,
// cost, and tier preferences.
//
// Formula: arena*0.7 + context*0.15 + cost*0.1 + tier*0.05

import type { ModelRecord, SddPhase, Tier, CustomSddPhase } from "@/types";
import { getRelevantCategories } from "./category-mapper";
import type { LMArenaCategory } from "@/lib/sync/lmarena-client";
import { prisma } from "@/lib/db/prisma";
import { categorizeModel } from "@/lib/ai/embedding-service";

const BUILT_IN_PHASES: SddPhase[] = [
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

// ─── Constants ────────────────────────────────────────────────────────────────

const WEIGHTS = {
  arena: 0.7,
  context: 0.15,
  cost: 0.1,
  tier: 0.05,
} as const;

const CONTEXT_THRESHOLDS = {
  large: 128_000,  // ≥128k: full bonus
  medium: 64_000,  // ≥64k: partial bonus
  small: 32_000,   // ≥32k: minimal bonus
} as const;

const COST_THRESHOLDS = {
  free: 0,
  cheap: 1.0,
  moderate: 5.0,
  expensive: 15.0,
} as const;

// Tier preference order per profile
const TIER_PREFERENCE_ORDER: Record<Tier, Tier[]> = {
  PREMIUM: ["PREMIUM", "BALANCED", "ECONOMIC"],
  BALANCED: ["BALANCED", "PREMIUM", "ECONOMIC"],
  ECONOMIC: ["ECONOMIC", "BALANCED", "PREMIUM"],
};

// ─── Arena Score Fetching ─────────────────────────────────────────────────────

export interface ArenaScoreData {
  category: string;
  score: number;
  rank: number | null;
  publishDate: Date;
}

/**
 * Fetch latest LM Arena scores for a model across all categories.
 * Returns the most recent score per category (by leaderboardPublishDate).
 */
export async function fetchLatestArenaScores(
  modelId: string
): Promise<Map<string, ArenaScoreData>> {
  const scores = await prisma.lMArenaScore.findMany({
    where: { modelId },
    orderBy: { leaderboardPublishDate: "desc" },
    select: {
      categoryId: true,
      score: true,
      rank: true,
      leaderboardPublishDate: true,
    },
  });

  // Keep only the latest score per category
  const latestByCategory = new Map<string, ArenaScoreData>();

  for (const score of scores) {
    if (!latestByCategory.has(score.categoryId)) {
      latestByCategory.set(score.categoryId, {
        category: score.categoryId,
        score: score.score,
        rank: score.rank,
        publishDate: score.leaderboardPublishDate,
      });
    }
  }

  return latestByCategory;
}

/**
 * Fetch arena scores for multiple models at once (batch optimization).
 * Returns a map of modelId → category scores.
 */
export async function fetchArenaScoresBatch(
  modelIds: string[]
): Promise<Map<string, Map<string, ArenaScoreData>>> {
  const scores = await prisma.lMArenaScore.findMany({
    where: { modelId: { in: modelIds } },
    orderBy: { leaderboardPublishDate: "desc" },
    select: {
      modelId: true,
      categoryId: true,
      score: true,
      rank: true,
      leaderboardPublishDate: true,
    },
  });

  const result = new Map<string, Map<string, ArenaScoreData>>();

  for (const score of scores) {
    if (!result.has(score.modelId)) {
      result.set(score.modelId, new Map());
    }

    const modelScores = result.get(score.modelId)!;

    // Keep only the latest score per category
    if (!modelScores.has(score.categoryId)) {
      modelScores.set(score.categoryId, {
        category: score.categoryId,
        score: score.score,
        rank: score.rank,
        publishDate: score.leaderboardPublishDate,
      });
    }
  }

  return result;
}

// ─── Score Normalization ──────────────────────────────────────────────────────

/**
 * Normalize LM Arena score to 0-1 range with expanded dynamic range.
 * 
 * Arena scores in practice cluster around 1200-1500, but we use a wider
 * simulated range (900-1600) to:
 * - Prevent score collapse to discrete values (0.27/0.29/0.97)
 * - Leave headroom for future models
 * - Better differentiate between similar-rated models
 * 
 * The normalization is then scaled to 0.1-0.9 to avoid pure extremes.
 */
export function normalizeArenaScore(
  score: number,
  min = 900,
  max = 1600
): number {
  if (min === max) return 0.5;
  
  // Normalize to 0-1 using expanded range
  const rawNormalized = (score - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, rawNormalized));
  
  // Scale to 0.1-0.9 to leave margin for outliers
  return 0.1 + (clamped * 0.8);
}

/**
 * Calculate weighted arena score for a phase using category weights.
 * Returns 0-1 normalized score.
 * 
 * Supports both built-in SDD phases and custom phases.
 * For custom phases, uses weights from custom-phases.ts.
 * 
 * @param phase         SDD phase to score for (built-in or custom)
 * @param arenaScores   Arena scores for this model
 * @param fallbackScore Optional fallback score for models without arena data (default: 0.5)
 */
export function calculateArenaWeightedScore(
  phase: SddPhase | string,
  arenaScores: Map<string, ArenaScoreData>,
  fallbackScore = 0.5,
  customPhases: CustomSddPhase[] = []
): number {
  // Check if this is a custom phase
  let categoryWeights: Array<{ category: LMArenaCategory; weight: number }>;
  
  if (!BUILT_IN_PHASES.includes(phase as SddPhase)) {
    // Custom phase: get weights from custom-phases.ts
    const customWeights = customPhases.find((item) => item.name === phase)?.categoryWeights;
    if (!customWeights) {
      // Custom phase not found, use fallback
      return fallbackScore;
    }
    
    // Convert Record to Array format
    categoryWeights = Object.entries(customWeights).map(([category, weight]) => ({
      category: category as LMArenaCategory,
      weight,
    }));
  } else {
    // Built-in phase: use category-mapper.ts
    categoryWeights = getRelevantCategories(phase as SddPhase);
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const { category, weight } of categoryWeights) {
    const scoreData = arenaScores.get(category);

    if (scoreData) {
      const normalized = normalizeArenaScore(scoreData.score);
      weightedSum += normalized * weight;
      totalWeight += weight;
    }
    // If category is missing, we skip it (weight becomes 0)
  }

  // If no arena data available, use fallback score
  if (totalWeight === 0) return fallbackScore;
  
  return weightedSum / totalWeight;
}

// ─── Context Score ────────────────────────────────────────────────────────────

/**
 * Calculate context window score (0-1).
 * Larger context windows get higher scores.
 */
export function calculateContextScore(contextWindow: number): number {
  if (contextWindow >= CONTEXT_THRESHOLDS.large) {
    return 1.0;
  } else if (contextWindow >= CONTEXT_THRESHOLDS.medium) {
    return 0.7;
  } else if (contextWindow >= CONTEXT_THRESHOLDS.small) {
    return 0.4;
  } else {
    return 0.2;
  }
}

// ─── Cost Score ───────────────────────────────────────────────────────────────

/**
 * Calculate cost efficiency score (0-1).
 * Lower cost = higher score.
 */
export function calculateCostScore(costPer1M: number): number {
  if (costPer1M <= COST_THRESHOLDS.free) {
    return 1.0;
  } else if (costPer1M <= COST_THRESHOLDS.cheap) {
    return 0.9;
  } else if (costPer1M <= COST_THRESHOLDS.moderate) {
    return 0.7;
  } else if (costPer1M <= COST_THRESHOLDS.expensive) {
    return 0.5;
  } else {
    return 0.3;
  }
}

// ─── Tier Preference Score ────────────────────────────────────────────────────

/**
 * Calculate tier preference score (0-1).
 * Models matching the preferred tier get higher scores.
 */
export function calculateTierPreferenceScore(
  modelTier: Tier,
  preferredTier: Tier
): number {
  const order = TIER_PREFERENCE_ORDER[preferredTier];
  const index = order.indexOf(modelTier);

  if (index === 0) return 1.0; // Perfect match
  if (index === 1) return 0.6; // Second choice
  if (index === 2) return 0.3; // Last resort

  return 0; // Not in preference order (shouldn't happen)
}

// ─── Combined Scoring ─────────────────────────────────────────────────────────

export interface ScoringComponents {
  arena: number;
  context: number;
  cost: number;
  tier: number;
  final: number;
}

/**
 * Calculate final score for a model on a given phase.
 * Combines arena, context, cost, and tier scores using weighted formula.
 *
 * @param model         Model to score
 * @param phase         SDD phase
 * @param arenaScores   LM Arena scores for this model
 * @param preferredTier Tier preference for scoring
 * @param fallbackScore Fallback arena score for models without arena data (default: 0.5)
 * @returns             Score components and final weighted score (0-1)
 */
export function scoreModel(
  model: ModelRecord,
  phase: SddPhase | string,
  arenaScores: Map<string, ArenaScoreData>,
  preferredTier: Tier,
  fallbackScore = 0.5,
  customPhases: CustomSddPhase[] = []
): ScoringComponents {
  const arena = calculateArenaWeightedScore(phase, arenaScores, fallbackScore, customPhases);
  const context = calculateContextScore(model.contextWindow);
  const cost = calculateCostScore(model.costPer1M);
  const tier = calculateTierPreferenceScore(model.tier, preferredTier);

  const final =
    arena * WEIGHTS.arena +
    context * WEIGHTS.context +
    cost * WEIGHTS.cost +
    tier * WEIGHTS.tier;

  return {
    arena,
    context,
    cost,
    tier,
    final: Math.max(0, Math.min(1, final)),
  };
}

// ─── Confidence Calculation ───────────────────────────────────────────────────

/**
 * Calculate confidence score (0-1) based on data availability.
 * Higher confidence when:
 * - More arena categories have scores
 * - Scores are recent
 * - Model has been synced recently
 */
export function calculateConfidence(
  phase: SddPhase | string,
  arenaScores: Map<string, ArenaScoreData>,
  model: ModelRecord,
  customPhases: CustomSddPhase[] = []
): number {
  const customPhase = customPhases.find((item) => item.name === phase);
  const categoryWeights = !BUILT_IN_PHASES.includes(phase as SddPhase)
    ? customPhase
      ? Object.entries(customPhase.categoryWeights).map(([category, weight]) => ({ category: category as LMArenaCategory, weight }))
      : []
    : getRelevantCategories(phase as SddPhase);
  const requiredCategories = Math.max(1, categoryWeights.length);
  const availableCategories = categoryWeights.filter(({ category }) =>
    arenaScores.has(category)
  ).length;

  // Base confidence: percentage of categories with scores
  let confidence = availableCategories / requiredCategories;

  // Penalty for missing lastSyncedAt
  if (!model.lastSyncedAt) {
    confidence *= 0.7;
  } else {
    // Penalty for old sync (>30 days)
    const daysSinceSync =
      (Date.now() - new Date(model.lastSyncedAt).getTime()) /
      (1000 * 60 * 60 * 24);

    if (daysSinceSync > 30) {
      confidence *= 0.8;
    }
  }

  // Penalty for AI-discovered models (less reliable metadata)
  if (model.discoveredByAI) {
    confidence *= 0.9;
  }

  return Math.max(0, Math.min(1, confidence));
}

// ─── Batch Scoring ────────────────────────────────────────────────────────────

export interface ModelScore {
  model: ModelRecord;
  components: ScoringComponents;
  confidence: number;
}

// ─── Embedding-based Fallback ─────────────────────────────────────────────────

/**
 * Derive an arena-weighted score for a model that has NO LM Arena scores,
 * using semantic similarity between the model's capabilities (obtained via
 * `categorizeModel`) and the categories required by the given phase.
 *
 * Algorithm:
 * 1. Get the phase's category weights (built-in or custom).
 * 2. Call `categorizeModel` to get confidence values per LM Arena category.
 * 3. For each phase category, look up the embedding-derived confidence; use
 *    it as a proxy for an arena score (already in [0, 1]).
 * 4. Compute the weighted average — same formula as `calculateArenaWeightedScore`.
 *
 * Returns a value in [0, 1].  Falls back to `batchFallback` if the embedding
 * service throws (e.g. when the model is not running in Node.js).
 */
async function deriveEmbeddingFallbackScore(
  model: ModelRecord,
  phase: SddPhase | string,
  customPhases: CustomSddPhase[],
  batchFallback: number
): Promise<number> {
  try {
    // Determine phase category weights (reuse existing logic).
    let categoryWeights: Array<{ category: LMArenaCategory; weight: number }>;

    if (!BUILT_IN_PHASES.includes(phase as SddPhase)) {
      const customPhase = customPhases.find((p) => p.name === phase);
      if (!customPhase) return batchFallback;
      categoryWeights = Object.entries(customPhase.categoryWeights).map(
        ([category, weight]) => ({ category: category as LMArenaCategory, weight })
      );
    } else {
      categoryWeights = getRelevantCategories(phase as SddPhase);
    }

    if (categoryWeights.length === 0) return batchFallback;

    // Build a description from model strengths for richer embedding input.
    const description = model.strengths.length > 0
      ? model.strengths.join(", ")
      : "";

    const capabilities = await categorizeModel(model.name, description);

    // Build a quick lookup: category → confidence.
    const confidenceByCategory = new Map<string, number>(
      capabilities.categories.map(
        (entry: { category: string; confidence: number }): [string, number] => [
          entry.category,
          entry.confidence,
        ]
      )
    );

    // Weighted average of per-category embedding confidences.
    let weightedSum = 0;
    let totalWeight = 0;

    for (const { category, weight } of categoryWeights) {
      const confidence = confidenceByCategory.get(category);
      if (confidence !== undefined) {
        weightedSum += confidence * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) return batchFallback;

    return weightedSum / totalWeight;
  } catch {
    // Embedding service unavailable (e.g. browser context, missing model).
    // Silently fall back to the batch average — non-fatal.
    return batchFallback;
  }
}

/**
 * Score multiple models for a phase in batch.
 * Fetches arena scores once for all models.
 *
 * Models without LM Arena data first attempt to derive a score via semantic
 * embedding similarity (`categorizeModel`). If the embedding service is
 * unavailable, they fall back to the average arena score of models that DO
 * have data in this batch (or 0.5 if none). This prevents new/unknown models
 * from being unfairly penalized or over-represented.
 */
export async function scoreModelsBatch(
  models: ModelRecord[],
  phase: SddPhase,
  preferredTier: Tier,
  customPhases: CustomSddPhase[] = []
): Promise<ModelScore[]> {
  const modelIds = models.map((m) => m.id);
  const arenaScoresBatch = await fetchArenaScoresBatch(modelIds);

  // ── Pass 1: arena scores for models WITH LM Arena data ──────────────────
  const arenaScoresWithData: number[] = [];

  for (const model of models) {
    const arenaScores = arenaScoresBatch.get(model.id);
    if (arenaScores && arenaScores.size > 0) {
      const score = calculateArenaWeightedScore(phase, arenaScores, 0.5, customPhases);
      arenaScoresWithData.push(score);
    }
  }

  // Batch average (used as final fallback when embedding is unavailable).
  const batchAvgFallback =
    arenaScoresWithData.length > 0
      ? arenaScoresWithData.reduce((sum, s) => sum + s, 0) / arenaScoresWithData.length
      : 0.5;

  // ── Pass 2: embedding-based fallback for models WITHOUT arena data ───────
  // Run all embedding calls in parallel for efficiency.
  const modelsWithoutArena = models.filter((m) => {
    const scores = arenaScoresBatch.get(m.id);
    return !scores || scores.size === 0;
  });

  const embeddingFallbackMap = new Map<string, number>();

  if (modelsWithoutArena.length > 0) {
    const fallbackResults = await Promise.all(
      modelsWithoutArena.map((model) =>
        deriveEmbeddingFallbackScore(model, phase, customPhases, batchAvgFallback).then(
          (score) => ({ modelId: model.id, score })
        )
      )
    );

    for (const { modelId, score } of fallbackResults) {
      embeddingFallbackMap.set(modelId, score);
    }
  }

  // ── Pass 3: score all models ─────────────────────────────────────────────
  return models.map((model) => {
    const arenaScores = arenaScoresBatch.get(model.id) ?? new Map();

    // Choose the best available fallback for this specific model.
    const fallbackScore = embeddingFallbackMap.has(model.id)
      ? embeddingFallbackMap.get(model.id)!
      : batchAvgFallback;

    const components = scoreModel(
      model,
      phase,
      arenaScores,
      preferredTier,
      fallbackScore,
      customPhases
    );
    const confidence = calculateConfidence(phase, arenaScores, model, customPhases);

    return { model, components, confidence };
  });
}
