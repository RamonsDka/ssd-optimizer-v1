// ─── Scoring Engine V4 — 17-Dimensional SDD Phase Scoring ───────────────────
//
// Motor de selección de modelos LLM para fases SDD usando 17 dimensiones de
// evaluación organizadas en 4 grupos (A: inteligencia, B: técnicas,
// C: especializadas, D: operacionales).
//
// Fórmula base (§8.1 SDD-MODEL-SELECTION-ENGINE.md):
//   weighted_sum = Σ(capability[d] × weight[d])  para cada dimensión d
//   base_score   = weighted_sum / total_weight
//   adjusted     = applySpecialRules(model, phase, base_score)
//   final_score  = clamp(adjusted, 0.0, 10.0)
//
// Score final combinado (§8.3):
//   final = phase_score × 0.7 + (eligibility_score × 10) × 0.3
//
// Fallback chain (§9.1):
//   - Top-4 modelos por score final
//   - Restricción: mínimo 2 proveedores diferentes en el chain
//   - Modelos excluidos (score = -999) son descartados completamente

import { PHASE_WEIGHTS, PHASE_MIN_QUALITY_SCORES, type SddPhaseV4 } from "./phase-weights";
import {
  applySpecialRules,
  isExcluded,
  EXCLUSION_SCORE,
  type ModelForSpecialRules,
} from "./special-rules";

// ─── Tipos Públicos ───────────────────────────────────────────────────────────

/**
 * Capacidades de un modelo en las 17 dimensiones V4.
 * Todos los valores están normalizados en la escala 0.0 – 10.0.
 * Fuente: §3.2 SDD-MODEL-SELECTION-ENGINE.md (Normalización de Métricas)
 */
export interface ModelCapabilitiesV4 {
  modelId: string;

  // Grupo A: Inteligencia y Razonamiento
  /** A1 — Inteligencia general (MMLU, HLE, Chatbot Arena ELO) */
  a1_overall_intelligence: number;
  /** A2 — Profundidad de razonamiento (GPQA Diamond, AIME) */
  a2_reasoning_depth: number;
  /** A3 — Seguimiento de instrucciones (IFEval) */
  a3_instruction_following: number;
  /** A4 — Resistencia a alucinaciones (SimpleQA, TruthfulQA) */
  a4_hallucination_resistance: number;

  // Grupo B: Capacidades Técnicas
  /** B1 — Calidad de código (SWE-bench Verified) */
  b1_coding_quality: number;
  /** B2 — Soporte multi-lenguaje (Aider Polyglot) */
  b2_coding_multilang: number;
  /** B3 — Ventana de contexto declarada (log-normalizada a 0-10) */
  b3_context_window_score: number;
  /** B4 — Ventana de contexto efectiva real (sin "Lost in the Middle") */
  b4_context_effective_score: number;
  /** B5 — Precisión en llamadas a herramientas (BFCL) */
  b5_tool_calling_accuracy: number;
  /** B6 — Fiabilidad en flujos agénticos (AgentBench) */
  b6_agentic_reliability: number;

  // Grupo C: Capacidades Especializadas
  /** C1 — Comprensión visual (MMMU, MathVision) */
  c1_visual_understanding: number;
  /** C2 — Adherencia a formatos estructurados (eval empírico) */
  c2_format_adherence: number;
  /** C3 — Coherencia en contextos largos (RULER) */
  c3_long_context_coherence: number;
  /** C4 — Conocimiento de arquitecturas software (eval empírico) */
  c4_architecture_awareness: number;

  // Grupo D: Operacionales
  /** D1 — Velocidad en tokens/segundo (normalizada a 0-10) */
  d1_speed_score: number;
  /** D2 — Score de costo (inverso — menor costo = mayor score) */
  d2_cost_score: number;
  /** D3 — Disponibilidad histórica (% uptime en 30 días, normalizado) */
  d3_availability_score: number;
}

/**
 * Modelo completo requerido por el motor V4.
 * Combina los capabilities con los metadatos necesarios para reglas especiales.
 */
export interface ModelV4 extends ModelForSpecialRules {
  /** Proveedor del modelo (e.g. "anthropic", "google", "deepseek") */
  provider: string;

  /** Tier del proveedor (e.g. "free_api", "direct_api_paid", etc.) */
  tier: string;

  /** Capacidades en las 17 dimensiones V4 */
  capabilities: ModelCapabilitiesV4;
}

/**
 * Desglose detallado por dimensión del score calculado.
 * Permite transparencia total en la UI del optimizer.
 */
export interface DimensionBreakdown {
  /** Score crudo de la dimensión (0.0-10.0) */
  raw: number;
  /** Peso asignado a la dimensión en esta fase */
  weight: number;
  /** Contribución ponderada: raw × weight */
  contribution: number;
}

/**
 * Resultado completo del cálculo de score para un modelo en una fase.
 */
export interface ScoringResultV4 {
  /** ID canónico del modelo */
  modelId: string;
  /** Fase SDD evaluada */
  phaseId: SddPhaseV4;
  /** Score final combinado (aptitud 70% + elegibilidad 30%), en [0.0, 10.0] */
  finalScore: number;
  /** Score base de suma ponderada ANTES de reglas especiales, en [0.0, 10.0] */
  baseScore: number;
  /** Score tras aplicar reglas especiales ANTES del combine con elegibilidad */
  adjustedPhaseScore: number;
  /** Score de elegibilidad de perfil (0.0-1.0) */
  eligibilityScore: number;
  /** Desglose por dimensión: raw, weight, contribution */
  scoreBreakdown: Record<keyof Omit<ModelCapabilitiesV4, "modelId">, DimensionBreakdown>;
  /** Nombres de las reglas especiales que fueron aplicadas */
  specialRulesApplied: string[];
  /** Si fue excluido, motivo de exclusión */
  exclusionReason?: string;
  /** true si el score es EXCLUSION_SCORE → modelo debe ser descartado */
  excluded: boolean;
}

/**
 * Perfil de prioridad y restricciones del usuario.
 * Determina qué providers son elegibles y con qué prioridad.
 */
export interface UserProfileV4 {
  /** ID del perfil: "premium" | "mixto" | "free" */
  profileId: string;

  /**
   * Tiers de providers permitidos en este perfil (en orden de prioridad).
   * El índice 0 tiene la mayor prioridad.
   * Fuente: §6.1 SDD-MODEL-SELECTION-ENGINE.md
   */
  allowedTiers: string[];

  /**
   * Tiers de providers explícitamente excluidos.
   * Si un modelo tiene un tier en esta lista, eligibilityScore = 0.
   */
  excludedTiers: string[];
}

/**
 * Un slot en el fallback chain de una fase.
 */
export interface ModelSlotV4 {
  /** Posición en el chain: 1 = primario, 2-4 = fallbacks */
  position: number;
  /** Rol semántico del slot */
  role: "primary" | "fallback";
  /** Score final del modelo en esta posición */
  score: number;
  /** Datos completos del modelo */
  model: ModelV4;
  /** Resultado completo del scoring para transparencia */
  scoringResult: ScoringResultV4;
}

// ─── Dimensiones Keys ──────────────────────────────────────────────────────

/** Array de las 17 dimensiones en el orden canónico */
const DIMENSION_KEYS = [
  "a1_overall_intelligence",
  "a2_reasoning_depth",
  "a3_instruction_following",
  "a4_hallucination_resistance",
  "b1_coding_quality",
  "b2_coding_multilang",
  "b3_context_window_score",
  "b4_context_effective_score",
  "b5_tool_calling_accuracy",
  "b6_agentic_reliability",
  "c1_visual_understanding",
  "c2_format_adherence",
  "c3_long_context_coherence",
  "c4_architecture_awareness",
  "d1_speed_score",
  "d2_cost_score",
  "d3_availability_score",
] as const;

type DimensionKey = (typeof DIMENSION_KEYS)[number];

// ─── 1. calculatePhaseScore ───────────────────────────────────────────────────

/**
 * Calcula el score de aptitud de un modelo para una fase SDD específica.
 *
 * Algoritmo (§8.1):
 * 1. Para cada una de las 17 dimensiones: contribución = capability[d] × weight[d]
 * 2. base_score = Σ(contribución[d]) / Σ(weight[d])    ← suma ponderada normalizada
 * 3. adjusted   = applySpecialRules(model, phase, base_score)
 * 4. final      = clamp(adjusted, 0.0, 10.0)
 *
 * @param model - Modelo con capabilities en las 17 dimensiones
 * @param phase - Fase SDD V4 a evaluar
 * @returns ScoringResultV4 con breakdown completo
 */
export function calculatePhaseScore(
  model: ModelV4,
  phase: SddPhaseV4
): ScoringResultV4 {
  const weights = PHASE_WEIGHTS[phase];
  const caps = model.capabilities;

  // ── Paso 1 y 2: Suma ponderada normalizada ───────────────────────────────
  let weightedSum = 0;
  let totalWeight = 0;
  const scoreBreakdown = {} as Record<DimensionKey, DimensionBreakdown>;

  for (const dim of DIMENSION_KEYS) {
    const raw = caps[dim];
    const weight = weights[dim];
    const contribution = raw * weight;

    weightedSum += contribution;
    totalWeight += weight;

    scoreBreakdown[dim] = { raw, weight, contribution };
  }

  // totalWeight > 0 siempre es true dado los pesos del documento, pero protegemos
  const baseScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // ── Paso 3: Aplicar reglas especiales ────────────────────────────────────
  const rulesResult = applySpecialRules(
    {
      modelId: model.modelId,
      isThinkingModel: model.isThinkingModel,
      contextWindowTokens: model.contextWindowTokens,
    },
    phase,
    baseScore
  );

  // ── Paso 4: Clamp al rango [0.0, 10.0] si no fue excluido ────────────────
  const excluded = isExcluded(rulesResult.adjustedScore);
  const adjustedPhaseScore = excluded
    ? EXCLUSION_SCORE
    : Math.min(10.0, Math.max(0.0, rulesResult.adjustedScore));

  return {
    modelId: model.modelId,
    phaseId: phase,
    finalScore: 0,              // Se calcula en finalScore()
    baseScore,
    adjustedPhaseScore,
    eligibilityScore: 0,        // Se calcula en finalScore()
    scoreBreakdown: scoreBreakdown as Record<keyof Omit<ModelCapabilitiesV4, "modelId">, DimensionBreakdown>,
    specialRulesApplied: rulesResult.appliedRules,
    exclusionReason: rulesResult.exclusionReason,
    excluded,
  };
}

// ─── 2. calculateEligibilityScore ─────────────────────────────────────────────

/**
 * Calcula el score de elegibilidad de un modelo según el perfil activo.
 *
 * Algoritmo (§8.3):
 * - Si el tier del modelo está excluido → 0.0
 * - Si el tier no está en allowedTiers → 0.0
 * - Priority score = 1.0 - (priorityIndex / totalTiers)
 *   (índice 0 tiene prioridad máxima = 1.0)
 * - Si el modelo tiene cuota diaria muy baja → × 0.3 (penalización severa)
 *
 * @param model   - Modelo a evaluar
 * @param profile - Perfil del usuario (premium, mixto, free)
 * @returns Score de elegibilidad en [0.0, 1.0]
 */
export function calculateEligibilityScore(
  model: ModelV4,
  profile: UserProfileV4
): number {
  // Verificar exclusión explícita
  if (profile.excludedTiers.includes(model.tier)) {
    return 0.0;
  }

  // Verificar si el tier está en los permitidos
  const priorityIndex = profile.allowedTiers.indexOf(model.tier);
  if (priorityIndex === -1) {
    return 0.0;
  }

  // Score de prioridad: el primer tier tiene score 1.0, el último ~0
  const priorityScore =
    profile.allowedTiers.length > 1
      ? 1.0 - priorityIndex / profile.allowedTiers.length
      : 1.0;

  return Math.max(0.0, Math.min(1.0, priorityScore));
}

// ─── 3. finalScore ────────────────────────────────────────────────────────────

/**
 * Calcula el score final combinado que determina el ranking.
 *
 * Fórmula (§8.3):
 *   final = phase_score × 0.7 + (eligibility × 10) × 0.3
 *
 * El factor 0.7/0.3 prioriza la aptitud técnica sobre la restricción de perfil,
 * pero penaliza modelos que están fuera del tier preferido del usuario.
 *
 * Si eligibilityScore = 0.0 → retorna EXCLUSION_SCORE (modelo inelegible por perfil).
 * Si phaseScore = EXCLUSION_SCORE → retorna EXCLUSION_SCORE (modelo técnicamente excluido).
 *
 * @param model   - Modelo con capabilities y metadata
 * @param phase   - Fase SDD V4 a evaluar
 * @param profile - Perfil del usuario
 * @returns ScoringResultV4 completo con finalScore calculado
 */
export function finalScore(
  model: ModelV4,
  phase: SddPhaseV4,
  profile: UserProfileV4
): ScoringResultV4 {
  // Calcular score de fase
  const phaseResult = calculatePhaseScore(model, phase);

  // Si fue excluido por reglas de fase → retornar inmediatamente
  if (phaseResult.excluded) {
    return {
      ...phaseResult,
      finalScore: EXCLUSION_SCORE,
      eligibilityScore: 0,
      excluded: true,
    };
  }

  // Calcular elegibilidad de perfil
  const eligibility = calculateEligibilityScore(model, profile);

  // Si inelegible por perfil → exclusión total
  if (eligibility === 0.0) {
    return {
      ...phaseResult,
      finalScore: EXCLUSION_SCORE,
      eligibilityScore: 0,
      excluded: true,
      exclusionReason:
        phaseResult.exclusionReason ??
        `profile-ineligible: model tier '${model.tier}' is not allowed in '${profile.profileId}' profile`,
    };
  }

  // Combinar: aptitud técnica (70%) + elegibilidad de perfil (30%)
  // eligibility está en [0,1], lo escalamos a [0,10] para compararlo con phase_score
  const combined =
    phaseResult.adjustedPhaseScore * 0.7 + eligibility * 10 * 0.3;

  return {
    ...phaseResult,
    finalScore: Math.min(10.0, Math.max(0.0, combined)),
    eligibilityScore: eligibility,
    excluded: false,
  };
}

// ─── 4. selectFallbackChain ────────────────────────────────────────────────────

/**
 * Selecciona el chain de fallback óptimo para una fase (top-4 con diversidad).
 *
 * Algoritmo (§9.1):
 * 1. Calcular finalScore para cada modelo
 * 2. Descartar modelos excluidos (score = EXCLUSION_SCORE)
 * 3. Descartar modelos por debajo del umbral mínimo de calidad
 * 4. Ordenar por score descendente
 * 5. Construir chain con restricción de diversidad de proveedores:
 *    - Al seleccionar el modelo siguiente, si ya hay modelos del mismo proveedor
 *      y aún no se alcanzaron 2 proveedores distintos, buscar alternativa de
 *      proveedor diferente dentro de una tolerancia de 1.5 puntos de score.
 *    - Si no hay alternativa dentro de la tolerancia, aceptar el mismo proveedor.
 *
 * @param models     - Lista de modelos elegibles a evaluar
 * @param phase      - Fase SDD V4
 * @param profile    - Perfil del usuario
 * @param chainSize  - Tamaño del chain deseado (default: 4)
 * @returns Array de ModelSlotV4 con position, role, score y modelo
 *
 * @example
 * const chain = selectFallbackChain(models, 'propose', premiumProfile);
 * // chain[0].role === 'primary'    → mejor modelo para la fase
 * // chain[1-3].role === 'fallback' → alternativas en orden de preferencia
 */
export function selectFallbackChain(
  models: ModelV4[],
  phase: SddPhaseV4,
  profile: UserProfileV4,
  chainSize: number = 4
): ModelSlotV4[] {
  const minQuality = PHASE_MIN_QUALITY_SCORES[phase];

  // ── Paso 1-3: Calcular scores y filtrar excluidos/debajo del umbral ───────
  const scoredModels: Array<{ model: ModelV4; result: ScoringResultV4 }> = [];

  for (const model of models) {
    const result = finalScore(model, phase, profile);

    // Descartar excluidos
    if (result.excluded || isExcluded(result.finalScore)) {
      continue;
    }

    // Descartar modelos por debajo del umbral mínimo de calidad
    // (emitirían warnings pero no se incluyen en el chain)
    if (result.finalScore < minQuality) {
      continue;
    }

    scoredModels.push({ model, result });
  }

  // ── Paso 4: Ordenar por score descendente ────────────────────────────────
  scoredModels.sort((a, b) => b.result.finalScore - a.result.finalScore);

  // ── Paso 5: Construir chain con diversidad de proveedores ────────────────
  //
  // Regla de diversidad (§6.2):
  //   min_providers_in_chain: 2
  //   prefer_providers_in_chain: 3
  //
  // Tolerancia de score: no sacrificamos más de 1.5 puntos de calidad
  // para obtener diversidad de proveedor.
  const selected: ModelSlotV4[] = [];
  const providersUsed = new Set<string>();

  for (const { model, result } of scoredModels) {
    if (selected.length >= chainSize) break;

    // Si aún necesitamos diversidad, buscar un proveedor diferente
    if (
      selected.length > 0 &&
      providersUsed.size < 2 &&
      providersUsed.has(model.provider)
    ) {
      // Buscar alternativa de proveedor diferente con tolerancia de 1.5 pts
      const currentScore = result.finalScore;
      const alternative = scoredModels.find(
        ({ model: altModel, result: altResult }) =>
          !providersUsed.has(altModel.provider) &&
          !selected.some((s) => s.model.modelId === altModel.modelId) &&
          Math.abs(altResult.finalScore - currentScore) <= 1.5
      );

      if (alternative) {
        // Usar la alternativa de proveedor diferente en lugar del modelo actual
        selected.push({
          position: selected.length + 1,
          role: selected.length === 0 ? "primary" : "fallback",
          score: alternative.result.finalScore,
          model: alternative.model,
          scoringResult: alternative.result,
        });
        providersUsed.add(alternative.model.provider);
        continue;
      }
      // Sin alternativa dentro de la tolerancia → aceptar el mismo proveedor
    }

    selected.push({
      position: selected.length + 1,
      role: selected.length === 0 ? "primary" : "fallback",
      score: result.finalScore,
      model,
      scoringResult: result,
    });
    providersUsed.add(model.provider);
  }

  return selected;
}

// ─── Exports de Utilidad ──────────────────────────────────────────────────────

export { EXCLUSION_SCORE, isExcluded } from "./special-rules";
export { PHASE_WEIGHTS, PHASE_SPECIAL_RULES, PHASE_MIN_QUALITY_SCORES } from "./phase-weights";
export type { SddPhaseV4, PhaseWeights, PhaseSpecialRuleConfig } from "./phase-weights";
export type { ModelForSpecialRules, SpecialRulesResult } from "./special-rules";
