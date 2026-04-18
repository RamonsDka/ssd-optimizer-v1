// ─── Selector V4 — Integration Tests ─────────────────────────────────────────
//
// Tests de integración para el selector cuando usa el motor V4.
//
// Estrategia:
//   - No se accede a la BD — todo se moquea a nivel de V4ScoringCache.
//   - Se testa la lógica del selector: routing de versión, fallback, métricas.
//   - Compatible con el patrón de tests existente (node:assert, tsx).
//
// Ejecución:
//   npx tsx lib/optimizer/__tests__/selector-v4.test.ts

import assert from "node:assert/strict";
import {
  scoreModel,
  getScoringVersion,
  computeV4Coverage,
  buildModelV4,
  toV4Phase,
} from "../selector";
import type {
  ScoringConfig,
  V4ScoringCache,
  V4ModelCacheEntry,
  V4CoverageMetrics,
} from "../selector";
import type { ModelCapabilitiesV4 } from "../v4/scoring-engine-v4";
import type { ModelRecord, Tier } from "@/types";
import { NULL_DIMENSION_FALLBACK } from "../scoring-engine-v3";

// ─── Re-export de funciones internas para testing ─────────────────────────────
// Las funciones buildModelV4, toV4Phase y computeV4Coverage son internas del
// selector. Las accedemos a través de la exportación indirecta del módulo.
// Si no están exportadas, las testeamos a través de scoreModel().

// ─── Helpers de Mock ──────────────────────────────────────────────────────────

/**
 * Crea un ModelRecord mínimo para los tests del selector.
 */
function createModelRecord(overrides: Partial<ModelRecord> = {}): ModelRecord {
  return {
    id: "test/model",
    name: "Test Model",
    providerId: "anthropic",
    tier: "PREMIUM" as Tier,
    contextWindow: 200_000,
    costPer1M: 3.0,
    strengths: ["reasoning", "coding"],
    discoveredByAI: false,
    lastSyncedAt: new Date(),
    ...overrides,
  };
}

/**
 * Crea capabilities V4 completas para testing.
 * Todos los valores en el mismo nivel para resultados predecibles.
 */
function createCapabilities(value = 7.0, modelId = "test/model"): ModelCapabilitiesV4 {
  return {
    modelId,
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
 * Crea una entrada de cache V4 con datos completos (no fallback).
 */
function createV4CacheEntry(
  capabilities: ModelCapabilitiesV4,
  usesV3Fallback = false
): V4ModelCacheEntry {
  return {
    capabilities: usesV3Fallback ? null : capabilities,
    v3Fallback: new Map(),
    usesV3Fallback,
  };
}

/**
 * Crea una entrada de cache V4 en modo fallback V3 con score predefinido.
 */
function createV3FallbackEntry(
  modelId: string,
  phase: string,
  v3Score: number
): V4ModelCacheEntry {
  const v3Fallback = new Map();
  v3Fallback.set(`${modelId}::${phase}`, {
    rawScore: v3Score,
    decayedScore: v3Score,
    finalScore: v3Score,
    decayFactor: 1.0,
    ciBonus: 0,
    dimensionCoverage: 5,
    usedFallback: false,
  });
  return {
    capabilities: null,
    v3Fallback,
    usesV3Fallback: true,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log("Running Selector V4 Integration Tests...\n");

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: getScoringVersion — lee la variable de entorno correctamente
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 1: getScoringVersion lee SCORING_VERSION del entorno");
{
  const originalEnv = process.env.SCORING_VERSION;

  // Sin env var → default "v2"
  delete process.env.SCORING_VERSION;
  assert.equal(getScoringVersion(), "v2", "Sin SCORING_VERSION, debe retornar 'v2'");

  // v4
  process.env.SCORING_VERSION = "v4";
  assert.equal(getScoringVersion(), "v4", "SCORING_VERSION=v4 debe retornar 'v4'");

  // v3
  process.env.SCORING_VERSION = "v3";
  assert.equal(getScoringVersion(), "v3", "SCORING_VERSION=v3 debe retornar 'v3'");

  // Valor inválido → fallback "v2"
  process.env.SCORING_VERSION = "invalid";
  assert.equal(getScoringVersion(), "v2", "Valor inválido debe fallback a 'v2'");

  // Case insensitive
  process.env.SCORING_VERSION = "V4";
  assert.equal(getScoringVersion(), "v4", "SCORING_VERSION=V4 (uppercase) debe retornar 'v4'");

  // Restaurar entorno
  if (originalEnv !== undefined) {
    process.env.SCORING_VERSION = originalEnv;
  } else {
    delete process.env.SCORING_VERSION;
  }

  console.log("✓ Test 1 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: scoreModel con V4 — usa engine V4 cuando hay capabilities
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 2: scoreModel con V4 — usa el engine V4 con capabilities completas");
{
  const modelId = "anthropic/test-model";
  const model = createModelRecord({ id: modelId, tier: "PREMIUM" });
  const caps = createCapabilities(8.0, modelId);

  const v4Cache: V4ScoringCache = new Map();
  v4Cache.set(modelId, createV4CacheEntry(caps, false));

  const config: ScoringConfig = { version: "v4", v4Cache };

  // Usar una fase que no excluye ningún modelo y no requiere thinking
  const score = scoreModel(model, "sdd-spec", config, "PREMIUM");

  // El score debe estar normalizado en [0, 1]
  assert.ok(score >= 0 && score <= 1, `Score V4 debe estar en [0, 1], obtuvo: ${score}`);
  // Con capabilities altas (8.0), el score debe ser positivo y sustancial
  assert.ok(score > 0.5, `Score V4 con capabilities=8.0 debe ser > 0.5, obtuvo: ${score}`);

  console.log(`   ✓ scoreModel V4 para 'sdd-spec': ${score.toFixed(4)}`);
  console.log("✓ Test 2 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: scoreModel con V4 — fallback a V3 cuando no hay capabilities
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 3: scoreModel V4 fallback a V3 cuando modelo no tiene ModelCapabilities");
{
  const modelId = "unknown/no-v4-data";
  const model = createModelRecord({ id: modelId });
  const v3Score = 0.72;

  const v4Cache: V4ScoringCache = new Map();
  v4Cache.set(modelId, createV3FallbackEntry(modelId, "sdd-spec", v3Score));

  const config: ScoringConfig = { version: "v4", v4Cache };

  // Suprimir console.warn durante el test
  const warnOriginal = console.warn;
  const warnMessages: string[] = [];
  console.warn = (...args: unknown[]) => warnMessages.push(args.map(String).join(" "));

  const score = scoreModel(model, "sdd-spec", config, "PREMIUM");

  // Restaurar console.warn
  console.warn = warnOriginal;

  // El score debe ser el del V3 fallback
  assert.ok(
    Math.abs(score - v3Score) < 0.001,
    `Fallback V3 score debe ser ${v3Score}, obtuvo: ${score}`
  );

  // Debe haber loggeado el warning de fallback
  const hasV3FallbackWarning = warnMessages.some(
    (msg) => msg.includes("V4 fallback") && msg.includes("V3") && msg.includes(modelId)
  );
  assert.ok(hasV3FallbackWarning, `Debe loggearse warning de V4→V3 fallback. Mensajes: ${warnMessages.join(" | ")}`);

  console.log(`   ✓ Fallback V3 score: ${score}, warning loggeado: ${hasV3FallbackWarning}`);
  console.log("✓ Test 3 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: scoreModel con V4 — cache miss usa neutral fallback
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 4: scoreModel V4 cache miss retorna neutral fallback score");
{
  const modelId = "completely/unknown-model";
  const model = createModelRecord({ id: modelId });

  // Cache vacío — el modelo no tiene ninguna entrada
  const v4Cache: V4ScoringCache = new Map();
  const config: ScoringConfig = { version: "v4", v4Cache };

  // Suprimir console.warn durante el test
  const warnOriginal = console.warn;
  const warnMessages: string[] = [];
  console.warn = (...args: unknown[]) => warnMessages.push(args.map(String).join(" "));

  const score = scoreModel(model, "sdd-apply", config, "PREMIUM");

  // Restaurar console.warn
  console.warn = warnOriginal;

  // Debe retornar el NULL_DIMENSION_FALLBACK = 0.60
  assert.ok(
    Math.abs(score - NULL_DIMENSION_FALLBACK) < 0.001,
    `Cache miss debe retornar NULL_DIMENSION_FALLBACK (${NULL_DIMENSION_FALLBACK}), obtuvo: ${score}`
  );

  // Debe haber loggeado warning de cache miss
  const hasCacheMissWarning = warnMessages.some(
    (msg) => msg.includes("cache miss") || msg.includes(modelId)
  );
  assert.ok(hasCacheMissWarning, `Debe loggearse warning de cache miss. Mensajes: ${warnMessages.join(" | ")}`);

  console.log(`   ✓ Cache miss score: ${score} (= NULL_DIMENSION_FALLBACK: ${NULL_DIMENSION_FALLBACK})`);
  console.log("✓ Test 4 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: computeV4Coverage — métricas correctas de cobertura
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 5: computeV4Coverage — métricas de cobertura calculadas correctamente");
{
  const v4Cache: V4ScoringCache = new Map();

  // 3 modelos con datos V4 completos
  for (let i = 0; i < 3; i++) {
    const caps = createCapabilities(7.0, `provider/model-${i}`);
    v4Cache.set(`provider/model-${i}`, createV4CacheEntry(caps, false));
  }

  // 1 modelo usando V3 fallback
  v4Cache.set("fallback/model", createV3FallbackEntry("fallback/model", "sdd-apply", 0.6));

  const metrics: V4CoverageMetrics = computeV4Coverage(v4Cache);

  assert.equal(metrics.totalModels, 4, `totalModels debe ser 4, obtuvo: ${metrics.totalModels}`);
  assert.equal(metrics.modelsWithV4Data, 3, `modelsWithV4Data debe ser 3, obtuvo: ${metrics.modelsWithV4Data}`);
  assert.equal(metrics.modelsUsingV3Fallback, 1, `modelsUsingV3Fallback debe ser 1, obtuvo: ${metrics.modelsUsingV3Fallback}`);
  assert.equal(metrics.v4CoveragePercent, 75, `v4CoveragePercent debe ser 75%, obtuvo: ${metrics.v4CoveragePercent}`);

  console.log(`   ✓ Coverage: ${metrics.modelsWithV4Data}/${metrics.totalModels} (${metrics.v4CoveragePercent}%) V4, ${metrics.modelsUsingV3Fallback} V3 fallback`);
  console.log("✓ Test 5 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: computeV4Coverage — cache vacío
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 6: computeV4Coverage — cache vacío retorna 0% coverage");
{
  const emptyCache: V4ScoringCache = new Map();
  const metrics = computeV4Coverage(emptyCache);

  assert.equal(metrics.totalModels, 0);
  assert.equal(metrics.modelsWithV4Data, 0);
  assert.equal(metrics.modelsUsingV3Fallback, 0);
  assert.equal(metrics.v4CoveragePercent, 0, "Cache vacío debe retornar 0% coverage");

  console.log(`   ✓ Cache vacío → 0% coverage`);
  console.log("✓ Test 6 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: toV4Phase — mapeo de fases sdd- a V4
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 7: toV4Phase — mapeo correcto de fases SDD al formato V4");
{
  const mappings: Array<[string, string]> = [
    ["sdd-explore", "explore"],
    ["sdd-propose", "propose"],
    ["sdd-spec", "spec"],
    ["sdd-design", "design"],
    ["sdd-tasks", "tasks"],
    ["sdd-apply", "apply"],
    ["sdd-verify", "verify"],
    ["sdd-archive", "archive"],
    ["sdd-init", "init"],
    ["sdd-onboard", "onboard"],
    // Short names pass-through
    ["explore", "explore"],
    ["propose", "propose"],
    ["orchestrator", "orchestrator"],
    // Unknown → "apply" (safe default)
    ["custom-unknown-phase", "apply"],
  ];

  for (const [input, expected] of mappings) {
    const result = toV4Phase(input);
    assert.equal(result, expected, `toV4Phase("${input}") debe retornar "${expected}", obtuvo: "${result}"`);
  }

  console.log(`   ✓ ${mappings.length} mappings de fases verificados`);
  console.log("✓ Test 7 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 8: buildModelV4 — detecta thinking models por heurística del ID
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 8: buildModelV4 — heurística de detección de thinking models");
{
  const caps = createCapabilities(7.0, "test/model");

  const thinkingCases = [
    { id: "openai/o1", name: "GPT o1", expectThinking: true },
    { id: "openai/o3", name: "GPT o3", expectThinking: true },
    { id: "openai/o4-mini", name: "o4-mini", expectThinking: true },
    { id: "deepseek/deepseek-r1", name: "DeepSeek R1", expectThinking: true },
    { id: "mistral/magistral-small", name: "Magistral Small", expectThinking: true },
    { id: "alibaba/qwq-32b", name: "QwQ 32B", expectThinking: true },
    { id: "anthropic/claude-3-7-sonnet-thinking", name: "Claude Thinking", expectThinking: true },
    // Non-thinking models
    { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet", expectThinking: false },
    { id: "google/gemini-2.0-flash", name: "Gemini Flash", expectThinking: false },
    { id: "openai/gpt-4o", name: "GPT-4o", expectThinking: false },
  ];

  for (const { id, name, expectThinking } of thinkingCases) {
    const modelRecord = createModelRecord({ id, name });
    const modelV4 = buildModelV4(modelRecord, { ...caps, modelId: id });

    assert.equal(
      modelV4.isThinkingModel,
      expectThinking,
      `buildModelV4("${id}") → isThinkingModel debe ser ${expectThinking}`
    );
  }

  console.log(`   ✓ ${thinkingCases.length} casos de detección de thinking models verificados`);
  console.log("✓ Test 8 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 9: scoreModel V4 — thinking model excluido retorna 0 (no negativo)
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 9: scoreModel V4 — thinking model excluido en tasks retorna score 0 (no negativo)");
{
  // El thinking model detectado por heurística debe ser excluido en "tasks"
  const modelId = "deepseek/deepseek-r1";
  const model = createModelRecord({ id: modelId, name: "DeepSeek R1", tier: "PREMIUM" });
  const caps = createCapabilities(9.5, modelId);  // Capabilities excelentes pero...

  const v4Cache: V4ScoringCache = new Map();
  v4Cache.set(modelId, createV4CacheEntry(caps, false));

  const config: ScoringConfig = { version: "v4", v4Cache };

  const score = scoreModel(model, "sdd-tasks", config, "PREMIUM");

  // El score debe ser 0 (excluido → 0, no negativo)
  assert.equal(score, 0, `Thinking model excluido en tasks debe retornar score=0, obtuvo: ${score}`);

  console.log(`   ✓ DeepSeek R1 en sdd-tasks (excluido): score=${score}`);
  console.log("✓ Test 9 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 10: scoreModel V4 — score normalizado en [0, 1]
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 10: scoreModel V4 — score siempre en [0, 1] para múltiples fases");
{
  const modelId = "anthropic/test-sonnet";
  const model = createModelRecord({ id: modelId, tier: "PREMIUM" });
  const caps = createCapabilities(7.5, modelId);

  const v4Cache: V4ScoringCache = new Map();
  v4Cache.set(modelId, createV4CacheEntry(caps, false));

  const config: ScoringConfig = { version: "v4", v4Cache };

  const sddPhases = [
    "sdd-explore", "sdd-propose", "sdd-spec", "sdd-design",
    "sdd-tasks", "sdd-apply", "sdd-verify", "sdd-archive",
    "sdd-init", "sdd-onboard",
  ];

  for (const phase of sddPhases) {
    const score = scoreModel(model, phase, config, "PREMIUM");

    assert.ok(
      score >= 0 && score <= 1,
      `Score para ${phase} debe estar en [0, 1], obtuvo: ${score}`
    );
  }

  console.log(`   ✓ ${sddPhases.length} fases verificadas con scores en [0, 1]`);
  console.log("✓ Test 10 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 11: scoreModel — falla correctamente sin v4Cache cuando versión es v4
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 11: scoreModel V4 — lanza error si no hay v4Cache");
{
  const model = createModelRecord();
  const config: ScoringConfig = { version: "v4" };  // Sin v4Cache

  assert.throws(
    () => scoreModel(model, "sdd-apply", config, "PREMIUM"),
    /v4Cache/,
    "Debe lanzar error mencionando 'v4Cache' cuando no está configurado"
  );

  console.log(`   ✓ Error correcto lanzado cuando v4Cache no está configurado`);
  console.log("✓ Test 11 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 12: scoreModel — falla correctamente sin preferredTier cuando versión es v4
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 12: scoreModel V4 — lanza error si no hay preferredTier");
{
  const model = createModelRecord();
  const v4Cache: V4ScoringCache = new Map();
  const config: ScoringConfig = { version: "v4", v4Cache };

  assert.throws(
    () => scoreModel(model, "sdd-apply", config, undefined),  // Sin preferredTier
    /preferredTier/,
    "Debe lanzar error mencionando 'preferredTier' cuando no está configurado"
  );

  console.log(`   ✓ Error correcto lanzado cuando preferredTier no está configurado`);
  console.log("✓ Test 12 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen
// ─────────────────────────────────────────────────────────────────────────────

console.log("═".repeat(60));
console.log("✅ ALL 12 SELECTOR V4 INTEGRATION TESTS PASSED");
console.log("═".repeat(60));
