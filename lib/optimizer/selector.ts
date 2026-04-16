// ─── Team Optimizer — Scoring Engine ─────────────────────────────────────────
// Generates 3 profiles (Premium, Balanced, Economic) × 10 SDD phases.

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
// V2 is the active scoring engine (LM Arena-based).
// V1 is kept for comparison/analysis only (scoreModelV1 function below).

export interface ScoringConfig {
  version: "v1" | "v2";
  arenaScoresCache?: Map<string, Map<string, ScoringV2.ArenaScoreData>>; // Pre-fetched arena scores for V2
  customPhases?: CustomSddPhase[];
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
 * Unified scoring function with version selection.
 * Default: V1 (backward compatible).
 */
export function scoreModel(
  model: ModelRecord,
  phase: SddPhase | string,
  config: ScoringConfig = DEFAULT_CONFIG,
  preferredTier?: Tier
): number {
  if (config.version === "v2") {
    if (!config.arenaScoresCache) {
      throw new Error("V2 scoring requires arenaScoresCache in config");
    }
    if (!preferredTier) {
      throw new Error("V2 scoring requires preferredTier parameter");
    }
    return scoreModelV2(model, phase, preferredTier, config.arenaScoresCache, config.customPhases);
  }

  // V1 (default)
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

  const scored = models.map((m) => ({
    model: m,
    score: scoreModel(m, phase, config, preferredTier),
    tierIdx: preferredTierOrder.indexOf(m.tier),
  }));

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
  config: ScoringConfig = DEFAULT_CONFIG
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

    // Fallback: if all candidates are exhausted, pick best ignoring cap
    if (!primary) {
      primary = ranked[0] ?? null;
    }

    if (!primary) continue; // no models at all — skip phase

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
 * @param dbFallback   - Full DB dictionary as fallback pool
 * @param parsedModels - Raw parsed input (for summary)
 * @param unresolved   - Model IDs that couldn't be resolved
 * @param config       - Scoring configuration (default: V1)
 */
export async function generateProfiles(
  inputModels: ModelRecord[],
  dbFallback: ModelRecord[],
  parsedModels: ParsedModel[],
  unresolved: string[],
  options?: { version?: "v1" | "v2"; customPhases?: CustomSddPhase[] }
): Promise<TeamRecommendation> {
  const resolvedVersion = options?.version || "v2"; // Default switched to V2

  // Pool of all models (inputModels + db fallback with deduplication)
  const allById = new Map<string, ModelRecord>();
  for (const m of dbFallback) allById.set(m.id, m);
  for (const m of inputModels) allById.set(m.id, m); // override with user's models
  const pool = [...allById.values()];

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

  const premium = buildProfile(pool, "PREMIUM", finalConfig);
  const balanced = buildProfile(pool, "BALANCED", finalConfig);
  const economic = buildProfile(pool, "ECONOMIC", finalConfig);

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
