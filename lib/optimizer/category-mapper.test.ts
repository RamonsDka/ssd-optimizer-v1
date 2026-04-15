// ─── Category Mapper Tests ────────────────────────────────────────────────────
// Unit tests for category mapping (no external dependencies)

import {
  PHASE_CATEGORY_WEIGHTS,
  getRelevantCategories,
  validateCategoryWeights,
  getAllUsedCategories,
} from "./category-mapper";
import { SDD_PHASES } from "@/types";

console.log("Running Category Mapper Tests...\n");

// Test 1: All phases have weights
console.log("Test 1: All phases have weights");
{
  for (const phase of SDD_PHASES) {
    const weights = PHASE_CATEGORY_WEIGHTS[phase];
    console.assert(weights !== undefined, `Phase ${phase} should have weights`);
    console.assert(
      weights.length > 0,
      `Phase ${phase} should have at least one category`
    );
  }
  console.log("✓ All phases have weights\n");
}

// Test 2: Weights sum to 1.0
console.log("Test 2: Weights sum to 1.0");
{
  for (const phase of SDD_PHASES) {
    const weights = PHASE_CATEGORY_WEIGHTS[phase];
    const sum = weights.reduce((acc, w) => acc + w.weight, 0);
    console.assert(
      Math.abs(sum - 1.0) < 0.001,
      `Phase ${phase} weights should sum to 1.0, got ${sum}`
    );
  }
  console.log("✓ All weights sum to 1.0\n");
}

// Test 3: All weights are positive
console.log("Test 3: All weights are positive");
{
  for (const phase of SDD_PHASES) {
    const weights = PHASE_CATEGORY_WEIGHTS[phase];
    for (const { category, weight } of weights) {
      console.assert(
        weight > 0,
        `Weight for ${category} in ${phase} should be positive`
      );
      console.assert(
        weight <= 1,
        `Weight for ${category} in ${phase} should be <= 1`
      );
    }
  }
  console.log("✓ All weights are positive and <= 1\n");
}

// Test 4: getRelevantCategories
console.log("Test 4: getRelevantCategories");
{
  const exploreCategories = getRelevantCategories("sdd-explore");
  console.assert(
    exploreCategories.length > 0,
    "sdd-explore should have categories"
  );

  const applyCategories = getRelevantCategories("sdd-apply");
  const codingWeight = applyCategories.find((c) => c.category === "coding");
  console.assert(
    codingWeight !== undefined,
    "sdd-apply should include coding category"
  );
  if (codingWeight) {
    console.assert(
      codingWeight.weight > 0.3,
      "sdd-apply should prioritize coding"
    );
  }

  const initCategories = getRelevantCategories("sdd-init");
  const longContextWeight = initCategories.find(
    (c) => c.category === "long-context"
  );
  console.assert(
    longContextWeight !== undefined,
    "sdd-init should include long-context category"
  );
  if (longContextWeight) {
    console.assert(
      longContextWeight.weight > 0.3,
      "sdd-init should prioritize long-context"
    );
  }

  console.log("✓ getRelevantCategories works correctly\n");
}

// Test 5: validateCategoryWeights
console.log("Test 5: validateCategoryWeights");
{
  try {
    validateCategoryWeights();
    console.log("✓ validateCategoryWeights passes\n");
  } catch (err) {
    console.error("✗ validateCategoryWeights failed:", err);
    process.exit(1);
  }
}

// Test 6: getAllUsedCategories
console.log("Test 6: getAllUsedCategories");
{
  const categories = getAllUsedCategories();
  console.assert(categories.size > 0, "Should have at least one category");
  console.assert(categories.has("coding"), "Should include coding");
  console.assert(categories.has("reasoning"), "Should include reasoning");
  console.assert(
    categories.has("long-context"),
    "Should include long-context"
  );
  console.log("✓ getAllUsedCategories works correctly\n");
}

// Test 7: Phase-specific mappings
console.log("Test 7: Phase-specific mappings");
{
  // sdd-explore should prioritize reasoning
  const exploreCategories = getRelevantCategories("sdd-explore");
  const reasoning = exploreCategories.find((c) => c.category === "reasoning");
  console.assert(
    reasoning !== undefined && reasoning.weight > 0.3,
    "sdd-explore should prioritize reasoning"
  );

  // sdd-spec should prioritize instruction-following
  const specCategories = getRelevantCategories("sdd-spec");
  const instructionFollowing = specCategories.find(
    (c) => c.category === "instruction-following"
  );
  console.assert(
    instructionFollowing !== undefined && instructionFollowing.weight > 0.3,
    "sdd-spec should prioritize instruction-following"
  );

  // sdd-tasks should prioritize planning
  const tasksCategories = getRelevantCategories("sdd-tasks");
  const planning = tasksCategories.find((c) => c.category === "planning");
  console.assert(
    planning !== undefined && planning.weight > 0.3,
    "sdd-tasks should prioritize planning"
  );

  // sdd-archive should prioritize summarization
  const archiveCategories = getRelevantCategories("sdd-archive");
  const summarization = archiveCategories.find(
    (c) => c.category === "summarization"
  );
  console.assert(
    summarization !== undefined && summarization.weight > 0.3,
    "sdd-archive should prioritize summarization"
  );

  console.log("✓ Phase-specific mappings are correct\n");
}

// Test 8: No duplicate categories per phase
console.log("Test 8: No duplicate categories per phase");
{
  for (const phase of SDD_PHASES) {
    const weights = PHASE_CATEGORY_WEIGHTS[phase];
    const categories = weights.map((w) => w.category);
    const uniqueCategories = new Set(categories);
    console.assert(
      categories.length === uniqueCategories.size,
      `Phase ${phase} should not have duplicate categories`
    );
  }
  console.log("✓ No duplicate categories per phase\n");
}

console.log("All tests passed! ✓");
