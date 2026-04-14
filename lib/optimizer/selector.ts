// ─── Team Optimizer — Scoring Engine ─────────────────────────────────────────
// Generates 3 profiles (Premium, Balanced, Economic) × 10 SDD phases.

import type {
  ModelRecord,
  TeamProfile,
  TeamRecommendation,
  PhaseAssignment,
  SddPhase,
  Tier,
} from "@/types";
import { SDD_PHASES, SDD_PHASE_LABELS } from "@/types";
import type { ParsedModel } from "@/types";

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

// ─── Tier preference order per profile ───────────────────────────────────────

const TIER_ORDER: Record<Tier, Tier[]> = {
  PREMIUM:  ["PREMIUM", "BALANCED", "ECONOMIC"],
  BALANCED: ["BALANCED", "PREMIUM", "ECONOMIC"],
  ECONOMIC: ["ECONOMIC", "BALANCED", "PREMIUM"],
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Compute a 0–1 normalized capability score for a model on a given SDD phase.
 */
export function scoreModel(model: ModelRecord, phase: SddPhase): number {
  const weights = PHASE_WEIGHTS[phase];

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
 * Sort models for a phase by tier preference first, then by score.
 */
function rankModelsForPhase(
  models: ModelRecord[],
  phase: SddPhase,
  preferredTierOrder: Tier[]
): ModelRecord[] {
  const scored = models.map((m) => ({
    model: m,
    score: scoreModel(m, phase),
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
  profileTier: Tier
): TeamProfile {
  const tierOrder = TIER_ORDER[profileTier];
  const primaryUsageCount = new Map<string, number>();
  const phases: PhaseAssignment[] = [];

  for (const phase of SDD_PHASES) {
    const ranked = rankModelsForPhase(models, phase, tierOrder);

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

    const score = scoreModel(primary, phase);

    phases.push({
      phase,
      phaseLabel: SDD_PHASE_LABELS[phase].es, // Default to Spanish, will be overridden in frontend
      primary,
      fallbacks,
      score,
      reason: buildReason(primary, phase, score),
      warnings: buildWarnings(primary, phase),
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

function buildReason(model: ModelRecord, phase: SddPhase, score: number): string {
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

  return `${model.name} — puntuación ${pct}% para ${phaseActions[phase]}. Fortalezas: ${topStrengths}.`;
}

function buildWarnings(model: ModelRecord, phase: SddPhase): string[] {
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
 */
export function generateProfiles(
  inputModels: ModelRecord[],
  dbFallback: ModelRecord[],
  parsedModels: ParsedModel[],
  unresolved: string[]
): TeamRecommendation {
  // Merge input models with DB fallback (input models take priority — dedup by id)
  const allById = new Map<string, ModelRecord>();
  for (const m of dbFallback) allById.set(m.id, m);
  for (const m of inputModels) allById.set(m.id, m); // override with user's models

  const pool = [...allById.values()];

  const premium  = buildProfile(pool, "PREMIUM");
  const balanced = buildProfile(pool, "BALANCED");
  const economic = buildProfile(pool, "ECONOMIC");

  return {
    premium,
    balanced,
    economic,
    inputModels: parsedModels,
    unresolvedModels: unresolved,
    generatedAt: new Date().toISOString(),
  };
}
