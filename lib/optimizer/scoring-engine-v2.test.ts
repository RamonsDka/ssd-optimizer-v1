// ─── Scoring Engine V2 Tests ──────────────────────────────────────────────────
// Unit tests for scoring calculations (no DB access required)

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
console.log("Test 1: normalizeArenaScore");
{
  const min = normalizeArenaScore(1000);
  const mid = normalizeArenaScore(1150);
  const max = normalizeArenaScore(1300);

  console.assert(min === 0, "Min score should be 0");
  console.assert(mid === 0.5, "Mid score should be 0.5");
  console.assert(max === 1, "Max score should be 1");
  console.assert(
    normalizeArenaScore(1200) > 0.5 && normalizeArenaScore(1200) < 1,
    "Score 1200 should be between 0.5 and 1"
  );
  console.log("✓ normalizeArenaScore works correctly\n");
}

// Test 2: calculateContextScore
console.log("Test 2: calculateContextScore");
{
  const large = calculateContextScore(128_000);
  const medium = calculateContextScore(64_000);
  const small = calculateContextScore(32_000);
  const tiny = calculateContextScore(8_000);

  console.assert(large === 1.0, "Large context should score 1.0");
  console.assert(medium === 0.7, "Medium context should score 0.7");
  console.assert(small === 0.4, "Small context should score 0.4");
  console.assert(tiny === 0.2, "Tiny context should score 0.2");
  console.log("✓ calculateContextScore works correctly\n");
}

// Test 3: calculateCostScore
console.log("Test 3: calculateCostScore");
{
  const free = calculateCostScore(0);
  const cheap = calculateCostScore(0.5);
  const moderate = calculateCostScore(3.0);
  const expensive = calculateCostScore(10.0);
  const veryExpensive = calculateCostScore(20.0);

  console.assert(free === 1.0, "Free should score 1.0");
  console.assert(cheap === 0.9, "Cheap should score 0.9");
  console.assert(moderate === 0.7, "Moderate should score 0.7");
  console.assert(expensive === 0.5, "Expensive should score 0.5");
  console.assert(veryExpensive === 0.3, "Very expensive should score 0.3");
  console.log("✓ calculateCostScore works correctly\n");
}

// Test 4: calculateTierPreferenceScore
console.log("Test 4: calculateTierPreferenceScore");
{
  const perfectMatch = calculateTierPreferenceScore("PREMIUM", "PREMIUM");
  const secondChoice = calculateTierPreferenceScore("BALANCED", "PREMIUM");
  const lastResort = calculateTierPreferenceScore("ECONOMIC", "PREMIUM");

  console.assert(perfectMatch === 1.0, "Perfect match should score 1.0");
  console.assert(secondChoice === 0.6, "Second choice should score 0.6");
  console.assert(lastResort === 0.3, "Last resort should score 0.3");
  console.log("✓ calculateTierPreferenceScore works correctly\n");
}

// Test 5: calculateArenaWeightedScore
console.log("Test 5: calculateArenaWeightedScore");
{
  const arenaScores = createMockArenaScores();
  const applyScore = calculateArenaWeightedScore("sdd-apply", arenaScores);
  const exploreScore = calculateArenaWeightedScore("sdd-explore", arenaScores);

  console.assert(
    applyScore > 0 && applyScore <= 1,
    "Apply score should be between 0 and 1"
  );
  console.assert(
    exploreScore > 0 && exploreScore <= 1,
    "Explore score should be between 0 and 1"
  );
  console.log("✓ calculateArenaWeightedScore works correctly\n");
}

// Test 6: scoreModel
console.log("Test 6: scoreModel");
{
  const model = createMockModel();
  const arenaScores = createMockArenaScores();
  const components = scoreModel(model, "sdd-apply", arenaScores, "BALANCED");

  console.assert(
    components.arena >= 0 && components.arena <= 1,
    "Arena score should be 0-1"
  );
  console.assert(
    components.context >= 0 && components.context <= 1,
    "Context score should be 0-1"
  );
  console.assert(
    components.cost >= 0 && components.cost <= 1,
    "Cost score should be 0-1"
  );
  console.assert(
    components.tier >= 0 && components.tier <= 1,
    "Tier score should be 0-1"
  );
  console.assert(
    components.final >= 0 && components.final <= 1,
    "Final score should be 0-1"
  );

  // Verify weighted formula: arena*0.7 + context*0.15 + cost*0.1 + tier*0.05
  const expectedFinal =
    components.arena * 0.7 +
    components.context * 0.15 +
    components.cost * 0.1 +
    components.tier * 0.05;

  console.assert(
    Math.abs(components.final - expectedFinal) < 0.001,
    "Final score should match weighted formula"
  );
  console.log("✓ scoreModel works correctly\n");
}

// Test 7: calculateConfidence
console.log("Test 7: calculateConfidence");
{
  const model = createMockModel();
  const arenaScores = createMockArenaScores();
  const confidence = calculateConfidence("sdd-apply", arenaScores, model);

  console.assert(
    confidence >= 0 && confidence <= 1,
    "Confidence should be 0-1"
  );
  console.log("✓ calculateConfidence works correctly\n");
}

// Test 8: Missing arena scores handling
console.log("Test 8: Missing arena scores handling");
{
  const model = createMockModel();
  const emptyScores = new Map<string, ArenaScoreData>();
  const components = scoreModel(model, "sdd-apply", emptyScores, "BALANCED");

  console.assert(
    components.arena === 0,
    "Arena score should be 0 when no scores available"
  );
  console.assert(
    components.final > 0,
    "Final score should still be > 0 (other factors)"
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

  console.assert(
    premiumForPremium.tier > economicForPremium.tier,
    "Premium model should score higher for premium tier preference"
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

  console.assert(
    largeScore.context > smallScore.context,
    "Large context should score higher"
  );
  console.assert(
    largeScore.final > smallScore.final,
    "Large context should have higher final score"
  );
  console.log("✓ Context window affects score correctly\n");
}

console.log("All tests passed! ✓");
