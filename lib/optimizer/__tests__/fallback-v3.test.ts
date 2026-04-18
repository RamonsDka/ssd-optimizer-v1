// ─── Fallback V3 Tests ─────────────────────────────────────────────────────────
//
// Tests que verifican que el sistema de fallback V4→V3 funciona correctamente
// en todos los escenarios posibles, sin romper nada.
//
// Escenarios cubiertos:
//   - Modelo con datos V4 completos → usa V4 directamente
//   - Modelo sin datos V4 → usa V3 automáticamente
//   - Modelo con datos V4 parciales (usesV3Fallback=true) → usa V3
//   - El logging de fallback incluye modelId y razón
//   - La normalización del score V4→[0,1] funciona correctamente
//   - El NULL_DIMENSION_FALLBACK se usa cuando no hay datos
//
// Ejecución:
//   npx tsx lib/optimizer/__tests__/fallback-v3.test.ts

import assert from "node:assert/strict";
import { scoreModel, computeV4Coverage } from "../selector";
import type { ScoringConfig, V4ScoringCache, V4ModelCacheEntry } from "../selector";
import type { ModelCapabilitiesV4 } from "../v4/scoring-engine-v4";
import type { ModelRecord } from "@/types";
import { NULL_DIMENSION_FALLBACK } from "../scoring-engine-v3";
import type { V3ScoreResult } from "../scoring-engine-v3";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createModel(id: string, tier: "PREMIUM" | "BALANCED" | "ECONOMIC" = "PREMIUM"): ModelRecord {
  return {
    id,
    name: `Model ${id}`,
    providerId: id.split("/")[0] ?? "test",
    tier,
    contextWindow: 128_000,
    costPer1M: 3.0,
    strengths: ["coding", "reasoning"],
    discoveredByAI: false,
    lastSyncedAt: new Date(),
  };
}

function createFullCapabilities(modelId: string, value = 7.5): ModelCapabilitiesV4 {
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

function makeV3Result(score: number): V3ScoreResult {
  return {
    rawScore: score,
    decayedScore: score,
    finalScore: score,
    decayFactor: 1.0,
    ciBonus: 0,
    dimensionCoverage: 5,
    usedFallback: false,
  };
}

/**
 * Crea una cache entry con datos V4 completos (17 dimensiones todas presentes).
 */
function makeV4Entry(capabilities: ModelCapabilitiesV4): V4ModelCacheEntry {
  return {
    capabilities,
    v3Fallback: new Map(),
    usesV3Fallback: false,
  };
}

/**
 * Crea una cache entry marcada para V3 fallback (usesV3Fallback=true),
 * como si el modelo no tuviera datos en ModelCapabilities.
 */
function makeV3FallbackEntry(
  modelId: string,
  phase: string,
  v3Score: number,
  reason: "no_data" | "partial_data" = "no_data"
): V4ModelCacheEntry {
  const v3Fallback = new Map<string, V3ScoreResult>();
  v3Fallback.set(`${modelId}::${phase}`, makeV3Result(v3Score));
  return {
    capabilities: null,      // null → no V4 data available
    v3Fallback,
    usesV3Fallback: true,   // Explicitly flagged for fallback
  };
}

// ─── Log Capture Helper ───────────────────────────────────────────────────────

interface LogCapture {
  warnings: string[];
  restore: () => void;
}

function captureWarnings(): LogCapture {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
  return {
    warnings,
    restore: () => { console.warn = original; },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log("Running Fallback V3 Tests...\n");

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Modelo con datos V4 completos usa engine V4
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 1: Modelo con datos V4 completos usa engine V4 (no V3 fallback)");
{
  const modelId = "anthropic/claude-sonnet";
  const model = createModel(modelId);
  const caps = createFullCapabilities(modelId, 8.0);

  const v4Cache: V4ScoringCache = new Map();
  v4Cache.set(modelId, makeV4Entry(caps));

  const config: ScoringConfig = { version: "v4", v4Cache };
  const capture = captureWarnings();

  const score = scoreModel(model, "sdd-spec", config, "PREMIUM");

  capture.restore();

  // No debe haber loggeado warnings de fallback
  const hasFallbackWarning = capture.warnings.some(
    (msg) => msg.includes("fallback") || msg.includes("V3")
  );
  assert.ok(!hasFallbackWarning, `No debe haber warning de fallback para modelo con datos V4 completos. Warnings: [${capture.warnings.join(" | ")}]`);

  // El score debe ser > 0 (modelo válido con capabilities altas)
  assert.ok(score > 0, `Score V4 para modelo con datos completos debe ser > 0, obtuvo: ${score}`);
  assert.ok(score <= 1, `Score V4 debe ser ≤ 1, obtuvo: ${score}`);

  console.log(`   ✓ Score V4 directo: ${score.toFixed(4)}, fallback warnings: ${hasFallbackWarning}`);
  console.log("✓ Test 1 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Modelo sin datos V4 usa V3 automáticamente
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 2: Modelo sin datos V4 (usesV3Fallback=true) usa V3 automáticamente");
{
  const modelId = "provider/no-v4-data";
  const model = createModel(modelId);
  const v3Score = 0.68;

  const v4Cache: V4ScoringCache = new Map();
  v4Cache.set(modelId, makeV3FallbackEntry(modelId, "sdd-spec", v3Score, "no_data"));

  const config: ScoringConfig = { version: "v4", v4Cache };
  const capture = captureWarnings();

  const score = scoreModel(model, "sdd-spec", config, "PREMIUM");

  capture.restore();

  // El score debe ser el del V3 fallback
  assert.ok(
    Math.abs(score - v3Score) < 0.001,
    `Fallback V3 score debe ser ${v3Score}, obtuvo: ${score}`
  );

  // Debe loggear warning indicando fallback
  const hasFallbackWarning = capture.warnings.some(
    (msg) => msg.includes("fallback") && msg.includes("V3")
  );
  assert.ok(
    hasFallbackWarning,
    `Debe loggearse warning de V4→V3 fallback. Mensajes: [${capture.warnings.join(" | ")}]`
  );

  // El warning debe incluir el modelId
  const hasModelIdInWarning = capture.warnings.some((msg) => msg.includes(modelId));
  assert.ok(
    hasModelIdInWarning,
    `El warning debe incluir el modelId '${modelId}'. Mensajes: [${capture.warnings.join(" | ")}]`
  );

  console.log(`   ✓ V3 fallback score: ${score}, warning: "${capture.warnings[0]?.substring(0, 70)}..."`);
  console.log("✓ Test 2 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Modelo con capabilities=null usa V3 (caso de datos parciales < 50%)
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 3: capabilities=null (datos V4 parciales/insuficientes) usa V3");
{
  const modelId = "provider/partial-v4";
  const model = createModel(modelId);
  const v3Score = 0.55;

  // capabilities=null simula el caso donde:
  // - El registro existe en BD pero con < 50% de campos completos
  // - El servicio de getCapabilitiesByModelId retorna null
  const v4Cache: V4ScoringCache = new Map();
  v4Cache.set(modelId, {
    capabilities: null,    // ← datos insuficientes → null
    v3Fallback: new Map([[`${modelId}::sdd-apply`, makeV3Result(v3Score)]]),
    usesV3Fallback: true,
  });

  const config: ScoringConfig = { version: "v4", v4Cache };
  const capture = captureWarnings();

  const score = scoreModel(model, "sdd-apply", config, "BALANCED");

  capture.restore();

  assert.ok(
    Math.abs(score - v3Score) < 0.001,
    `Con capabilities=null debe usar V3 score (${v3Score}), obtuvo: ${score}`
  );

  // Debe haber warning de fallback
  const hasFallbackWarning = capture.warnings.some((msg) => msg.includes("fallback"));
  assert.ok(hasFallbackWarning, "Debe loggearse warning cuando capabilities=null");

  console.log(`   ✓ capabilities=null → V3 fallback score: ${score}`);
  console.log("✓ Test 3 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Logging de fallback incluye modelId y fase
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 4: Warning de fallback incluye modelId y nombre de fase");
{
  const modelId = "specific/model-for-log-test";
  const phase = "sdd-verify";
  const model = createModel(modelId);

  const v4Cache: V4ScoringCache = new Map();
  v4Cache.set(modelId, makeV3FallbackEntry(modelId, phase, 0.72));

  const config: ScoringConfig = { version: "v4", v4Cache };
  const capture = captureWarnings();

  scoreModel(model, phase, config, "PREMIUM");

  capture.restore();

  // El warning debe contener el modelId
  const hasModelId = capture.warnings.some((msg) => msg.includes(modelId));
  assert.ok(hasModelId, `El warning debe incluir modelId '${modelId}'. Got: ${capture.warnings.join(" | ")}`);

  // El warning debe mencionar la fase (con o sin prefijo "sdd-")
  const hasPhase = capture.warnings.some(
    (msg) => msg.includes(phase) || msg.includes(phase.replace("sdd-", ""))
  );
  assert.ok(hasPhase, `El warning debe incluir la fase '${phase}'. Got: ${capture.warnings.join(" | ")}`);

  console.log(`   ✓ Warning contiene modelId: ${hasModelId}, fase: ${hasPhase}`);
  console.log(`   ✓ Warning: "${capture.warnings[0]?.substring(0, 80)}..."`);
  console.log("✓ Test 4 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Cache completo sin fallbacks → 100% cobertura V4
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 5: computeV4Coverage — 100% V4 cuando todos tienen datos completos");
{
  const v4Cache: V4ScoringCache = new Map();
  const modelIds = ["anthropic/model-a", "google/model-b", "openai/model-c"];

  for (const id of modelIds) {
    v4Cache.set(id, makeV4Entry(createFullCapabilities(id)));
  }

  const metrics = computeV4Coverage(v4Cache);

  assert.equal(metrics.totalModels, 3);
  assert.equal(metrics.modelsWithV4Data, 3);
  assert.equal(metrics.modelsUsingV3Fallback, 0);
  assert.equal(metrics.v4CoveragePercent, 100);

  console.log(`   ✓ 100% coverage: ${metrics.modelsWithV4Data}/${metrics.totalModels}`);
  console.log("✓ Test 5 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Cache con solo fallbacks → 0% cobertura V4
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 6: computeV4Coverage — 0% V4 cuando todos usan fallback V3");
{
  const v4Cache: V4ScoringCache = new Map();
  const modelIds = ["provider/no-data-a", "provider/no-data-b"];

  for (const id of modelIds) {
    v4Cache.set(id, makeV3FallbackEntry(id, "sdd-apply", 0.6));
  }

  const metrics = computeV4Coverage(v4Cache);

  assert.equal(metrics.totalModels, 2);
  assert.equal(metrics.modelsWithV4Data, 0);
  assert.equal(metrics.modelsUsingV3Fallback, 2);
  assert.equal(metrics.v4CoveragePercent, 0);

  console.log(`   ✓ 0% coverage: ${metrics.modelsWithV4Data}/${metrics.totalModels} V4`);
  console.log("✓ Test 6 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: NULL_DIMENSION_FALLBACK cuando no hay V3 data en el fallback
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 7: NULL_DIMENSION_FALLBACK cuando V3 fallback tampoco tiene datos de la fase");
{
  const modelId = "provider/no-v3-either";
  const model = createModel(modelId);

  // Cache entry con fallback=true pero v3Fallback map VACÍO
  const v4Cache: V4ScoringCache = new Map();
  v4Cache.set(modelId, {
    capabilities: null,
    v3Fallback: new Map(),   // ← vacío, no hay datos V3 para ninguna fase
    usesV3Fallback: true,
  });

  const config: ScoringConfig = { version: "v4", v4Cache };
  const capture = captureWarnings();

  const score = scoreModel(model, "sdd-design", config, "PREMIUM");

  capture.restore();

  // Debe retornar NULL_DIMENSION_FALLBACK (0.60) como último recurso
  assert.ok(
    Math.abs(score - NULL_DIMENSION_FALLBACK) < 0.001,
    `Sin V3 data debe retornar NULL_DIMENSION_FALLBACK (${NULL_DIMENSION_FALLBACK}), obtuvo: ${score}`
  );

  console.log(`   ✓ Sin datos V3: score=${score} (= NULL_DIMENSION_FALLBACK)`);
  console.log("✓ Test 7 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 8: Score V4 vs V3 fallback — V4 produce scores diferentes cuando hay datos
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 8: Score V4 (con datos) vs V3 fallback produce resultados diferentes");
{
  const phase = "sdd-spec";
  const v3Score = NULL_DIMENSION_FALLBACK;  // 0.60

  // Modelo con datos V4 completos (capabilities altas)
  const modelIdV4 = "anthropic/v4-capable";
  const modelV4 = createModel(modelIdV4);
  const caps = createFullCapabilities(modelIdV4, 8.5);  // Muy buenas capabilities

  const v4Cache: V4ScoringCache = new Map();
  v4Cache.set(modelIdV4, makeV4Entry(caps));

  // Modelo sin datos V4 → fallback V3 con score neutral
  const modelIdV3 = "unknown/v3-only";
  const modelV3 = createModel(modelIdV3);
  v4Cache.set(modelIdV3, makeV3FallbackEntry(modelIdV3, phase, v3Score));

  const config: ScoringConfig = { version: "v4", v4Cache };
  const capture = captureWarnings();

  const scoreWithV4 = scoreModel(modelV4, phase, config, "PREMIUM");
  const scoreWithV3Fallback = scoreModel(modelV3, phase, config, "PREMIUM");

  capture.restore();

  // Los scores deben ser diferentes (V4 con buenos datos debe superar V3 neutral)
  assert.ok(
    scoreWithV4 !== scoreWithV3Fallback,
    `V4 score (${scoreWithV4}) y V3 fallback score (${scoreWithV3Fallback}) deben ser diferentes`
  );

  // Modelo con capabilities excelentes (8.5) debe superar el neutral 0.6 del V3
  assert.ok(
    scoreWithV4 > scoreWithV3Fallback,
    `V4 con capabilities altas (${scoreWithV4.toFixed(4)}) debe superar V3 neutral (${scoreWithV3Fallback.toFixed(4)})`
  );

  console.log(`   ✓ V4 score: ${scoreWithV4.toFixed(4)} vs V3 fallback: ${scoreWithV3Fallback.toFixed(4)}`);
  console.log("✓ Test 8 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 9: scoreModel — todas las fases SDD tienen scores válidos con V4
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 9: Todos las 10 fases SDD producen scores válidos en [0, 1] con V4");
{
  const modelId = "anthropic/all-phases-model";
  const model = createModel(modelId);
  const caps = createFullCapabilities(modelId, 7.0);

  const v4Cache: V4ScoringCache = new Map();
  v4Cache.set(modelId, makeV4Entry(caps));

  const config: ScoringConfig = { version: "v4", v4Cache };
  const capture = captureWarnings();

  const sddPhases = [
    "sdd-init", "sdd-explore", "sdd-propose", "sdd-spec",
    "sdd-design", "sdd-tasks", "sdd-apply", "sdd-verify",
    "sdd-archive", "sdd-onboard",
  ];

  const results: Array<{ phase: string; score: number }> = [];

  for (const phase of sddPhases) {
    const score = scoreModel(model, phase, config, "PREMIUM");
    results.push({ phase, score });

    assert.ok(
      score >= 0 && score <= 1,
      `Score para '${phase}' debe estar en [0, 1], obtuvo: ${score}`
    );
  }

  capture.restore();

  console.log(`   ✓ ${sddPhases.length} fases: ` + results.map((r) => `${r.phase.replace("sdd-", "")}=${r.score.toFixed(2)}`).join(", "));
  console.log("✓ Test 9 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 10: V4 con modelo thinking en fase anti-thinking produce score 0
// ─────────────────────────────────────────────────────────────────────────────
console.log("Test 10: V4 con thinking model (R1) en anti-thinking fase retorna score 0");
{
  // DeepSeek R1 detectado por heurística como thinking model
  const modelId = "deepseek/deepseek-r1";
  const model = createModel(modelId);
  const caps = createFullCapabilities(modelId, 9.8);  // Capabilities excelentes

  const v4Cache: V4ScoringCache = new Map();
  v4Cache.set(modelId, makeV4Entry(caps));

  const config: ScoringConfig = { version: "v4", v4Cache };

  // Anti-thinking phases: tasks, archive, orchestrator
  const antiThinkingPhases = ["sdd-tasks", "sdd-archive"];

  for (const phase of antiThinkingPhases) {
    const score = scoreModel(model, phase, config, "PREMIUM");
    assert.equal(
      score,
      0,
      `DeepSeek R1 en ${phase} (anti-thinking) debe retornar 0, obtuvo: ${score}`
    );
    console.log(`   ✓ ${phase}: score=0 (thinking model excluido)`);
  }

  console.log("✓ Test 10 passed\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen
// ─────────────────────────────────────────────────────────────────────────────

console.log("═".repeat(60));
console.log("✅ ALL 10 FALLBACK V3 TESTS PASSED");
console.log("═".repeat(60));
