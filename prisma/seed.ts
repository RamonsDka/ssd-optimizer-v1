// ─── Database Seed — SDD v6 Reference Models (Abril 2026) ────────────────────
// Run: npx tsx prisma/seed.ts
// Or:  npx prisma db seed (requires prisma.seed in package.json)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error"],
});

// ─── Reference Providers ──────────────────────────────────────────────────────

const PROVIDERS = [
  { id: "anthropic",  name: "Anthropic",  logoUrl: null },
  { id: "openai",     name: "OpenAI",     logoUrl: null },
  { id: "google",     name: "Google",     logoUrl: null },
  { id: "groq",       name: "Groq",       logoUrl: null },
  { id: "mistral",    name: "Mistral AI", logoUrl: null },
  { id: "deepseek",   name: "DeepSeek",   logoUrl: null },
  { id: "xai",        name: "xAI",        logoUrl: null },
  { id: "openrouter", name: "OpenRouter", logoUrl: null },
];

// ─── Reference Models — SDD v6 Configuration ─────────────────────────────────
// Tiers: PREMIUM | BALANCED | ECONOMIC
// Strengths: reasoning, coding, architecture, analysis, speed, context,
//            cost-efficient, creative, structured-output, multimodal

const MODELS = [
  // ── ANTHROPIC — Premium ────────────────────────────────────────────────────
  {
    id: "anthropic/claude-opus-4-5",
    name: "Claude Opus 4.5",
    providerId: "anthropic",
    tier: "PREMIUM" as const,
    contextWindow: 200_000,
    costPer1M: 15.0,
    strengths: ["reasoning", "architecture", "analysis", "context", "structured-output"],
    discoveredByAI: false,
  },
  {
    id: "anthropic/claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    providerId: "anthropic",
    tier: "PREMIUM" as const,
    contextWindow: 200_000,
    costPer1M: 3.0,
    strengths: ["reasoning", "coding", "architecture", "context", "structured-output"],
    discoveredByAI: false,
  },
  {
    id: "anthropic/claude-3-7-sonnet-latest",
    name: "Claude 3.7 Sonnet",
    providerId: "anthropic",
    tier: "PREMIUM" as const,
    contextWindow: 200_000,
    costPer1M: 3.0,
    strengths: ["reasoning", "coding", "analysis", "context"],
    discoveredByAI: false,
  },

  // ── ANTHROPIC — Balanced ──────────────────────────────────────────────────
  {
    id: "anthropic/claude-haiku-3-5",
    name: "Claude Haiku 3.5",
    providerId: "anthropic",
    tier: "BALANCED" as const,
    contextWindow: 200_000,
    costPer1M: 0.25,
    strengths: ["speed", "coding", "context", "cost-efficient"],
    discoveredByAI: false,
  },
  {
    id: "anthropic/claude-sonnet-3-5",
    name: "Claude Sonnet 3.5",
    providerId: "anthropic",
    tier: "BALANCED" as const,
    contextWindow: 200_000,
    costPer1M: 3.0,
    strengths: ["reasoning", "coding", "context"],
    discoveredByAI: false,
  },

  // ── OPENAI — Premium ──────────────────────────────────────────────────────
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    providerId: "openai",
    tier: "PREMIUM" as const,
    contextWindow: 128_000,
    costPer1M: 5.0,
    strengths: ["reasoning", "coding", "multimodal", "structured-output", "analysis"],
    discoveredByAI: false,
  },
  {
    id: "openai/o3",
    name: "OpenAI o3",
    providerId: "openai",
    tier: "PREMIUM" as const,
    contextWindow: 200_000,
    costPer1M: 10.0,
    strengths: ["reasoning", "analysis", "architecture", "context"],
    discoveredByAI: false,
  },
  {
    id: "openai/o4-mini",
    name: "OpenAI o4-mini",
    providerId: "openai",
    tier: "PREMIUM" as const,
    contextWindow: 200_000,
    costPer1M: 1.1,
    strengths: ["reasoning", "coding", "speed", "structured-output"],
    discoveredByAI: false,
  },
  {
    id: "openai/gpt-4.5-preview",
    name: "GPT-4.5 Preview",
    providerId: "openai",
    tier: "PREMIUM" as const,
    contextWindow: 128_000,
    costPer1M: 75.0,
    strengths: ["reasoning", "creative", "analysis"],
    discoveredByAI: false,
  },

  // ── OPENAI — Balanced ─────────────────────────────────────────────────────
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    providerId: "openai",
    tier: "BALANCED" as const,
    contextWindow: 128_000,
    costPer1M: 0.15,
    strengths: ["speed", "coding", "cost-efficient", "structured-output"],
    discoveredByAI: false,
  },
  {
    id: "openai/o3-mini",
    name: "OpenAI o3-mini",
    providerId: "openai",
    tier: "BALANCED" as const,
    contextWindow: 200_000,
    costPer1M: 1.1,
    strengths: ["reasoning", "coding", "speed"],
    discoveredByAI: false,
  },

  // ── GOOGLE — Premium ──────────────────────────────────────────────────────
  {
    id: "google/gemini-2.5-pro-preview",
    name: "Gemini 2.5 Pro Preview",
    providerId: "google",
    tier: "PREMIUM" as const,
    contextWindow: 1_000_000,
    costPer1M: 3.5,
    strengths: ["reasoning", "analysis", "context", "multimodal", "architecture"],
    discoveredByAI: false,
  },

  // ── GOOGLE — Balanced ─────────────────────────────────────────────────────
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    providerId: "google",
    tier: "BALANCED" as const,
    contextWindow: 1_000_000,
    costPer1M: 0.1,
    strengths: ["speed", "context", "cost-efficient", "structured-output"],
    discoveredByAI: false,
  },
  {
    id: "google/gemini-2.5-flash-preview",
    name: "Gemini 2.5 Flash Preview",
    providerId: "google",
    tier: "BALANCED" as const,
    contextWindow: 1_000_000,
    costPer1M: 0.15,
    strengths: ["speed", "reasoning", "context", "cost-efficient"],
    discoveredByAI: false,
  },

  // ── GROQ — Economic ───────────────────────────────────────────────────────
  {
    id: "groq/llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile",
    providerId: "groq",
    tier: "ECONOMIC" as const,
    contextWindow: 128_000,
    costPer1M: 0.59,
    strengths: ["speed", "coding", "cost-efficient", "context"],
    discoveredByAI: false,
  },
  {
    id: "groq/llama-3.1-8b-instant",
    name: "Llama 3.1 8B Instant",
    providerId: "groq",
    tier: "ECONOMIC" as const,
    contextWindow: 128_000,
    costPer1M: 0.05,
    strengths: ["speed", "cost-efficient"],
    discoveredByAI: false,
  },
  {
    id: "groq/deepseek-r1-distill-llama-70b",
    name: "DeepSeek R1 Distill 70B (Groq)",
    providerId: "groq",
    tier: "ECONOMIC" as const,
    contextWindow: 128_000,
    costPer1M: 0.75,
    strengths: ["reasoning", "speed", "cost-efficient"],
    discoveredByAI: false,
  },

  // ── MISTRAL — Balanced ────────────────────────────────────────────────────
  {
    id: "mistral/mistral-large-latest",
    name: "Mistral Large",
    providerId: "mistral",
    tier: "BALANCED" as const,
    contextWindow: 128_000,
    costPer1M: 3.0,
    strengths: ["reasoning", "coding", "structured-output"],
    discoveredByAI: false,
  },
  {
    id: "mistral/codestral-latest",
    name: "Codestral",
    providerId: "mistral",
    tier: "BALANCED" as const,
    contextWindow: 256_000,
    costPer1M: 0.3,
    strengths: ["coding", "speed", "cost-efficient"],
    discoveredByAI: false,
  },

  // ── MISTRAL — Economic ────────────────────────────────────────────────────
  {
    id: "mistral/mistral-small-latest",
    name: "Mistral Small",
    providerId: "mistral",
    tier: "ECONOMIC" as const,
    contextWindow: 32_000,
    costPer1M: 0.1,
    strengths: ["speed", "cost-efficient"],
    discoveredByAI: false,
  },

  // ── DEEPSEEK — Balanced ───────────────────────────────────────────────────
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek V3",
    providerId: "deepseek",
    tier: "BALANCED" as const,
    contextWindow: 64_000,
    costPer1M: 0.14,
    strengths: ["coding", "reasoning", "cost-efficient"],
    discoveredByAI: false,
  },

  // ── DEEPSEEK — Premium (reasoning) ───────────────────────────────────────
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    providerId: "deepseek",
    tier: "PREMIUM" as const,
    contextWindow: 128_000,
    costPer1M: 0.55,
    strengths: ["reasoning", "analysis", "architecture", "coding"],
    discoveredByAI: false,
  },

  // ── XAI — Premium ─────────────────────────────────────────────────────────
  {
    id: "xai/grok-3-beta",
    name: "Grok 3 Beta",
    providerId: "xai",
    tier: "PREMIUM" as const,
    contextWindow: 131_072,
    costPer1M: 3.0,
    strengths: ["reasoning", "analysis", "creative", "context"],
    discoveredByAI: false,
  },

  // ── XAI — Balanced ────────────────────────────────────────────────────────
  {
    id: "xai/grok-3-mini-beta",
    name: "Grok 3 Mini Beta",
    providerId: "xai",
    tier: "BALANCED" as const,
    contextWindow: 131_072,
    costPer1M: 0.3,
    strengths: ["speed", "reasoning", "cost-efficient"],
    discoveredByAI: false,
  },
];

// ─── Seed function ────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding SDD Team Optimizer database...\n");

  // 1. Upsert providers
  console.log(`📦 Upserting ${PROVIDERS.length} providers...`);
  for (const provider of PROVIDERS) {
    await prisma.provider.upsert({
      where: { id: provider.id },
      create: provider,
      update: { name: provider.name },
    });
  }
  console.log("   ✅ Providers seeded.\n");

  // 2. Upsert models
  console.log(`🤖 Upserting ${MODELS.length} models...\n`);

  let seeded = 0;
  let errors = 0;

  for (const model of MODELS) {
    try {
      await prisma.model.upsert({
        where: { id: model.id },
        create: model,
        update: {
          tier: model.tier,
          contextWindow: model.contextWindow,
          costPer1M: model.costPer1M,
          strengths: model.strengths,
          discoveredByAI: false,
        },
      });
      console.log(`   ✅ ${model.id} [${model.tier}]`);
      seeded++;
    } catch (err) {
      console.error(`   ❌ Failed: ${model.id} —`, err);
      errors++;
    }
  }

  console.log("\n─────────────────────────────────────────────────");
  console.log(`✅ Seeded: ${seeded} models`);
  if (errors > 0) {
    console.warn(`⚠  Errors: ${errors} models failed`);
  }

  // 3. Summary per tier
  const summary = await prisma.model.groupBy({
    by: ["tier"],
    _count: { id: true },
    orderBy: { tier: "asc" },
  });

  console.log("\n📊 Database summary:");
  for (const row of summary) {
    console.log(`   ${row.tier}: ${row._count.id} models`);
  }

  const total = await prisma.model.count();
  console.log(`\n   TOTAL: ${total} models in dictionary`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

seed()
  .then(() => {
    console.log("\n🎉 Seed complete.\n");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n💥 Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
