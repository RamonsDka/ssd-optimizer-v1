// ─── Team Optimizer — Scoring Engine ─────────────────────────────────────────
// Generates 3 profiles (Premium, Balanced, Economic) × 10 SDD phases.
//
// Feature flag: SCORING_VERSION environment variable controls which engine is active.
//   v2 — LM Arena-based scoring (default if not set or unknown value)
//   v3 — UnifiedModelScores 5-dimensional engine
//   v4 — 17-dimensional engine (requires ModelCapabilities table populated)
//
// V4 fallback behaviour: if a model has no data in ModelCapabilities, the selector
// automatically degrades to V3 for that specific model (transparent to the caller).

import type {
  ModelRecord,
  TeamProfile,
  TeamRecommendation,
  PhaseAssignment,
  SddPhase,
  Tier,
  CustomSddPhase,
} from "@/types";
import { SDD_PHASES, SDD_PHASE_LABELS } from "@/types";
import type { ParsedModel } from "@/types";
import * as ScoringV2 from "./scoring-engine-v2";
import * as ScoringV3 from "./scoring-engine-v3";
import type { V3ScoreResult } from "./scoring-engine-v3";
import type {
  ModelCapabilitiesV4,
  ModelV4,
  UserProfileV4,
  ScoringResultV4,
} from "./v4/scoring-engine-v4";
import { finalScore as finalScoreV4, EXCLUSION_SCORE } from "./v4/scoring-engine-v4";
import type { SddPhaseV4 } from "./v4/phase-weights";
import { getCapabilitiesByModelId } from "@/lib/db/oim-service";

// ─── Phase Weights — per-phase capability priorities ─────────────────────────
// Keys align to ModelRecord.strengths tags

interface PhaseWeight {
  reasoning: number;
  coding: number;
  speed: number;
  context: number;   // bonus for large context windows
  structured: number; // bonus for structured-output strength
}

const PHASE_WEIGHTS: Record<SddPhase, PhaseWeight> = {
  "sdd-explore":  { reasoning: 0.4, coding: 0.1, speed: 0.2, context: 0.2, structured: 0.1 },
  "sdd-propose":  { reasoning: 0.35, coding: 0.1, speed: 0.2, context: 0.25, structured: 0.1 },
  "sdd-spec":     { reasoning: 0.3, coding: 0.15, speed: 0.15, context: 0.2, structured: 0.2 },
  "sdd-design":   { reasoning: 0.35, coding: 0.2, speed: 0.1, context: 0.2, structured: 0.15 },
  "sdd-tasks":    { reasoning: 0.25, coding: 0.2, speed: 0.25, context: 0.15, structured: 0.15 },
  "sdd-apply":    { reasoning: 0.15, coding: 0.45, speed: 0.2, context: 0.1, structured: 0.1 },
  "sdd-verify":   { reasoning: 0.3, coding: 0.35, speed: 0.15, context: 0.1, structured: 0.1 },
  "sdd-archive":  { reasoning: 0.2, coding: 0.15, speed: 0.3, context: 0.2, structured: 0.15 },
  "sdd-init":     { reasoning: 0.25, coding: 0.2, speed: 0.1, context: 0.35, structured: 0.1 },
  "sdd-onboard":  { reasoning: 0.3, coding: 0.15, speed: 0.2, context: 0.25, structured: 0.1 },
};

// Strength tag → weight key mapping
const STRENGTH_TO_WEIGHT: Record<string, keyof PhaseWeight> = {
  reasoning: "reasoning",
  architecture: "reasoning",
  analysis: "reasoning",
  creative: "reasoning",
  coding: "coding",
  code: "coding",
  speed: "speed",
  "cost-efficient": "speed",
  context: "context",
  multimodal: "context",
  "structured-output": "structured",
};

// ─── Context window thresholds ────────────────────────────────────────────────

const CONTEXT_LARGE = 128_000;   // ≥128k: full bonus
const CONTEXT_MEDIUM = 64_000;   // ≥64k: partial bonus
const CONTEXT_MIN_INIT = 100_000; // sdd-init requires 100k minimum

const MAX_PRIMARY_USES_PER_MODEL = 2; // prevent a single model dominating all phases

// ─── Scoring Version Config ───────────────────────────────────────────────────
// V2 is the LM Arena-based engine (fast, no DB for capabilities).
// V3 is the OIM multi-dimensional engine (UnifiedModelScores 5D).
// V4 is the 17-dimensional engine (ModelCapabilities table required).
// V1 is kept for comparison/analysis only (scoreModelV1 function below).
//
// Feature flag: read from process.env.SCORING_VERSION at call time.
// Valid values: "v2" | "v3" | "v4". Defaults to "v2" if not set or invalid.

export interface ScoringConfig {
  version: "v1" | "v2" | "v3" | "v4";
  /** Pre-fetched arena scores for V2. Required when version === "v2". */
  arenaScoresCache?: Map<string, Map<string, ScoringV2.ArenaScoreData>>;
  /**
   * Pre-fetched V3 results keyed by `${modelId}::${phase}`.
   * Required when version === "v3". Built by generateProfiles().
   */
  v3ScoresCache?: Map<string, V3ScoreResult>;
  /**
   * Pre-fetched V4 capabilities + fallback V3 scores.
   * Required when version === "v4". Built by generateProfiles().
   * Key: modelId — value contains the ModelCapabilitiesV4 (may be null if no data)
   * and the V3 fallback result for each phase.
   */
  v4Cache?: V4ScoringCache;
  customPhases?: CustomSddPhase[];
}

/**
 * Cache entry for V4 scoring.
 * Holds both the 17-dimensional capabilities (if available) and the V3 fallback.
 */
export interface V4ModelCacheEntry {
  /** 17-dimensional capabilities from ModelCapabilities table. null = no V4 data yet. */
  capabilities: ModelCapabilitiesV4 | null;
  /** Pre-fetched V3 results keyed by `${modelId}::${phase}` for fallback. */
  v3Fallback: Map<string, V3ScoreResult>;
  /** true when capabilities === null → this model will use V3 fallback */
  usesV3Fallback: boolean;
}

/** Full V4 scoring cache: modelId → entry with capabilities + V3 fallback. */
export type V4ScoringCache = Map<string, V4ModelCacheEntry>;

/** Metrics about V4 vs V3 fallback usage in the current run. */
export interface V4CoverageMetrics {
  totalModels: number;
  modelsWithV4Data: number;
  modelsUsingV3Fallback: number;
  v4CoveragePercent: number;
}

/**
 * Reads the SCORING_VERSION environment variable and returns a valid version string.
 * Defaults to "v2" when the env var is not set or has an unknown value.
 *
 * Used by generateProfiles() to auto-detect the engine without requiring the caller
 * to read the env directly.
 */
export function getScoringVersion(): "v1" | "v2" | "v3" | "v4" {
  const raw = process.env.SCORING_VERSION?.toLowerCase().trim();
  if (raw === "v4") return "v4";
  if (raw === "v3") return "v3";
  if (raw === "v1") return "v1";
  // Default: v2 (or any unknown value falls back to v2 for safety)
  return "v2";
}

const DEFAULT_CONFIG: ScoringConfig = { version: "v2" };

// ─── Tier preference order per profile ───────────────────────────────────────

const TIER_ORDER: Record<Tier, Tier[]> = {
  PREMIUM:  ["PREMIUM", "BALANCED", "ECONOMIC"],
  BALANCED: ["BALANCED", "PREMIUM", "ECONOMIC"],
  ECONOMIC: ["ECONOMIC", "BALANCED", "PREMIUM"],
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Compute a 0–1 normalized capability score for a model on a given SDD phase.
 * V1 scoring (LEGACY - for comparison only): tag-based strengths + context + cost.
 * 
 * NOTE: This function is kept for V1 vs V2 comparison analysis.
 * Production code uses V2 (LM Arena-based) by default.
 */
export function scoreModelV1(model: ModelRecord, phase: SddPhase | string): number {
  const weights = PHASE_WEIGHTS[phase as SddPhase] ?? PHASE_WEIGHTS["sdd-apply"];

  // Strength score: sum weights of matching tags
  let strengthScore = 0;
  for (const tag of model.strengths) {
    const key = STRENGTH_TO_WEIGHT[tag.toLowerCase()];
    if (key) {
      strengthScore += weights[key];
    }
  }

  // Context bonus
  let contextBonus = 0;
  if (model.contextWindow >= CONTEXT_LARGE) {
    contextBonus = weights.context;
  } else if (model.contextWindow >= CONTEXT_MEDIUM) {
    contextBonus = weights.context * 0.6;
  }

  // sdd-init special penalty: <100k context → 50% score reduction
  const initPenalty =
    phase === "sdd-init" && model.contextWindow < CONTEXT_MIN_INIT ? 0.5 : 1.0;

  // Cost multiplier: cheaper = slight bonus (max 5% boost for free models)
  const costMultiplier = model.costPer1M === 0
    ? 1.05
    : model.costPer1M < 1.0
    ? 1.02
    : 1.0;

  const raw = (strengthScore + contextBonus) * initPenalty * costMultiplier;

  // Clamp 0–1
  return Math.max(0, Math.min(1, raw));
}

/**
 * Compute score using V2 engine (arena-based).
 * Requires pre-fetched arena scores in config.
 */
function scoreModelV2(
  model: ModelRecord,
  phase: SddPhase | string,
  preferredTier: Tier,
  arenaScoresCache: Map<string, Map<string, ScoringV2.ArenaScoreData>>,
  customPhases?: CustomSddPhase[]
): number {
  const arenaScores = arenaScoresCache.get(model.id) ?? new Map();
  const components = ScoringV2.scoreModel(model, phase, arenaScores, preferredTier, 0.5, customPhases);
  return components.final;
}

/**
 * Compute score using V3 engine (UnifiedModelMatrix multi-dimensional).
 * Uses pre-fetched V3 scores from the cache to avoid async calls in the
 * synchronous build-profile loop.
 *
 * Cache key: `${modelId}::${phase}` (set by generateProfiles before building).
 * Falls back to V2 or 0.4 when no cache entry is present.
 */
function scoreModelV3(
  model: ModelRecord,
  phase: SddPhase | string,
  v3ScoresCache: Map<string, V3ScoreResult>
): number {
  const cacheKey = `${model.id}::${phase}`;
  const cached = v3ScoresCache.get(cacheKey);
  if (cached) return cached.finalScore;
  // No V3 data for this model/phase → graceful fallback
  return ScoringV3.NULL_DIMENSION_FALLBACK;
}

// ─── V4 Tier Mapping ─────────────────────────────────────────────────────────

/**
 * Maps the existing 3-tier system (ModelRecord.tier) to the V4 profile tiers.
 *
 * V4 uses a more granular tier system ("free_api", "direct_api_paid", etc.)
 * defined in §6.1 of SDD-MODEL-SELECTION-ENGINE.md. We map the legacy 3-tier
 * to a compatible subset so V4 eligibility scoring works correctly.
 */
const TIER_TO_V4_PROFILE: Record<Tier, UserProfileV4> = {
  PREMIUM: {
    profileId: "premium",
    allowedTiers: ["PREMIUM", "BALANCED", "ECONOMIC"],
    excludedTiers: [],
  },
  BALANCED: {
    profileId: "balanced",
    allowedTiers: ["BALANCED", "PREMIUM", "ECONOMIC"],
    excludedTiers: [],
  },
  ECONOMIC: {
    profileId: "economic",
    allowedTiers: ["ECONOMIC", "BALANCED", "PREMIUM"],
    excludedTiers: [],
  },
};

/**
 * Maps a V4 phase key (without "sdd-" prefix) to a full SddPhaseV4 key.
 * SddPhaseV4 uses short names: "explore", "propose", etc.
 * SddPhase (V2/V3) uses prefixed names: "sdd-explore", "sdd-propose", etc.
 * Custom phases that don't match are mapped to "apply" as a safe default.
 * Exported for testing purposes.
 */
export function toV4Phase(phase: SddPhase | string): SddPhaseV4 {
  const map: Record<string, SddPhaseV4> = {
    "sdd-explore":    "explore",
    "sdd-propose":    "propose",
    "sdd-spec":       "spec",
    "sdd-design":     "design",
    "sdd-tasks":      "tasks",
    "sdd-apply":      "apply",
    "sdd-verify":     "verify",
    "sdd-archive":    "archive",
    "sdd-init":       "init",
    "sdd-onboard":    "onboard",
    // Short names pass through directly
    "explore":  "explore",
    "propose":  "propose",
    "spec":     "spec",
    "design":   "design",
    "tasks":    "tasks",
    "apply":    "apply",
    "verify":   "verify",
    "archive":  "archive",
    "init":     "init",
    "onboard":  "onboard",
    "orchestrator": "orchestrator",
  };
  return map[phase] ?? "apply";
}

/**
 * Builds a ModelV4 from a ModelRecord + pre-fetched ModelCapabilitiesV4.
 * ModelRecord does not have `isThinkingModel` yet (added in Prisma Phase 1).
 * For now, we default it to false and derive it heuristically from model ID.
 *
 * Heuristic: model IDs containing "r1", "o1", "o3", "o4", "thinking",
 * "magistral", "qwq" are treated as thinking models.
 * Exported for testing purposes.
 */
export function buildModelV4(
  model: ModelRecord,
  capabilities: ModelCapabilitiesV4
): ModelV4 {
  const thinkingPatterns = /\b(r1|r2|o1|o3|o4|thinking|magistral|qwq|reasoner)\b/i;
  const isThinkingModel = thinkingPatterns.test(model.id) || thinkingPatterns.test(model.name);

  return {
    modelId:             model.id,
    isThinkingModel,
    contextWindowTokens: model.contextWindow,
    provider:            model.providerId,
    tier:                model.tier,
    capabilities,
  };
}

/**
 * Compute score using V4 engine (17-dimensional ModelCapabilities).
 *
 * Fallback behaviour:
 * - If the model has no V4 capabilities data, automatically falls back to V3.
 * - When fallback occurs, logs a warning via console.warn for debugging.
 * - The fallback is transparent: the caller receives a valid [0,1] score either way.
 *
 * Score normalization: V4 finalScore is in [0, 10]. We normalize to [0, 1]
 * to maintain compatibility with the existing selector pipeline.
 */
function scoreModelV4(
  model: ModelRecord,
  phase: SddPhase | string,
  cacheEntry: V4ModelCacheEntry,
  preferredTier: Tier
): number {
  // ── Fallback path: no V4 data for this model ──────────────────────────────
  if (cacheEntry.usesV3Fallback || cacheEntry.capabilities === null) {
    console.warn(
      `[selector] V4 fallback → V3 for model "${model.id}" in phase "${phase}" ` +
      `(no ModelCapabilities data)`
    );
    const cacheKey = `${model.id}::${phase}`;
    const v3Result = cacheEntry.v3Fallback.get(cacheKey);
    if (v3Result) return v3Result.finalScore;
    return ScoringV3.NULL_DIMENSION_FALLBACK;
  }

  // ── V4 path: compute 17-dimensional score ─────────────────────────────────
  const modelV4 = buildModelV4(model, cacheEntry.capabilities);
  const profile = TIER_TO_V4_PROFILE[preferredTier];
  const v4Phase = toV4Phase(phase);

  const result: ScoringResultV4 = finalScoreV4(modelV4, v4Phase, profile);

  // Excluded models get score 0 (they will never be picked as primary)
  if (result.excluded || result.finalScore <= EXCLUSION_SCORE) {
    return 0;
  }

  // Normalize from [0, 10] to [0, 1] for compatibility with the scoring pipeline
  return Math.max(0, Math.min(1, result.finalScore / 10));
}

/**
 * Compute V4 coverage metrics from the cache.
 * Used for logging and telemetry in generateProfiles().
 * Exported for testing purposes.
 */
export function computeV4Coverage(cache: V4ScoringCache): V4CoverageMetrics {
  const total = cache.size;
  const withV4 = [...cache.values()].filter((e) => !e.usesV3Fallback).length;
  const withFallback = total - withV4;
  return {
    totalModels: total,
    modelsWithV4Data: withV4,
    modelsUsingV3Fallback: withFallback,
    v4CoveragePercent: total === 0 ? 0 : Math.round((withV4 / total) * 100),
  };
}

/**
 * Unified scoring function with version selection.
 * Default: V2 (LM Arena-based).
 *
 * V4 path: uses 17-dimensional engine with automatic V3 fallback per model.
 */
export function scoreModel(
  model: ModelRecord,
  phase: SddPhase | string,
  config: ScoringConfig = DEFAULT_CONFIG,
  preferredTier?: Tier
): number {
  if (config.version === "v4") {
    if (!config.v4Cache) {
      throw new Error("V4 scoring requires v4Cache in config");
    }
    if (!preferredTier) {
      throw new Error("V4 scoring requires preferredTier parameter");
    }
    const cacheEntry = config.v4Cache.get(model.id);
    if (!cacheEntry) {
      // Model not in cache at all — treat as V3 fallback with neutral score
      console.warn(
        `[selector] V4 cache miss for model "${model.id}" — using neutral fallback score`
      );
      return ScoringV3.NULL_DIMENSION_FALLBACK;
    }
    return scoreModelV4(model, phase, cacheEntry, preferredTier);
  }

  if (config.version === "v3") {
    if (!config.v3ScoresCache) {
      throw new Error("V3 scoring requires v3ScoresCache in config");
    }
    return scoreModelV3(model, phase, config.v3ScoresCache);
  }

  if (config.version === "v2") {
    if (!config.arenaScoresCache) {
      throw new Error("V2 scoring requires arenaScoresCache in config");
    }
    if (!preferredTier) {
      throw new Error("V2 scoring requires preferredTier parameter");
    }
    return scoreModelV2(model, phase, preferredTier, config.arenaScoresCache, config.customPhases);
  }

  // V1 (legacy — tag-based)
  return scoreModelV1(model, phase);
}

/**
 * Sort models for a phase by tier preference first, then by score.
 */
function rankModelsForPhase(
  models: ModelRecord[],
  phase: SddPhase | string,
  preferredTierOrder: Tier[],
  config: ScoringConfig = DEFAULT_CONFIG
): ModelRecord[] {
  const preferredTier = preferredTierOrder[0]; // First tier in order is the preferred one

  const scored = models.map((m) => {
    const idx = preferredTierOrder.indexOf(m.tier);
    return {
      model: m,
      score: scoreModel(m, phase, config, preferredTier),
      // indexOf returns -1 when the tier is not in the order list.
      // Using Infinity pushes unknown tiers to the end instead of the top.
      tierIdx: idx === -1 ? Infinity : idx,
    };
  });

  // Sort: tier order first (lower idx = better), then score descending
  scored.sort((a, b) => {
    if (a.tierIdx !== b.tierIdx) return a.tierIdx - b.tierIdx;
    return b.score - a.score;
  });

  return scored.map((s) => s.model);
}

// ─── Profile Builder ───────────────────────────────────────────────────────────

function buildProfile(
  models: ModelRecord[],
  profileTier: Tier,
  config: ScoringConfig = DEFAULT_CONFIG,
  strict = false
): TeamProfile {
  const tierOrder = TIER_ORDER[profileTier];
  const primaryUsageCount = new Map<string, number>();
  const phases: PhaseAssignment[] = [];
  const customPhases = config.customPhases ?? [];
  const phaseSequence = [
    ...SDD_PHASES,
    ...customPhases.map((phase) => phase.name),
  ];

  for (const phase of phaseSequence) {
    const ranked = rankModelsForPhase(models, phase, tierOrder, config);

    // Pick primary: respect MAX_PRIMARY_USES_PER_MODEL
    let primary: ModelRecord | null = null;
    for (const candidate of ranked) {
      const uses = primaryUsageCount.get(candidate.id) ?? 0;
      if (uses < MAX_PRIMARY_USES_PER_MODEL) {
        primary = candidate;
        primaryUsageCount.set(candidate.id, uses + 1);
        break;
      }
    }

    // Fallback when all candidates hit the usage cap:
    // - strict=false → pick best regardless of cap (permissive behaviour)
    // - strict=true  → do NOT reach outside the capped pool; skip this phase
    if (!primary && !strict) {
      primary = ranked[0] ?? null;
    }

    if (!primary) continue; // no eligible model — skip phase

    // Fallbacks: next 3 models from ranked list (excluding primary)
    const fallbacks = ranked
      .filter((m) => m.id !== primary!.id)
      .slice(0, 3);

    const score = scoreModel(primary, phase, config, profileTier);
    const customPhase = customPhases.find((item) => item.name === phase);

    // Compute AI confidence only for models categorized by Gemini AI
    let aiConfidence: number | undefined;
    if (primary.discoveredByAI && config.arenaScoresCache) {
      const arenaScores = config.arenaScoresCache.get(primary.id) ?? new Map();
      aiConfidence = ScoringV2.calculateConfidence(phase, arenaScores, primary, customPhases);
    }

    phases.push({
      phase,
      phaseLabel: customPhase?.displayName ?? (phase in SDD_PHASE_LABELS ? SDD_PHASE_LABELS[phase as SddPhase].es : phase),
      primary,
      fallbacks,
      score,
      reason: buildReason(primary, phase, score, customPhase?.displayName),
      warnings: buildWarnings(primary, phase),
      ...(aiConfidence !== undefined && { aiConfidence }),
    });
  }

  // Aggregate stats
  const totalCost = phases.reduce((sum, p) => sum + p.primary.costPer1M, 0);
  const avgCtx =
    phases.length > 0
      ? Math.round(
          phases.reduce((sum, p) => sum + p.primary.contextWindow, 0) /
            phases.length
        )
      : 0;

  return {
    tier: profileTier,
    phases,
    totalEstimatedCost: totalCost,
    avgContextWindow: avgCtx,
  };
}

// ─── Reason + Warning builders ────────────────────────────────────────────────

function buildReason(model: ModelRecord, phase: SddPhase | string, score: number, customLabel?: string): string {
  const pct = Math.round(score * 100);
  const topStrengths = model.strengths.slice(0, 2).join(", ") || "general";

  const phaseActions: Record<SddPhase, string> = {
    "sdd-explore":  "exploración creativa y análisis de alto nivel",
    "sdd-propose":  "propuestas de cambio con claridad estructural",
    "sdd-spec":     "especificaciones precisas con Given/When/Then",
    "sdd-design":   "decisiones de arquitectura y diagramas técnicos",
    "sdd-tasks":    "desglose de tareas con estimaciones realistas",
    "sdd-apply":    "implementación de código con alta precisión",
    "sdd-verify":   "verificación de calidad y detección de regresiones",
    "sdd-archive":  "consolidación y documentación de cambios",
    "sdd-init":     "inicialización de proyectos con contexto completo",
    "sdd-onboard":  "onboarding de nuevos agentes en el ciclo SDD",
  };

  if (phase in phaseActions) {
    return `${model.name} — puntuación ${pct}% para ${phaseActions[phase as SddPhase]}. Fortalezas: ${topStrengths}.`;
  }

  return `${model.name} — puntuación ${pct}% para ${customLabel ?? phase}. Fortalezas: ${topStrengths}.`;
}

function buildWarnings(model: ModelRecord, phase: SddPhase | string): string[] {
  const warnings: string[] = [];

  if (phase === "sdd-init" && model.contextWindow < CONTEXT_MIN_INIT) {
    warnings.push(
      `⚠ Ventana de contexto insuficiente (${(model.contextWindow / 1000).toFixed(0)}k). sdd-init requiere ≥100k tokens para procesar codebases completos.`
    );
  }

  if (model.costPer1M > 15) {
    warnings.push(`💰 Costo alto: $${model.costPer1M.toFixed(2)}/1M tokens.`);
  }

  if (model.discoveredByAI) {
    warnings.push("🤖 Modelo categorizado por IA — verificar tier manualmente.");
  }

  return warnings;
}

// ─── Main: generateProfiles ───────────────────────────────────────────────────

/**
 * Generate all 3 profiles from a set of resolved models.
 *
 * @param inputModels  - Models parsed from user input (resolved from DB)
 * @param dbFallback   - Full DB dictionary as fallback pool (ignored when strict=true)
 * @param parsedModels - Raw parsed input (for summary)
 * @param unresolved   - Model IDs that couldn't be resolved
 * @param options      - Scoring configuration options
 * @param options.strict - When true, only user-provided inputModels are used as the pool;
 *                         dbFallback is ignored entirely. Defaults to false.
 */
export async function generateProfiles(
  inputModels: ModelRecord[],
  dbFallback: ModelRecord[],
  parsedModels: ParsedModel[],
  unresolved: string[],
  options?: { version?: "v1" | "v2" | "v3" | "v4"; customPhases?: CustomSddPhase[]; strict?: boolean }
): Promise<TeamRecommendation> {
  // Read feature flag: caller can override, otherwise auto-detect from env
  const resolvedVersion = options?.version ?? getScoringVersion();
  const strict = options?.strict ?? true; // Default to strict mode: only use user-provided models

  // Pool resolution:
  // - strict=true  → use ONLY inputModels (no DB fallback contamination)
  // - strict=false → merge dbFallback + inputModels (inputModels override duplicates)
  let pool: ModelRecord[];
  if (strict || dbFallback.length === 0) {
    // Strict mode: respect exactly what the user provided
    const byId = new Map<string, ModelRecord>();
    for (const m of inputModels) byId.set(m.id, m);
    pool = [...byId.values()];
  } else {
    // Permissive mode: merge DB fallback with user models (user overrides)
    const allById = new Map<string, ModelRecord>();
    for (const m of dbFallback) allById.set(m.id, m);
    for (const m of inputModels) allById.set(m.id, m); // override with user's models
    pool = [...allById.values()];
  }

  // Config for scoring
  let finalConfig: ScoringConfig = { version: resolvedVersion };
  if (options?.customPhases?.length) {
    finalConfig.customPhases = options.customPhases;
  }

  if (resolvedVersion === "v2") {
    const modelIds = pool.map((m) => m.id);
    const arenaScoresCache = await ScoringV2.fetchArenaScoresBatch(modelIds);
    finalConfig = { ...finalConfig, arenaScoresCache };
  }

  if (resolvedVersion === "v3") {
    // Pre-fetch V3 scores for all model×phase combinations to keep
    // buildProfile() synchronous. Cache key: `${modelId}::${phase}`.
    const customPhases = options?.customPhases ?? [];
    const allPhases: Array<SddPhase | string> = [
      ...SDD_PHASES,
      ...customPhases.map((p) => p.name),
    ];
    const modelIds = pool.map((m) => m.id);

    const v3ScoresCache = new Map<string, V3ScoreResult>();
    const batchResults = await Promise.all(
      allPhases.map((phase) =>
        ScoringV3.scoreModelsBatchV3(modelIds, phase, customPhases).then((results) =>
          results.map(({ modelId, result }) => ({ modelId, phase, result }))
        )
      )
    );

    for (const phaseResults of batchResults) {
      for (const { modelId, phase, result } of phaseResults) {
        v3ScoresCache.set(`${modelId}::${phase}`, result);
      }
    }

    finalConfig = { ...finalConfig, v3ScoresCache };
  }

  if (resolvedVersion === "v4") {
    // ── V4 cache construction ────────────────────────────────────────────────
    // 1. Fetch ModelCapabilities from DB for each model (async, parallel).
    // 2. Also pre-fetch V3 scores as fallback for models with no V4 data.
    // 3. Build V4ScoringCache (modelId → { capabilities, v3Fallback, usesV3Fallback }).
    //
    // Fallback trigger: model has no row in ModelCapabilities → use V3.
    // This is transparent to buildProfile() — it just calls scoreModel() normally.

    const customPhases = options?.customPhases ?? [];
    const allPhases: Array<SddPhase | string> = [
      ...SDD_PHASES,
      ...customPhases.map((p) => p.name),
    ];
    const modelIds = pool.map((m) => m.id);

    // Step 1: Fetch V4 capabilities for all models in parallel
    const capabilitiesResults = await Promise.all(
      modelIds.map(async (modelId) => {
        try {
          const caps = await getCapabilitiesByModelId(modelId);
          return { modelId, capabilities: caps };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[selector] Failed to fetch V4 capabilities for "${modelId}": ${msg}`);
          return { modelId, capabilities: null };
        }
      })
    );

    // Step 2: Identify which models need V3 fallback
    const fallbackModelIds = capabilitiesResults
      .filter((r) => r.capabilities === null)
      .map((r) => r.modelId);

    // Step 3: Pre-fetch V3 scores ONLY for fallback models (optimization)
    const v3FallbackScoresMap = new Map<string, Map<string, V3ScoreResult>>();

    if (fallbackModelIds.length > 0) {
      console.warn(
        `[selector] V4 engine: ${fallbackModelIds.length}/${modelIds.length} model(s) ` +
        `have no ModelCapabilities data → falling back to V3: [${fallbackModelIds.join(", ")}]`
      );

      const v3BatchResults = await Promise.all(
        allPhases.map((phase) =>
          ScoringV3.scoreModelsBatchV3(fallbackModelIds, phase, customPhases).then((results) =>
            results.map(({ modelId, result }) => ({ modelId, phase, result }))
          )
        )
      );

      for (const phaseResults of v3BatchResults) {
        for (const { modelId, phase, result } of phaseResults) {
          if (!v3FallbackScoresMap.has(modelId)) {
            v3FallbackScoresMap.set(modelId, new Map());
          }
          v3FallbackScoresMap.get(modelId)!.set(`${modelId}::${phase}`, result);
        }
      }
    }

    // Step 4: Build the V4ScoringCache
    const v4Cache: V4ScoringCache = new Map();

    for (const { modelId, capabilities } of capabilitiesResults) {
      const usesV3Fallback = capabilities === null;
      const v3Fallback = v3FallbackScoresMap.get(modelId) ?? new Map<string, V3ScoreResult>();

      v4Cache.set(modelId, {
        capabilities: capabilities as ModelCapabilitiesV4 | null,
        v3Fallback,
        usesV3Fallback,
      });
    }

    // Log coverage metrics for debugging
    const metrics = computeV4Coverage(v4Cache);
    console.info(
      `[selector] V4 coverage: ${metrics.modelsWithV4Data}/${metrics.totalModels} models ` +
      `(${metrics.v4CoveragePercent}%) using V4, ` +
      `${metrics.modelsUsingV3Fallback} using V3 fallback`
    );

    finalConfig = { ...finalConfig, v4Cache };
  }

  const premium = buildProfile(pool, "PREMIUM", finalConfig, strict);
  const balanced = buildProfile(pool, "BALANCED", finalConfig, strict);
  const economic = buildProfile(pool, "ECONOMIC", finalConfig, strict);

  return {
    premium,
    balanced,
    economic,
    inputModels: parsedModels,
    unresolvedModels: unresolved,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Comparison Helpers ───────────────────────────────────────────────────────

export interface ComparisonResult {
  phase: SddPhase | string;
  tier: Tier;
  v1Primary: string;
  v1Score: number;
  v2Primary: string;
  v2Score: number;
  primaryChanged: boolean;
  scoreDelta: number;
}

/**
 * Compare V1 vs V2 scoring for a set of models across all phases and tiers.
 * Returns detailed comparison showing which models were selected and score differences.
 */
export async function compareV1vsV2(
  inputModels: ModelRecord[],
  dbFallback: ModelRecord[]
): Promise<ComparisonResult[]> {
  const results: ComparisonResult[] = [];

  // Generate profiles with both versions
  const v1Profiles = await generateProfiles(inputModels, dbFallback, [], [], { version: "v1" });
  const v2Profiles = await generateProfiles(inputModels, dbFallback, [], [], { version: "v2" });

  const tiers: Tier[] = ["PREMIUM", "BALANCED", "ECONOMIC"];

  for (const tier of tiers) {
    const v1Profile = v1Profiles[tier.toLowerCase() as keyof TeamRecommendation] as TeamProfile;
    const v2Profile = v2Profiles[tier.toLowerCase() as keyof TeamRecommendation] as TeamProfile;

    for (let i = 0; i < v1Profile.phases.length; i++) {
      const v1Phase = v1Profile.phases[i];
      const v2Phase = v2Profile.phases[i];

      results.push({
        phase: v1Phase.phase,
        tier,
        v1Primary: v1Phase.primary.name,
        v1Score: v1Phase.score,
        v2Primary: v2Phase.primary.name,
        v2Score: v2Phase.score,
        primaryChanged: v1Phase.primary.id !== v2Phase.primary.id,
        scoreDelta: v2Phase.score - v1Phase.score,
      });
    }
  }

  return results;
}

/**
 * Generate a summary report comparing V1 vs V2 scoring.
 * Returns markdown-formatted comparison table.
 */
export function formatComparisonReport(results: ComparisonResult[]): string {
  const lines: string[] = [
    "# V1 vs V2 Scoring Comparison",
    "",
    "| Tier | Phase | V1 Primary | V1 Score | V2 Primary | V2 Score | Changed | Delta |",
    "|------|-------|------------|----------|------------|----------|---------|-------|",
  ];

  for (const r of results) {
    const changed = r.primaryChanged ? "✓" : "";
    const delta = r.scoreDelta >= 0 ? `+${r.scoreDelta.toFixed(3)}` : r.scoreDelta.toFixed(3);
    
    lines.push(
      `| ${r.tier} | ${r.phase} | ${r.v1Primary} | ${r.v1Score.toFixed(3)} | ${r.v2Primary} | ${r.v2Score.toFixed(3)} | ${changed} | ${delta} |`
    );
  }

  // Summary stats
  const totalChanges = results.filter((r) => r.primaryChanged).length;
  const avgDelta = results.reduce((sum, r) => sum + r.scoreDelta, 0) / results.length;

  lines.push("");
  lines.push("## Summary");
  lines.push(`- Total comparisons: ${results.length}`);
  lines.push(`- Primary model changes: ${totalChanges} (${((totalChanges / results.length) * 100).toFixed(1)}%)`);
  lines.push(`- Average score delta: ${avgDelta >= 0 ? "+" : ""}${avgDelta.toFixed(3)}`);

  return lines.join("\n");
}
