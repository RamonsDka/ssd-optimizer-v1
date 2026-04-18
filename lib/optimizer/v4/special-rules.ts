// ─── Special Rules V4 — Bonuses, Penalties y Exclusiones ────────────────────
//
// Implementa las reglas especiales que se aplican DESPUÉS del cálculo base
// de la suma ponderada. Estas reglas ajustan el score final según:
//
//   1. Anti-thinking: excluye modelos thinking en fases triviales
//      (orchestrator, tasks, archive) donde su latencia no aporta valor.
//
//   2. Prefer-thinking: premia modelos thinking en fases de razonamiento
//      profundo (explore, propose, verify) y penaliza a los no-thinking.
//
//   3. Contexto mínimo: excluye modelos que no cumplen el mínimo de tokens
//      requerido para la fase (orchestrator, init, onboard).
//
// Diseño: middleware-like desacoplado, para mantener el cálculo base simple
// y testeable por separado. Ver §8.1 del SDD-MODEL-SELECTION-ENGINE.md.

import { PHASE_SPECIAL_RULES, type SddPhaseV4 } from "./phase-weights";

// ─── Constante de Exclusión ───────────────────────────────────────────────────

/**
 * Valor de retorno que indica exclusión total del modelo para la fase.
 * Cualquier score ≤ EXCLUSION_SCORE se interpreta como "no elegible".
 */
export const EXCLUSION_SCORE = -999;

// ─── Tipos ────────────────────────────────────────────────────────────────────

/**
 * Modelo mínimo requerido por las reglas especiales.
 * Contiene solo los campos que las reglas necesitan evaluar.
 */
export interface ModelForSpecialRules {
  /** Identificador canónico del modelo (e.g. "anthropic/claude-sonnet-4-6") */
  modelId: string;

  /**
   * true si el modelo usa extended thinking / chain-of-thought interno.
   * Ejemplos: DeepSeek R1, Claude con thinking mode, o1/o3, QwQ, Magistral
   */
  isThinkingModel: boolean;

  /**
   * Ventana de contexto declarada por el proveedor (tokens nominales).
   * Se usa para validar el mínimo requerido por la fase.
   */
  contextWindowTokens: number;
}

/**
 * Resultado de aplicar las reglas especiales a un modelo.
 */
export interface SpecialRulesResult {
  /**
   * Score ajustado tras aplicar todas las reglas.
   * Si es EXCLUSION_SCORE (-999), el modelo debe ser completamente descartado.
   */
  adjustedScore: number;

  /**
   * Nombres de las reglas que fueron aplicadas (para transparencia y debugging).
   */
  appliedRules: string[];

  /**
   * Si el modelo fue excluido, contiene el motivo de exclusión.
   * undefined cuando el modelo no fue excluido.
   */
  exclusionReason?: string;
}

// ─── Implementación de Reglas ─────────────────────────────────────────────────

/**
 * Aplica todas las reglas especiales de una fase a un modelo dado.
 *
 * Flujo de evaluación (las reglas de exclusión se evalúan primero):
 *
 * 1. ANTI-THINKING (exclusión): Si la fase excluye thinking models y el modelo
 *    es thinking → retornar EXCLUSION_SCORE inmediatamente.
 *
 * 2. CONTEXTO MÍNIMO (exclusión): Si el modelo no cumple el mínimo de contexto
 *    requerido por la fase → retornar EXCLUSION_SCORE inmediatamente.
 *
 * 3. PREFER-THINKING BONUS: Si la fase premia thinking models y el modelo ES
 *    thinking → sumar el thinkingBonus al score base.
 *
 * 4. PENALTY-FOR-NON-THINKING: Si la fase premia thinking models y el modelo
 *    NO ES thinking → sumar penaltyForNonThinking (valor negativo).
 *
 * @param model     - Modelo a evaluar (campos relevantes para las reglas)
 * @param phase     - Fase SDD V4 para la que se calculan las reglas
 * @param baseScore - Score base calculado por la suma ponderada (0.0-10.0)
 * @returns SpecialRulesResult con score ajustado, reglas aplicadas y motivo de exclusión
 *
 * @example
 * // Modelo thinking en fase "tasks" → exclusión
 * const result = applySpecialRules(
 *   { modelId: 'deepseek/r1', isThinkingModel: true, contextWindowTokens: 128000 },
 *   'tasks',
 *   7.5
 * );
 * // result.adjustedScore === -999
 * // result.exclusionReason === 'anti-thinking: thinking model excluded from tasks phase'
 *
 * @example
 * // Modelo thinking en fase "explore" → bonus
 * const result = applySpecialRules(
 *   { modelId: 'deepseek/r1', isThinkingModel: true, contextWindowTokens: 128000 },
 *   'explore',
 *   7.0
 * );
 * // result.adjustedScore === 8.5  (7.0 + 1.5 bonus)
 * // result.appliedRules includes 'prefer-thinking-bonus'
 */
export function applySpecialRules(
  model: ModelForSpecialRules,
  phase: SddPhaseV4,
  baseScore: number
): SpecialRulesResult {
  const rules = PHASE_SPECIAL_RULES[phase];
  const appliedRules: string[] = [];
  let currentScore = baseScore;

  // ── Regla 1: Anti-thinking (exclusión estricta) ───────────────────────────
  //
  // Fases donde el extended thinking solo agrega latencia y costo sin beneficio:
  //   - orchestrator: tarea de ruteo, velocidad > profundidad
  //   - tasks: partición mecánica de una lista, no requiere razonamiento
  //   - archive: compresión de logs, la tarea más trivial del pipeline
  //
  // Fuente: §7.7 REGLA_ESPECIAL—ANTI_THINKING_HARD, §7.10 REGLA ESPECIAL
  if (rules.excludeThinkingModels && model.isThinkingModel) {
    return {
      adjustedScore: EXCLUSION_SCORE,
      appliedRules: ["anti-thinking"],
      exclusionReason: `anti-thinking: thinking model excluded from '${phase}' phase (extended thinking adds latency without benefit for trivial tasks)`,
    };
  }

  // ── Regla 2: Contexto mínimo (exclusión estricta) ─────────────────────────
  //
  // Si el modelo no tiene suficiente contexto para la fase, es completamente inútil
  // sin importar cuán bueno sea en otras dimensiones.
  //
  // Valores mínimos por fase:
  //   - orchestrator: 260K tokens (historial completo de sesión SDD)
  //   - init: 32K tokens (proyecto mínimo viable)
  //   - onboard: 32K tokens (documentación completa)
  //
  // Fuente: §7.1 REGLA_ESPECIAL—CONTEXTO_MÍNIMO, §7.2 REGLA_ESPECIAL—CONTEXTO_MÍNIMO
  if (
    rules.minContextWindowTokens !== undefined &&
    model.contextWindowTokens < rules.minContextWindowTokens
  ) {
    return {
      adjustedScore: EXCLUSION_SCORE,
      appliedRules: ["min-context-window"],
      exclusionReason: `min-context-window: model has ${model.contextWindowTokens.toLocaleString()} tokens but '${phase}' requires minimum ${rules.minContextWindowTokens.toLocaleString()} tokens`,
    };
  }

  // ── Regla 3: Prefer-thinking BONUS ───────────────────────────────────────
  //
  // Fases donde el extended thinking genera un resultado significativamente mejor:
  //   - explore: razonamiento causal encadenado, análisis de dependencias
  //   - propose: evaluación de trade-offs arquitectónicos
  //   - verify: análisis crítico de correctitud del código
  //
  // Los modelos thinking generan cadenas de razonamiento internas antes de
  // responder, lo cual es exactamente lo que estas fases necesitan.
  //
  // Fuente: §7.3 REGLA_ESPECIAL—PREFER_THINKING_MODELS,
  //         §7.4 REGLA_ESPECIAL—PREFER_THINKING_MODELS,
  //         §7.9 REGLA_ESPECIAL—PREFER_THINKING_MODELS
  if (rules.preferThinkingModels && model.isThinkingModel) {
    const bonus = rules.thinkingBonus ?? 1.5;
    currentScore += bonus;
    appliedRules.push("prefer-thinking-bonus");
  }

  // ── Regla 4: Penalty-for-non-thinking ────────────────────────────────────
  //
  // En las mismas fases donde thinking models reciben bonus, los modelos sin
  // extended thinking reciben una penalización. El delta total entre un thinking
  // y un non-thinking model es de 3.0 puntos (1.5 bonus vs -1.5 penalty).
  //
  // Esto asegura que thinking models sean consistentemente preferidos en estas
  // fases críticas, sin excluir completamente a los non-thinking (que siguen
  // siendo candidatos válidos como fallbacks).
  //
  // Fuente: §7.3 penalty_for_non_thinking: -1.5
  if (rules.preferThinkingModels && !model.isThinkingModel) {
    const penalty = rules.penaltyForNonThinking ?? -1.5;
    currentScore += penalty;   // penalty ya es negativo
    appliedRules.push("penalty-for-non-thinking");
  }

  return {
    adjustedScore: currentScore,
    appliedRules,
    exclusionReason: undefined,
  };
}

// ─── Helpers de Diagnóstico ───────────────────────────────────────────────────

/**
 * Verifica si un score representa una exclusión total.
 * Helper para usar en conditionals sin hardcodear el magic number.
 */
export function isExcluded(score: number): boolean {
  return score <= EXCLUSION_SCORE;
}

/**
 * Retorna un listado human-readable de las reglas activas para una fase.
 * Útil para debugging y para el UI de transparencia.
 *
 * @param phase - Fase SDD V4 a inspeccionar
 */
export function describePhaseRules(phase: SddPhaseV4): string[] {
  const rules = PHASE_SPECIAL_RULES[phase];
  const descriptions: string[] = [];

  if (rules.excludeThinkingModels) {
    descriptions.push("⚡ Anti-thinking: thinking models are EXCLUDED (latency overhead for trivial task)");
  }
  if (rules.preferThinkingModels) {
    const bonus = rules.thinkingBonus ?? 1.5;
    const penalty = rules.penaltyForNonThinking ?? -1.5;
    descriptions.push(`🧠 Prefer-thinking: +${bonus} bonus for thinking models, ${penalty} penalty for non-thinking`);
  }
  if (rules.minContextWindowTokens) {
    descriptions.push(`📏 Min context window: ${rules.minContextWindowTokens.toLocaleString()} tokens required`);
  }
  if (rules.minQualityThreshold) {
    descriptions.push(`📊 Min quality threshold: ${rules.minQualityThreshold}/10`);
  }

  return descriptions;
}
