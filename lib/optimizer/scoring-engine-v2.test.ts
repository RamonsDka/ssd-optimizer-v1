// ─── Scoring Engine V2 Tests ──────────────────────────────────────────────────
// Unit tests for scoring calculations (no DB access required)

import assert from "node:assert/strict";
import {
  normalizeArenaScore,
  calculateArenaWeightedScore,
  calculateContextScore,
  calculateCostScore,
  calculateTierPreferenceScore,
  scoreModel,
  calculateConfidence,
  type ArenaScoreData,
} from "./scoring-engine-v2";
import type { ModelRecord, SddPhase } from "@/types";

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createMockModel(overrides?: Partial<ModelRecord>): ModelRecord {
  return {
    id: "test/model",
    name: "Test Model",
    providerId: "test",
    tier: "BALANCED",
    contextWindow: 128_000,
    costPer1M: 5.0,
    strengths: ["coding", "reasoning"],
    discoveredByAI: false,
    lastSyncedAt: new Date(),
    ...overrides,
  };
}

function createMockArenaScores(): Map<string, ArenaScoreData> {
  return new Map([
    [
      "coding",
      {
        category: "coding",
        score: 1200,
        rank: 5,
        publishDate: new Date(),
      },
    ],
    [
      "reasoning",
      {
        category: "reasoning",
        score: 1150,
        rank: 8,
        publishDate: new Date(),
      },
    ],
    [
      "long-context",
      {
        category: "long-context",
        score: 1180,
        rank: 6,
        publishDate: new Date(),
      },
    ],
  ]);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log("Running Scoring Engine V2 Tests...\n");

// Test 1: normalizeArenaScore
// The function uses expanded range [900, 1600] scaled to [0.1, 0.9].
// Formula: 0.1 + clamp((score - 900) / 700, 0, 1) * 0.8
console.log("Test 1: normalizeArenaScore");
{
  // Score at the global min boundary (900) → 0.1 + 0*0.8 = 0.1
  const atMin = normalizeArenaScore(900);
  assert.equal(atMin, 0.1, "Score at range floor (900) should be 0.1");

  // Score at the global max boundary (1600) → 0.1 + 1*0.8 = 0.9
  const atMax = normalizeArenaScore(1600);
  assert.equal(atMax, 0.9, "Score at range ceiling (1600) should be 0.9");

  // Score below min is clamped to 0.1
  const belowMin = normalizeArenaScore(800);
  assert.equal(belowMin, 0.1, "Score below range floor (800) should clamp to 0.1");

  // Score above max is clamped to 0.9
  const aboveMax = normalizeArenaScore(1700);
  assert.equal(aboveMax, 0.9, "Score above range ceiling (1700) should clamp to 0.9");

  // Score at midpoint (1250) → 0.1 + (350/700)*0.8 = 0.1 + 0.4 = 0.5
  const atMid = normalizeArenaScore(1250);
  assert.ok(
    Math.abs(atMid - 0.5) < 0.0001,
    `Score at midpoint (1250) should be ≈ 0.5, got ${atMid}`
  );

  // Higher score should produce higher normalized value
  const lower = normalizeArenaScore(1100);
  const higher = normalizeArenaScore(1400);
  assert.ok(
    higher > lower,
    "Higher raw score should produce a higher normalized value"
  );

  // All outputs must be in [0, 1]
  for (const raw of [900, 1000, 1150, 1200, 1300, 1600]) {
    const result = normalizeArenaScore(raw);
    assert.ok(
      result >= 0 && result <= 1,
      `normalizeArenaScore(${raw}) must be in [0,1], got ${result}`
    );
  }

  console.log("✓ normalizeArenaScore works correctly\n");
}

// Test 2: calculateContextScore
console.log("Test 2: calculateContextScore");
{
  const large = calculateContextScore(128_000);
  const medium = calculateContextScore(64_000);
  const small = calculateContextScore(32_000);
  const tiny = calculateContextScore(8_000);

  assert.equal(large, 1.0, "Large context should score 1.0");
  assert.equal(medium, 0.7, "Medium context should score 0.7");
  assert.equal(small, 0.4, "Small context should score 0.4");
  assert.equal(tiny, 0.2, "Tiny context should score 0.2");
  console.log("✓ calculateContextScore works correctly\n");
}

// Test 3: calculateCostScore
// Thresholds: free=0, cheap≤1.0, moderate≤5.0, expensive≤15.0, else very expensive
console.log("Test 3: calculateCostScore");
{
  const free = calculateCostScore(0);
  const cheap = calculateCostScore(0.5);
  const moderate = calculateCostScore(3.0);
  const expensive = calculateCostScore(10.0);
  const veryExpensive = calculateCostScore(20.0);

  assert.equal(free, 1.0, "Free should score 1.0");
  assert.equal(cheap, 0.9, "Cheap (≤1.0) should score 0.9");
  assert.equal(moderate, 0.7, "Moderate (≤5.0) should score 0.7");
  assert.equal(expensive, 0.5, "Expensive (≤15.0) should score 0.5");
  assert.equal(veryExpensive, 0.3, "Very expensive (>15.0) should score 0.3");
  console.log("✓ calculateCostScore works correctly\n");
}

// Test 4: calculateTierPreferenceScore
console.log("Test 4: calculateTierPreferenceScore");
{
  const perfectMatch = calculateTierPreferenceScore("PREMIUM", "PREMIUM");
  const secondChoice = calculateTierPreferenceScore("BALANCED", "PREMIUM");
  const lastResort = calculateTierPreferenceScore("ECONOMIC", "PREMIUM");

  assert.equal(perfectMatch, 1.0, "Perfect match should score 1.0");
  assert.equal(secondChoice, 0.6, "Second choice should score 0.6");
  assert.equal(lastResort, 0.3, "Last resort should score 0.3");
  console.log("✓ calculateTierPreferenceScore works correctly\n");
}

// Test 5: calculateArenaWeightedScore
console.log("Test 5: calculateArenaWeightedScore");
{
  const arenaScores = createMockArenaScores();
  const applyScore = calculateArenaWeightedScore("sdd-apply", arenaScores);
  const exploreScore = calculateArenaWeightedScore("sdd-explore", arenaScores);

  assert.ok(
    applyScore > 0 && applyScore <= 1,
    `Apply score should be in (0,1], got ${applyScore}`
  );
  assert.ok(
    exploreScore > 0 && exploreScore <= 1,
    `Explore score should be in (0,1], got ${exploreScore}`
  );
  console.log("✓ calculateArenaWeightedScore works correctly\n");
}

// Test 6: scoreModel
console.log("Test 6: scoreModel");
{
  const model = createMockModel();
  const arenaScores = createMockArenaScores();
  const components = scoreModel(model, "sdd-apply", arenaScores, "BALANCED");

  assert.ok(
    components.arena >= 0 && components.arena <= 1,
    `Arena score should be in [0,1], got ${components.arena}`
  );
  assert.ok(
    components.context >= 0 && components.context <= 1,
    `Context score should be in [0,1], got ${components.context}`
  );
  assert.ok(
    components.cost >= 0 && components.cost <= 1,
    `Cost score should be in [0,1], got ${components.cost}`
  );
  assert.ok(
    components.tier >= 0 && components.tier <= 1,
    `Tier score should be in [0,1], got ${components.tier}`
  );
  assert.ok(
    components.final >= 0 && components.final <= 1,
    `Final score should be in [0,1], got ${components.final}`
  );

  // Verify weighted formula: arena*0.7 + context*0.15 + cost*0.1 + tier*0.05
  const expectedFinal =
    components.arena * 0.7 +
    components.context * 0.15 +
    components.cost * 0.1 +
    components.tier * 0.05;

  assert.ok(
    Math.abs(components.final - expectedFinal) < 0.001,
    `Final score should match weighted formula. Expected ≈${expectedFinal.toFixed(4)}, got ${components.final.toFixed(4)}`
  );
  console.log("✓ scoreModel works correctly\n");
}

// Test 7: calculateConfidence
console.log("Test 7: calculateConfidence");
{
  const model = createMockModel();
  const arenaScores = createMockArenaScores();
  const confidence = calculateConfidence("sdd-apply", arenaScores, model);

  assert.ok(
    confidence >= 0 && confidence <= 1,
    `Confidence should be in [0,1], got ${confidence}`
  );
  console.log("✓ calculateConfidence works correctly\n");
}

// Test 8: Missing arena scores handling
console.log("Test 8: Missing arena scores handling");
{
  const model = createMockModel();
  const emptyScores = new Map<string, ArenaScoreData>();
  const components = scoreModel(model, "sdd-apply", emptyScores, "BALANCED");

  // When no arena scores, calculateArenaWeightedScore returns the fallback (0.5)
  // so arena will equal the default fallback, not necessarily 0.
  assert.ok(
    components.arena >= 0 && components.arena <= 1,
    `Arena score should be in [0,1] when no data, got ${components.arena}`
  );
  assert.ok(
    components.final > 0,
    `Final score should be > 0 (other factors contribute), got ${components.final}`
  );
  console.log("✓ Missing arena scores handled correctly\n");
}

// Test 9: Tier preference affects score
console.log("Test 9: Tier preference affects score");
{
  const premiumModel = createMockModel({ tier: "PREMIUM" });
  const economicModel = createMockModel({ tier: "ECONOMIC" });
  const arenaScores = createMockArenaScores();

  const premiumForPremium = scoreModel(
    premiumModel,
    "sdd-apply",
    arenaScores,
    "PREMIUM"
  );
  const economicForPremium = scoreModel(
    economicModel,
    "sdd-apply",
    arenaScores,
    "PREMIUM"
  );

  assert.ok(
    premiumForPremium.tier > economicForPremium.tier,
    `Premium model should score higher for premium tier preference. Got ${premiumForPremium.tier} vs ${economicForPremium.tier}`
  );
  console.log("✓ Tier preference affects score correctly\n");
}

// Test 10: Context window affects score
console.log("Test 10: Context window affects score");
{
  const largeContext = createMockModel({ contextWindow: 200_000 });
  const smallContext = createMockModel({ contextWindow: 8_000 });
  const arenaScores = createMockArenaScores();

  const largeScore = scoreModel(largeContext, "sdd-init", arenaScores, "BALANCED");
  const smallScore = scoreModel(smallContext, "sdd-init", arenaScores, "BALANCED");

  assert.ok(
    largeScore.context > smallScore.context,
    `Large context should score higher. Got ${largeScore.context} vs ${smallScore.context}`
  );
  assert.ok(
    largeScore.final > smallScore.final,
    `Large context should have higher final score. Got ${largeScore.final} vs ${smallScore.final}`
  );
  console.log("✓ Context window affects score correctly\n");
}

console.log("All tests passed! ✓");
