#!/usr/bin/env tsx
// ─── Scoring Comparison Script — V1 vs V2 ────────────────────────────────────
// Usage: tsx lib/optimizer/compare-scoring.ts
//
// This script compares the legacy V1 scoring engine (tag-based) with the new
// V2 engine (LM Arena-based). Used for validation and analysis only.
// Production uses V2 by default.

import { compareV1vsV2, formatComparisonReport } from "./selector";
import { prisma } from "@/lib/db/prisma";
import type { ModelRecord } from "@/types";

async function main() {
  console.log("🔍 Comparing V1 vs V2 Scoring Engines...\n");

  // Fetch all models from DB
  const allModels = await prisma.model.findMany({
    select: {
      id: true,
      name: true,
      providerId: true,
      tier: true,
      contextWindow: true,
      costPer1M: true,
      strengths: true,
      discoveredByAI: true,
      lastSyncedAt: true,
    },
  });

  if (allModels.length === 0) {
    console.error("❌ No models found in database. Run seed first.");
    process.exit(1);
  }

  console.log(`📊 Loaded ${allModels.length} models from database\n`);

  // Run comparison
  const results = await compareV1vsV2(allModels as ModelRecord[], []);

  // Generate report
  const report = formatComparisonReport(results);

  console.log(report);

  // Additional analysis
  console.log("\n## Detailed Analysis\n");

  const changedByPhase = new Map<string, number>();
  const changedByTier = new Map<string, number>();

  for (const r of results) {
    if (r.primaryChanged) {
      changedByPhase.set(r.phase, (changedByPhase.get(r.phase) ?? 0) + 1);
      changedByTier.set(r.tier, (changedByTier.get(r.tier) ?? 0) + 1);
    }
  }

  console.log("### Changes by Phase:");
  for (const [phase, count] of changedByPhase.entries()) {
    console.log(`  - ${phase}: ${count} changes`);
  }

  console.log("\n### Changes by Tier:");
  for (const [tier, count] of changedByTier.entries()) {
    console.log(`  - ${tier}: ${count} changes`);
  }

  // Score distribution
  const v1Scores = results.map((r) => r.v1Score);
  const v2Scores = results.map((r) => r.v2Score);

  const avgV1 = v1Scores.reduce((a, b) => a + b, 0) / v1Scores.length;
  const avgV2 = v2Scores.reduce((a, b) => a + b, 0) / v2Scores.length;

  console.log("\n### Score Statistics:");
  console.log(`  - V1 Average: ${avgV1.toFixed(3)}`);
  console.log(`  - V2 Average: ${avgV2.toFixed(3)}`);
  console.log(`  - Difference: ${(avgV2 - avgV1).toFixed(3)}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
