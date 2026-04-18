// ─── Scoring Engine V4 — Unit Tests ──────────────────────────────────────────
//
// Tests para el motor de scoring V4 de 17 dimensiones.
// No requiere DB — todos los datos son mock determinísticos.
//
// Ejecución:
//   npx tsx lib/optimizer/v4/__tests__/scoring-engine-v4.test.ts
//
// Cobertura objetivo: >80% de las funciones públicas del engine.

import assert from "node:assert/strict";
import {
  calculatePhaseScore,
  finalScore,
  selectFallbackChain,
  calculateEligibilityScore,
  EXCLUSION_SCORE,
  isExcluded,
} from "../scoring-engine-v4";
import type { ModelV4, UserProfileV4 } from "../scoring-engine-v4";
import type { ModelCapabilitiesV4 } from "../scoring-engine-v4";
import { applySpecialRules } from "../special-rules";

// ─── Helpers / Factories ──────────────────────────────────────────────────────

/**
 * Crea capabilities sintéticas con todos los valores en el mismo nivel.
 * @param value - Score base para todas las 17 dimensiones (default: 7.0)
 */
function makeCapabilities(value = 7.0): ModelCapabilitiesV4 {
  return {
    modelId: "test/model",
    a1_overall_intelligence: value,
    a2_reasoning_depth: value,
    a3_instruction_following: value,
    a4_hallucination_resistance: value,
    b1_coding_quality: value,
    b2_coding_multilang: value,
    b3_context_window_score: value,
    b4_context_effective_score: value,
    b5_tool_calling_accuracy: value,
    b6_agentic_reliability: value,
    c1_visual_understanding: value,
    c2_format_adherence: value,
    c3_long_context_coherence: value,
    c4_architecture_awareness: value,
    d1_speed_score: value,
    d2_cost_score: value,
    d3_availability_score: value,
  };
}

/**
 * Crea un modelo V4 completo para testing.
 */
function makeModel(overrides: Partial<ModelV4> = {}): ModelV4 {
  return {
    modelId: "test/model",
    isThinkingModel: false,
    contextWindowTokens: 200_000,
    provider: "test-provider",
    tier: "PREMIUM",
    capabilities: makeCapabilities(7.0),
    ...overrides,
  };
}

/**
 * Perfil de usuario Premium permisivo para testing.
 */
const PREMIUM_PROFILE: UserProfileV4 = {
  profileId: "premium",
  allowedTiers: ["PREMIUM", "BALANCED", "ECONOMIC"],
  excludedTiers: [],
};

const ECONOMIC_PROFILE: UserProfileV4 = {
  profileId: "economic",
  allowedTiers: ["ECONOMIC"],
  excludedTiers: ["PREMIUM", "BALANCED"],
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

console.log("Running Scoring Engine V4 Unit Tests...\n");

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: calculatePhaseScore — thinking model en sdd-propose recibe bonus +1.5
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 1: calculatePhaseScore — thinking model en propose recibe bonus +1.5");
{
  const thinkingModel = makeModel({ isThinkingModel: true });
  const nonThinkingModel = makeModel({ isThinkingModel: false });

  const thinkingResult = calculatePhaseScore(thinkingModel, "propose");
  const nonThinkingResult = calculatePhaseScore(nonThinkingModel, "propose");

  // El thinking model debe haber recibido el bonus
  assert.ok(
    thinkingResult.specialRulesApplied.includes("prefer-thinking-bonus"),
    `Thinking model en propose debe recibir 'prefer-thinking-bonus', obtuvo: [${thinkingResult.specialRulesApplied.join(", ")}]`
  );

  // El non-thinking model debe haber recibido la penalización
  assert.ok(
    nonThinkingResult.specialRulesApplied.includes("penalty-for-non-thinking"),
    `Non-thinking model en propose debe recibir 'penalty-for-non-thinking', obtuvo: [${nonThinkingResult.specialRulesApplied.join(", ")}]`
  );

  // El score ajustado del thinking debe ser mayor que el del non-thinking
  assert.ok(
    thinkingResult.adjustedPhaseScore > nonThinkingResult.adjustedPhaseScore,
    `Thinking model score (${thinkingResult.adjustedPhaseScore}) debe ser mayor que non-thinking (${nonThinkingResult.adjustedPhaseScore})`
  );

  // La diferencia debe ser exactamente 3.0 (1.5 bonus + 1.5 penalty)
  const delta = thinkingResult.adjustedPhaseScore - nonThinkingResult.adjustedPhaseScore;
  assert.ok(
    Math.abs(delta - 3.0) < 0.0001,
    `Delta entre thinking y non-thinking en propose debe ser 3.0, obtuvo: ${delta.toFixed(4)}`
  );

  // El thinking model NO debe estar excluido
  assert.equal(thinkingResult.excluded, false, "Thinking model en propose NO debe ser excluido");

  console.log(`   ✓ thinking score: ${thinkingResult.adjustedPhaseScore.toFixed(4)} vs non-thinking: ${nonThinkingResult.adjustedPhaseScore.toFixed(4)} (delta: ${delta.toFixed(4)})`);
  console.log("✓ Test 1 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: calculatePhaseScore — thinking model en orchestrator debe ser EXCLUIDO
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 2: calculatePhaseScore — thinking model en orchestrator es excluido (-999)");
{
  // El orchestrator requiere contextWindowTokens >= 260_000
  // Usamos 300k para no tropezar con la regla de contexto mínimo
  const thinkingModel = makeModel({
    isThinkingModel: true,
    contextWindowTokens: 300_000,
  });

  const result = calculatePhaseScore(thinkingModel, "orchestrator");

  // Score debe ser EXCLUSION_SCORE (-999)
  assert.equal(
    result.excluded,
    true,
    `Thinking model en orchestrator debe estar excluido (excluded=true)`
  );
  assert.ok(
    isExcluded(result.adjustedPhaseScore),
    `adjustedPhaseScore debe ser EXCLUSION_SCORE, obtuvo: ${result.adjustedPhaseScore}`
  );
  assert.ok(
    result.exclusionReason !== undefined,
    "Debe existir un exclusionReason cuando se excluye"
  );
  assert.ok(
    result.exclusionReason!.includes("anti-thinking"),
    `exclusionReason debe mencionar 'anti-thinking', obtuvo: "${result.exclusionReason}"`
  );
  assert.ok(
    result.specialRulesApplied.includes("anti-thinking"),
    `specialRulesApplied debe incluir 'anti-thinking'`
  );

  console.log(`   ✓ excluded: ${result.excluded}, score: ${result.adjustedPhaseScore}, reason: "${result.exclusionReason?.substring(0, 60)}..."`);
  console.log("✓ Test 2 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: applySpecialRules — exclusión por contexto mínimo insuficiente
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 3: applySpecialRules — exclusión cuando contexto < min_context de la fase");
{
  // orchestrator requiere min 260_000 tokens
  const smallContextModel = {
    modelId: "test/small-context",
    isThinkingModel: false,
    contextWindowTokens: 128_000,  // Insuficiente para orchestrator (requiere 260k)
  };

  const result = applySpecialRules(smallContextModel, "orchestrator", 7.0);

  assert.ok(
    isExcluded(result.adjustedScore),
    `Modelo con contexto insuficiente debe retornar EXCLUSION_SCORE, obtuvo: ${result.adjustedScore}`
  );
  assert.ok(
    result.exclusionReason !== undefined,
    "Debe tener exclusionReason cuando contexto es insuficiente"
  );
  assert.ok(
    result.exclusionReason!.includes("min-context-window"),
    `exclusionReason debe mencionar 'min-context-window', obtuvo: "${result.exclusionReason}"`
  );
  assert.ok(
    result.appliedRules.includes("min-context-window"),
    `appliedRules debe incluir 'min-context-window'`
  );

  // Modelo con contexto suficiente no debe ser excluido
  const sufficientContextModel = {
    modelId: "test/large-context",
    isThinkingModel: false,
    contextWindowTokens: 300_000,
  };

  const okResult = applySpecialRules(sufficientContextModel, "orchestrator", 7.0);
  assert.ok(
    !isExcluded(okResult.adjustedScore),
    `Modelo con contexto suficiente NO debe ser excluido, score: ${okResult.adjustedScore}`
  );

  console.log(`   ✓ 128k tokens excluido con score ${result.adjustedScore}, 300k tokens OK con score ${okResult.adjustedScore.toFixed(4)}`);
  console.log("✓ Test 3 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: selectFallbackChain — diversidad de proveedores (min 2 proveedores)
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 4: selectFallbackChain — diversidad de proveedores en el chain");
{
  // Crear 4 modelos: 3 del mismo proveedor con score alto + 1 de proveedor diferente
  const modelsPool: ModelV4[] = [
    makeModel({
      modelId: "anthropic/claude-opus",
      provider: "anthropic",
      tier: "PREMIUM",
      capabilities: makeCapabilities(9.5),  // Score muy alto
    }),
    makeModel({
      modelId: "anthropic/claude-sonnet",
      provider: "anthropic",
      tier: "PREMIUM",
      capabilities: makeCapabilities(9.0),
    }),
    makeModel({
      modelId: "anthropic/claude-haiku",
      provider: "anthropic",
      tier: "PREMIUM",
      capabilities: makeCapabilities(8.5),
    }),
    makeModel({
      modelId: "google/gemini-pro",
      provider: "google",
      tier: "PREMIUM",
      capabilities: makeCapabilities(8.3),  // Score ligeramente menor pero proveedor diferente
    }),
  ];

  // Usar la fase "apply" que no excluye thinking models ni tiene restricción de contexto
  const chain = selectFallbackChain(modelsPool, "apply", PREMIUM_PROFILE, 4);

  // El chain debe tener al menos 2 slots
  assert.ok(chain.length >= 2, `Chain debe tener al menos 2 slots, obtuvo: ${chain.length}`);

  // Extraer proveedores únicos del chain
  const providersInChain = new Set(chain.map((slot) => slot.model.provider));

  // Debe haber al menos 2 proveedores diferentes
  assert.ok(
    providersInChain.size >= 2,
    `Chain debe tener al menos 2 proveedores diferentes. Obtuvo: [${[...providersInChain].join(", ")}]`
  );

  // El primer slot debe ser el modelo primary
  assert.equal(chain[0].role, "primary", "El primer slot debe ser 'primary'");
  assert.equal(chain[0].position, 1, "El primer slot debe estar en posición 1");

  // Los slots restantes deben ser fallbacks
  for (let i = 1; i < chain.length; i++) {
    assert.equal(chain[i].role, "fallback", `Slot ${i + 1} debe ser 'fallback'`);
    assert.equal(chain[i].position, i + 1, `Slot ${i + 1} debe estar en posición ${i + 1}`);
  }

  console.log(`   ✓ Chain generado con ${chain.length} slots, proveedores: [${[...providersInChain].join(", ")}]`);
  console.log("✓ Test 4 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: finalScore — combina aptitud (70%) + elegibilidad (30%)
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 5: finalScore — fórmula: phase_score×0.7 + (eligibility×10)×0.3");
{
  const model = makeModel({
    isThinkingModel: false,
    contextWindowTokens: 200_000,
    provider: "anthropic",
    tier: "PREMIUM",
    capabilities: makeCapabilities(7.0),  // Score uniforme para cálculo determinístico
  });

  const result = finalScore(model, "spec", PREMIUM_PROFILE);

  // No debe estar excluido
  assert.equal(result.excluded, false, "Modelo elegible no debe estar excluido");

  // El finalScore debe estar en [0, 10]
  assert.ok(
    result.finalScore >= 0 && result.finalScore <= 10,
    `finalScore debe estar en [0, 10], obtuvo: ${result.finalScore}`
  );

  // Verificar la fórmula manualmente
  // eligibilityScore para PREMIUM en perfil premium = 1.0 (tier index 0 de 3)
  const expectedEligibility = 1.0 - 0 / 3; // = 1.0
  assert.ok(
    Math.abs(result.eligibilityScore - expectedEligibility) < 0.001,
    `eligibilityScore debe ser ~${expectedEligibility}, obtuvo: ${result.eligibilityScore}`
  );

  // Verificar la combinación: phase_score × 0.7 + (eligibility × 10) × 0.3
  const expectedFinal = result.adjustedPhaseScore * 0.7 + result.eligibilityScore * 10 * 0.3;
  assert.ok(
    Math.abs(result.finalScore - Math.min(10, Math.max(0, expectedFinal))) < 0.001,
    `finalScore debe ser ${expectedFinal.toFixed(4)}, obtuvo: ${result.finalScore}`
  );

  console.log(`   ✓ adjustedPhaseScore: ${result.adjustedPhaseScore.toFixed(4)}, eligibility: ${result.eligibilityScore.toFixed(4)}, finalScore: ${result.finalScore.toFixed(4)}`);
  console.log("✓ Test 5 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: calculateEligibilityScore — exclusión cuando tier no está permitido
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 6: calculateEligibilityScore — tier excluido retorna 0.0");
{
  const premiumModel = makeModel({ tier: "PREMIUM" });

  // Perfil ECONOMIC excluye PREMIUM
  const score = calculateEligibilityScore(premiumModel, ECONOMIC_PROFILE);
  assert.equal(score, 0.0, `PREMIUM model en perfil economic-excludes-premium debe retornar 0.0, obtuvo: ${score}`);

  // Perfil PREMIUM permite PREMIUM
  const premiumScore = calculateEligibilityScore(premiumModel, PREMIUM_PROFILE);
  assert.ok(premiumScore > 0, `PREMIUM model en perfil premium debe retornar score > 0, obtuvo: ${premiumScore}`);
  assert.ok(premiumScore <= 1.0, `eligibilityScore debe ser ≤ 1.0, obtuvo: ${premiumScore}`);

  console.log(`   ✓ PREMIUM in ECONOMIC profile: ${score}, PREMIUM in PREMIUM profile: ${premiumScore.toFixed(4)}`);
  console.log("✓ Test 6 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: finalScore — modelo inelegible por perfil retorna EXCLUSION_SCORE
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 7: finalScore — modelo inelegible por perfil es excluido");
{
  const premiumModel = makeModel({ tier: "PREMIUM" });

  const result = finalScore(premiumModel, "spec", ECONOMIC_PROFILE);

  assert.equal(result.excluded, true, "Modelo PREMIUM en perfil exclusivamente ECONOMIC debe ser excluido");
  assert.ok(
    isExcluded(result.finalScore),
    `finalScore debe ser EXCLUSION_SCORE, obtuvo: ${result.finalScore}`
  );
  assert.ok(
    result.exclusionReason !== undefined && result.exclusionReason.includes("profile-ineligible"),
    `exclusionReason debe mencionar 'profile-ineligible', obtuvo: "${result.exclusionReason}"`
  );

  console.log(`   ✓ excluded: ${result.excluded}, reason: "${result.exclusionReason?.substring(0, 60)}..."`);
  console.log("✓ Test 7 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 8: Base score — suma ponderada produce valor determinístico
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 8: calculatePhaseScore — base score es determinístico con capabilities uniformes");
{
  // Con capabilities uniformes = value en todas las dimensiones,
  // la suma ponderada normalizada DEBE ser exactamente = value
  // (porque la normalización Σ(v×w)/Σ(w) con v constante = v)
  const uniformValue = 6.5;
  const model = makeModel({
    isThinkingModel: false,
    contextWindowTokens: 200_000,
    capabilities: { ...makeCapabilities(uniformValue), modelId: "test/uniform" },
  });

  // Usar "spec" que no tiene reglas especiales de thinking ni contexto
  const result = calculatePhaseScore(model, "spec");

  assert.ok(
    Math.abs(result.baseScore - uniformValue) < 0.0001,
    `baseScore con capabilities uniformes = ${uniformValue} debe ser exactamente ${uniformValue}, obtuvo: ${result.baseScore}`
  );

  // Score debe estar en rango [0, 10]
  assert.ok(
    result.baseScore >= 0 && result.baseScore <= 10,
    `baseScore debe estar en [0, 10], obtuvo: ${result.baseScore}`
  );

  console.log(`   ✓ uniform capabilities ${uniformValue} → baseScore: ${result.baseScore.toFixed(4)}`);
  console.log("✓ Test 8 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 9: Modelo excluido en tasks (anti-thinking)
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 9: calculatePhaseScore — thinking model en tasks es excluido");
{
  const thinkingModel = makeModel({ isThinkingModel: true });
  const result = calculatePhaseScore(thinkingModel, "tasks");

  assert.equal(result.excluded, true, "Thinking model en tasks debe ser excluido");
  assert.ok(isExcluded(result.adjustedPhaseScore), "adjustedPhaseScore debe ser EXCLUSION_SCORE");
  assert.ok(
    result.exclusionReason!.includes("anti-thinking"),
    `exclusionReason debe mencionar 'anti-thinking': "${result.exclusionReason}"`
  );

  console.log(`   ✓ thinking model en tasks: excluded=${result.excluded}, score=${result.adjustedPhaseScore}`);
  console.log("✓ Test 9 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 10: Modelo excluido en archive (anti-thinking)
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 10: calculatePhaseScore — thinking model en archive es excluido");
{
  const thinkingModel = makeModel({ isThinkingModel: true });
  const result = calculatePhaseScore(thinkingModel, "archive");

  assert.equal(result.excluded, true, "Thinking model en archive debe ser excluido");
  assert.ok(isExcluded(result.adjustedPhaseScore), "adjustedPhaseScore debe ser EXCLUSION_SCORE");

  console.log(`   ✓ thinking model en archive: excluded=${result.excluded}`);
  console.log("✓ Test 10 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 11: explore y verify — thinking model recibe bonus
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 11: thinking model en explore y verify recibe bonus +1.5");
{
  for (const phase of ["explore", "verify"] as const) {
    const thinking = makeModel({ isThinkingModel: true, contextWindowTokens: 300_000 });
    const nonThinking = makeModel({ isThinkingModel: false, contextWindowTokens: 300_000 });

    const thinkingResult = calculatePhaseScore(thinking, phase);
    const nonThinkingResult = calculatePhaseScore(nonThinking, phase);

    assert.ok(
      !thinkingResult.excluded,
      `Thinking model en ${phase} NO debe ser excluido`
    );
    assert.ok(
      thinkingResult.specialRulesApplied.includes("prefer-thinking-bonus"),
      `Thinking model en ${phase} debe recibir bonus`
    );
    assert.ok(
      thinkingResult.adjustedPhaseScore > nonThinkingResult.adjustedPhaseScore,
      `Thinking model (${thinkingResult.adjustedPhaseScore.toFixed(4)}) debe superar non-thinking (${nonThinkingResult.adjustedPhaseScore.toFixed(4)}) en ${phase}`
    );

    console.log(`   ✓ ${phase}: thinking ${thinkingResult.adjustedPhaseScore.toFixed(4)} > non-thinking ${nonThinkingResult.adjustedPhaseScore.toFixed(4)}`);
  }
  console.log("✓ Test 11 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 12: scoreBreakdown — contiene las 17 dimensiones correctamente
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 12: scoreBreakdown contiene las 17 dimensiones con datos correctos");
{
  const model = makeModel({ isThinkingModel: false, capabilities: makeCapabilities(5.0) });
  const result = calculatePhaseScore(model, "design");

  const expectedDimensions = [
    "a1_overall_intelligence", "a2_reasoning_depth", "a3_instruction_following", "a4_hallucination_resistance",
    "b1_coding_quality", "b2_coding_multilang", "b3_context_window_score", "b4_context_effective_score",
    "b5_tool_calling_accuracy", "b6_agentic_reliability",
    "c1_visual_understanding", "c2_format_adherence", "c3_long_context_coherence", "c4_architecture_awareness",
    "d1_speed_score", "d2_cost_score", "d3_availability_score",
  ];

  assert.equal(
    Object.keys(result.scoreBreakdown).length,
    17,
    `scoreBreakdown debe tener 17 dimensiones, obtuvo: ${Object.keys(result.scoreBreakdown).length}`
  );

  for (const dim of expectedDimensions) {
    const entry = result.scoreBreakdown[dim as keyof typeof result.scoreBreakdown];
    assert.ok(entry !== undefined, `Dimensión '${dim}' debe existir en scoreBreakdown`);
    assert.equal(entry.raw, 5.0, `raw de '${dim}' debe ser 5.0`);
    assert.ok(entry.weight >= 0, `weight de '${dim}' debe ser >= 0`);
    // contribution = raw × weight
    assert.ok(
      Math.abs(entry.contribution - entry.raw * entry.weight) < 0.0001,
      `contribution de '${dim}' debe ser raw×weight`
    );
  }

  console.log(`   ✓ scoreBreakdown tiene ${Object.keys(result.scoreBreakdown).length} dimensiones`);
  console.log("✓ Test 12 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 13: selectFallbackChain — modelos excluidos no aparecen en el chain
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 13: selectFallbackChain — modelos excluidos son descartados");
{
  // Un thinking model en tasks debe ser completamente descartado del chain
  const models: ModelV4[] = [
    makeModel({
      modelId: "thinking/excluded",
      provider: "anthropic",
      tier: "PREMIUM",
      isThinkingModel: true,            // ← va a ser excluido en tasks
      capabilities: makeCapabilities(9.9),  // Score muy alto pero excluido
    }),
    makeModel({
      modelId: "normal/model-a",
      provider: "openai",
      tier: "PREMIUM",
      isThinkingModel: false,
      capabilities: makeCapabilities(7.0),
    }),
    makeModel({
      modelId: "normal/model-b",
      provider: "google",
      tier: "PREMIUM",
      isThinkingModel: false,
      capabilities: makeCapabilities(6.5),
    }),
  ];

  const chain = selectFallbackChain(models, "tasks", PREMIUM_PROFILE, 4);

  // El thinking model NO debe aparecer en el chain
  const chainModelIds = chain.map((s) => s.model.modelId);
  assert.ok(
    !chainModelIds.includes("thinking/excluded"),
    `Thinking model excluido NO debe aparecer en el chain de tasks. Chain: [${chainModelIds.join(", ")}]`
  );

  // Los modelos normales sí deben aparecer
  assert.ok(chain.length > 0, "El chain debe contener al menos un modelo válido");

  console.log(`   ✓ Chain en tasks: [${chainModelIds.join(", ")}] (thinking excluido correctamente)`);
  console.log("✓ Test 13 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 14: isExcluded helper
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 14: isExcluded helper funciona correctamente");
{
  assert.equal(isExcluded(EXCLUSION_SCORE), true, "EXCLUSION_SCORE debe retornar true");
  assert.equal(isExcluded(-1000), true, "Score < EXCLUSION_SCORE debe retornar true");
  assert.equal(isExcluded(0), false, "Score 0 NO es exclusión");
  assert.equal(isExcluded(5.5), false, "Score positivo NO es exclusión");
  assert.equal(isExcluded(10), false, "Score 10 NO es exclusión");

  console.log(`   ✓ EXCLUSION_SCORE = ${EXCLUSION_SCORE}`);
  console.log("✓ Test 14 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 15: Scores finales siempre en rango [0, 10]
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 15: Scores finales siempre en rango [0, 10] para todos los modelos");
{
  const phases = ["orchestrator", "init", "explore", "propose", "spec", "design", "tasks", "apply", "verify", "archive", "onboard"] as const;

  let testedCombinations = 0;

  for (const phase of phases) {
    const nonThinking = makeModel({
      isThinkingModel: false,
      contextWindowTokens: 300_000,
      capabilities: makeCapabilities(7.5),
    });

    const result = finalScore(nonThinking, phase, PREMIUM_PROFILE);

    if (!result.excluded) {
      assert.ok(
        result.finalScore >= 0 && result.finalScore <= 10,
        `finalScore en ${phase} debe estar en [0, 10], obtuvo: ${result.finalScore}`
      );
      testedCombinations++;
    }
  }

  console.log(`   ✓ ${testedCombinations} combinaciones verificadas con scores en [0, 10]`);
  console.log("✓ Test 15 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen
// ─────────────────────────────────────────────────────────────────────────────

console.log("═".repeat(60));
console.log("✅ ALL 15 SCORING ENGINE V4 TESTS PASSED");
console.log("═".repeat(60));
