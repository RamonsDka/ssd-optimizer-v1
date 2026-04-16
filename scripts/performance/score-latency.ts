import { performance } from "node:perf_hooks";
import { scoreModel, type ArenaScoreData } from "@/lib/optimizer/scoring-engine-v2";
import type { ModelRecord, SddPhase, Tier } from "@/types";

const ITERATIONS = 100;

const PHASES: SddPhase[] = [
  "sdd-explore",
  "sdd-propose",
  "sdd-spec",
  "sdd-design",
  "sdd-tasks",
  "sdd-apply",
  "sdd-verify",
  "sdd-archive",
  "sdd-init",
  "sdd-onboard",
];

function createModel(index: number, tier: Tier): ModelRecord {
  return {
    id: `perf/model-${index}`,
    name: `Perf Model ${index}`,
    providerId: "perf",
    tier,
    contextWindow: 32_000 + index * 32_000,
    costPer1M: 0.8 + index * 0.7,
    strengths: ["coding", "reasoning", "analysis"],
    discoveredByAI: false,
    lastSyncedAt: new Date(),
  };
}

function createArenaScores(seed: number): Map<string, ArenaScoreData> {
  const base = 1100 + seed * 7;
  const now = new Date();

  return new Map([
    ["coding", { category: "coding", score: base + 50, rank: 5, publishDate: now }],
    ["reasoning", { category: "reasoning", score: base + 30, rank: 7, publishDate: now }],
    ["long-context", { category: "long-context", score: base + 20, rank: 9, publishDate: now }],
    ["instruction-following", { category: "instruction-following", score: base + 10, rank: 11, publishDate: now }],
    ["agent-tasks", { category: "agent-tasks", score: base + 15, rank: 10, publishDate: now }],
  ]);
}

async function main(): Promise<void> {
  const models: ModelRecord[] = [
    createModel(1, "PREMIUM"),
    createModel(2, "BALANCED"),
    createModel(3, "ECONOMIC"),
    createModel(4, "BALANCED"),
    createModel(5, "PREMIUM"),
    createModel(6, "ECONOMIC"),
  ];

  const arenaByModel = new Map(models.map((m, i) => [m.id, createArenaScores(i + 1)]));

  let checksum = 0;
  const start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    for (const model of models) {
      for (const phase of PHASES) {
        const components = scoreModel(
          model,
          phase,
          arenaByModel.get(model.id) ?? new Map(),
          "BALANCED"
        );
        checksum += components.final;
      }
    }
  }

  const end = performance.now();
  const totalCalls = ITERATIONS * models.length * PHASES.length;
  const totalMs = end - start;
  const avgMsPerModelPhase = totalMs / totalCalls;

  console.log(JSON.stringify({
    metric: "scoreModel-latency",
    iterations: ITERATIONS,
    models: models.length,
    phases: PHASES.length,
    totalCalls,
    totalMs: Number(totalMs.toFixed(3)),
    avgMsPerModelPhase: Number(avgMsPerModelPhase.toFixed(6)),
    checksum: Number(checksum.toFixed(6)),
    targetMs: 200,
    passesTarget: avgMsPerModelPhase < 200,
  }, null, 2));
}

main().catch((error) => {
  console.error("score-latency error", error);
  process.exit(1);
});
