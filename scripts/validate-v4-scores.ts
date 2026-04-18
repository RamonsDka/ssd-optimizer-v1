// ─── V4 Score Validation Script ───────────────────────────────────────────────
//
// Compara los scores V3 vs V4 para los 24 modelos curados en el sistema,
// verifica que los scores V4 están en rango 0-10, y verifica que las reglas
// especiales se aplican correctamente.
//
// Genera un reporte de comparación detallado en consola y en archivo Markdown.
//
// Uso:
//   npx tsx scripts/validate-v4-scores.ts
//   npm run validate:v4
//
// No requiere conexión a DB — usa los datos curados del script de migración.
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from "node:fs";
import * as path from "node:path";
import {
  calculatePhaseScore,
  finalScore,
  EXCLUSION_SCORE,
  isExcluded,
} from "../lib/optimizer/v4/scoring-engine-v4";
import type { ModelV4, UserProfileV4, ModelCapabilitiesV4 } from "../lib/optimizer/v4/scoring-engine-v4";
import type { SddPhaseV4 } from "../lib/optimizer/v4/phase-weights";

// ─── Perfil estándar para comparación ────────────────────────────────────────

const STANDARD_PROFILE: UserProfileV4 = {
  profileId: "premium",
  allowedTiers: ["PREMIUM", "BALANCED", "ECONOMIC"],
  excludedTiers: [],
};

// ─── Dataset de 24 modelos curados (mismo que migrate-v3-to-v4-data.ts) ──────
// Extraído del CURATED object del script de migración.

type CuratedModel = {
  modelId: string;
  provider: string;
  tier: "PREMIUM" | "BALANCED" | "ECONOMIC";
  isThinkingModel: boolean;
  contextWindowTokens: number;
  capabilities: ModelCapabilitiesV4;
  // Score V3 estimado (0-1 scale) para comparación
  v3EstimatedScore?: number;
};

const CURATED_MODELS: CuratedModel[] = [
  // ── Anthropic ──────────────────────────────────────────────────────────────
  {
    modelId: "anthropic/claude-opus-4-5",
    provider: "anthropic",
    tier: "PREMIUM",
    isThinkingModel: false,
    contextWindowTokens: 200_000,
    capabilities: {
      modelId: "anthropic/claude-opus-4-5",
      a1_overall_intelligence: 9.4, a2_reasoning_depth: 9.5, a3_instruction_following: 9.3, a4_hallucination_resistance: 8.8,
      b1_coding_quality: 9.2, b2_coding_multilang: 9.0, b3_context_window_score: 9.0, b4_context_effective_score: 8.8,
      b5_tool_calling_accuracy: 9.1, b6_agentic_reliability: 9.2,
      c1_visual_understanding: 8.5, c2_format_adherence: 9.4, c3_long_context_coherence: 9.0, c4_architecture_awareness: 9.3,
      d1_speed_score: 5.5, d2_cost_score: 3.0, d3_availability_score: 9.0,
    },
  },
  {
    modelId: "anthropic/claude-sonnet-4-5",
    provider: "anthropic",
    tier: "BALANCED",
    isThinkingModel: false,
    contextWindowTokens: 200_000,
    capabilities: {
      modelId: "anthropic/claude-sonnet-4-5",
      a1_overall_intelligence: 8.8, a2_reasoning_depth: 8.6, a3_instruction_following: 9.0, a4_hallucination_resistance: 8.5,
      b1_coding_quality: 9.0, b2_coding_multilang: 8.8, b3_context_window_score: 9.0, b4_context_effective_score: 8.6,
      b5_tool_calling_accuracy: 9.0, b6_agentic_reliability: 8.8,
      c1_visual_understanding: 8.2, c2_format_adherence: 9.2, c3_long_context_coherence: 8.7, c4_architecture_awareness: 8.9,
      d1_speed_score: 7.5, d2_cost_score: 7.0, d3_availability_score: 9.2,
    },
  },
  {
    modelId: "anthropic/claude-3-7-sonnet-latest",
    provider: "anthropic",
    tier: "BALANCED",
    isThinkingModel: true,
    contextWindowTokens: 200_000,
    capabilities: {
      modelId: "anthropic/claude-3-7-sonnet-latest",
      a1_overall_intelligence: 8.9, a2_reasoning_depth: 9.2, a3_instruction_following: 8.9, a4_hallucination_resistance: 8.6,
      b1_coding_quality: 9.1, b2_coding_multilang: 8.9, b3_context_window_score: 9.0, b4_context_effective_score: 8.7,
      b5_tool_calling_accuracy: 8.8, b6_agentic_reliability: 8.9,
      c1_visual_understanding: 8.0, c2_format_adherence: 9.1, c3_long_context_coherence: 8.8, c4_architecture_awareness: 9.0,
      d1_speed_score: 6.8, d2_cost_score: 7.0, d3_availability_score: 9.0,
    },
  },
  {
    modelId: "anthropic/claude-haiku-3-5",
    provider: "anthropic",
    tier: "ECONOMIC",
    isThinkingModel: false,
    contextWindowTokens: 200_000,
    capabilities: {
      modelId: "anthropic/claude-haiku-3-5",
      a1_overall_intelligence: 7.5, a2_reasoning_depth: 7.0, a3_instruction_following: 8.2, a4_hallucination_resistance: 7.5,
      b1_coding_quality: 7.8, b2_coding_multilang: 7.5, b3_context_window_score: 9.0, b4_context_effective_score: 7.8,
      b5_tool_calling_accuracy: 8.0, b6_agentic_reliability: 7.2,
      c1_visual_understanding: 7.0, c2_format_adherence: 8.5, c3_long_context_coherence: 7.5, c4_architecture_awareness: 7.2,
      d1_speed_score: 9.2, d2_cost_score: 9.5, d3_availability_score: 9.2,
    },
  },
  {
    modelId: "anthropic/claude-sonnet-3-5",
    provider: "anthropic",
    tier: "BALANCED",
    isThinkingModel: false,
    contextWindowTokens: 200_000,
    capabilities: {
      modelId: "anthropic/claude-sonnet-3-5",
      a1_overall_intelligence: 8.5, a2_reasoning_depth: 8.3, a3_instruction_following: 8.8, a4_hallucination_resistance: 8.2,
      b1_coding_quality: 8.8, b2_coding_multilang: 8.6, b3_context_window_score: 9.0, b4_context_effective_score: 8.3,
      b5_tool_calling_accuracy: 8.6, b6_agentic_reliability: 8.5,
      c1_visual_understanding: 7.8, c2_format_adherence: 9.0, c3_long_context_coherence: 8.4, c4_architecture_awareness: 8.7,
      d1_speed_score: 7.8, d2_cost_score: 7.0, d3_availability_score: 9.0,
    },
  },

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  {
    modelId: "openai/gpt-4o",
    provider: "openai",
    tier: "PREMIUM",
    isThinkingModel: false,
    contextWindowTokens: 128_000,
    capabilities: {
      modelId: "openai/gpt-4o",
      a1_overall_intelligence: 8.7, a2_reasoning_depth: 8.4, a3_instruction_following: 9.0, a4_hallucination_resistance: 8.3,
      b1_coding_quality: 8.8, b2_coding_multilang: 8.7, b3_context_window_score: 8.0, b4_context_effective_score: 8.2,
      b5_tool_calling_accuracy: 9.2, b6_agentic_reliability: 8.7,
      c1_visual_understanding: 9.3, c2_format_adherence: 9.1, c3_long_context_coherence: 8.3, c4_architecture_awareness: 8.5,
      d1_speed_score: 7.5, d2_cost_score: 6.0, d3_availability_score: 9.3,
    },
  },
  {
    modelId: "openai/o3",
    provider: "openai",
    tier: "PREMIUM",
    isThinkingModel: true,
    contextWindowTokens: 200_000,
    capabilities: {
      modelId: "openai/o3",
      a1_overall_intelligence: 9.5, a2_reasoning_depth: 9.8, a3_instruction_following: 9.0, a4_hallucination_resistance: 9.2,
      b1_coding_quality: 9.5, b2_coding_multilang: 9.3, b3_context_window_score: 9.0, b4_context_effective_score: 9.1,
      b5_tool_calling_accuracy: 9.0, b6_agentic_reliability: 9.3,
      c1_visual_understanding: 8.8, c2_format_adherence: 8.9, c3_long_context_coherence: 9.2, c4_architecture_awareness: 9.4,
      d1_speed_score: 3.5, d2_cost_score: 4.0, d3_availability_score: 8.8,
    },
  },
  {
    modelId: "openai/o4-mini",
    provider: "openai",
    tier: "BALANCED",
    isThinkingModel: true,
    contextWindowTokens: 200_000,
    capabilities: {
      modelId: "openai/o4-mini",
      a1_overall_intelligence: 8.8, a2_reasoning_depth: 9.0, a3_instruction_following: 8.8, a4_hallucination_resistance: 8.5,
      b1_coding_quality: 9.0, b2_coding_multilang: 8.8, b3_context_window_score: 9.0, b4_context_effective_score: 8.8,
      b5_tool_calling_accuracy: 8.8, b6_agentic_reliability: 8.8,
      c1_visual_understanding: 8.0, c2_format_adherence: 8.8, c3_long_context_coherence: 8.7, c4_architecture_awareness: 8.8,
      d1_speed_score: 7.0, d2_cost_score: 8.0, d3_availability_score: 9.0,
    },
  },
  {
    modelId: "openai/gpt-4.5-preview",
    provider: "openai",
    tier: "PREMIUM",
    isThinkingModel: false,
    contextWindowTokens: 128_000,
    capabilities: {
      modelId: "openai/gpt-4.5-preview",
      a1_overall_intelligence: 8.5, a2_reasoning_depth: 8.2, a3_instruction_following: 8.5, a4_hallucination_resistance: 8.0,
      b1_coding_quality: 8.3, b2_coding_multilang: 8.2, b3_context_window_score: 8.0, b4_context_effective_score: 8.0,
      b5_tool_calling_accuracy: 8.5, b6_agentic_reliability: 8.0,
      c1_visual_understanding: 8.8, c2_format_adherence: 8.8, c3_long_context_coherence: 8.0, c4_architecture_awareness: 8.2,
      d1_speed_score: 4.5, d2_cost_score: 1.0, d3_availability_score: 7.0,
    },
  },
  {
    modelId: "openai/gpt-4o-mini",
    provider: "openai",
    tier: "ECONOMIC",
    isThinkingModel: false,
    contextWindowTokens: 128_000,
    capabilities: {
      modelId: "openai/gpt-4o-mini",
      a1_overall_intelligence: 7.5, a2_reasoning_depth: 7.2, a3_instruction_following: 8.3, a4_hallucination_resistance: 7.5,
      b1_coding_quality: 7.8, b2_coding_multilang: 7.6, b3_context_window_score: 8.0, b4_context_effective_score: 7.5,
      b5_tool_calling_accuracy: 8.5, b6_agentic_reliability: 7.3,
      c1_visual_understanding: 8.0, c2_format_adherence: 8.5, c3_long_context_coherence: 7.5, c4_architecture_awareness: 7.0,
      d1_speed_score: 9.0, d2_cost_score: 9.7, d3_availability_score: 9.3,
    },
  },
  {
    modelId: "openai/o3-mini",
    provider: "openai",
    tier: "BALANCED",
    isThinkingModel: true,
    contextWindowTokens: 200_000,
    capabilities: {
      modelId: "openai/o3-mini",
      a1_overall_intelligence: 8.5, a2_reasoning_depth: 8.8, a3_instruction_following: 8.5, a4_hallucination_resistance: 8.3,
      b1_coding_quality: 8.8, b2_coding_multilang: 8.5, b3_context_window_score: 9.0, b4_context_effective_score: 8.5,
      b5_tool_calling_accuracy: 8.5, b6_agentic_reliability: 8.3,
      c1_visual_understanding: 5.0, c2_format_adherence: 8.5, c3_long_context_coherence: 8.5, c4_architecture_awareness: 8.3,
      d1_speed_score: 7.5, d2_cost_score: 8.0, d3_availability_score: 9.0,
    },
  },

  // ── Google ─────────────────────────────────────────────────────────────────
  {
    modelId: "google/gemini-2.5-pro-preview",
    provider: "google",
    tier: "PREMIUM",
    isThinkingModel: true,
    contextWindowTokens: 1_000_000,
    capabilities: {
      modelId: "google/gemini-2.5-pro-preview",
      a1_overall_intelligence: 9.3, a2_reasoning_depth: 9.4, a3_instruction_following: 9.0, a4_hallucination_resistance: 8.7,
      b1_coding_quality: 9.1, b2_coding_multilang: 9.0, b3_context_window_score: 10.0, b4_context_effective_score: 8.5,
      b5_tool_calling_accuracy: 9.0, b6_agentic_reliability: 9.0,
      c1_visual_understanding: 9.5, c2_format_adherence: 9.0, c3_long_context_coherence: 8.8, c4_architecture_awareness: 9.1,
      d1_speed_score: 5.5, d2_cost_score: 6.5, d3_availability_score: 8.5,
    },
  },
  {
    modelId: "google/gemini-2.0-flash",
    provider: "google",
    tier: "ECONOMIC",
    isThinkingModel: false,
    contextWindowTokens: 1_000_000,
    capabilities: {
      modelId: "google/gemini-2.0-flash",
      a1_overall_intelligence: 7.8, a2_reasoning_depth: 7.5, a3_instruction_following: 8.5, a4_hallucination_resistance: 7.8,
      b1_coding_quality: 7.8, b2_coding_multilang: 7.6, b3_context_window_score: 10.0, b4_context_effective_score: 7.5,
      b5_tool_calling_accuracy: 8.5, b6_agentic_reliability: 7.8,
      c1_visual_understanding: 8.5, c2_format_adherence: 8.8, c3_long_context_coherence: 7.8, c4_architecture_awareness: 7.3,
      d1_speed_score: 9.5, d2_cost_score: 9.8, d3_availability_score: 9.0,
    },
  },
  {
    modelId: "google/gemini-2.5-flash-preview",
    provider: "google",
    tier: "BALANCED",
    isThinkingModel: true,
    contextWindowTokens: 1_000_000,
    capabilities: {
      modelId: "google/gemini-2.5-flash-preview",
      a1_overall_intelligence: 8.5, a2_reasoning_depth: 8.5, a3_instruction_following: 8.8, a4_hallucination_resistance: 8.2,
      b1_coding_quality: 8.3, b2_coding_multilang: 8.2, b3_context_window_score: 10.0, b4_context_effective_score: 8.0,
      b5_tool_calling_accuracy: 8.8, b6_agentic_reliability: 8.3,
      c1_visual_understanding: 9.0, c2_format_adherence: 8.8, c3_long_context_coherence: 8.3, c4_architecture_awareness: 8.2,
      d1_speed_score: 8.8, d2_cost_score: 9.5, d3_availability_score: 8.0,
    },
  },

  // ── Groq ───────────────────────────────────────────────────────────────────
  {
    modelId: "groq/llama-3.3-70b-versatile",
    provider: "groq",
    tier: "ECONOMIC",
    isThinkingModel: false,
    contextWindowTokens: 128_000,
    capabilities: {
      modelId: "groq/llama-3.3-70b-versatile",
      a1_overall_intelligence: 7.8, a2_reasoning_depth: 7.5, a3_instruction_following: 8.0, a4_hallucination_resistance: 7.3,
      b1_coding_quality: 7.8, b2_coding_multilang: 7.5, b3_context_window_score: 8.0, b4_context_effective_score: 7.5,
      b5_tool_calling_accuracy: 7.5, b6_agentic_reliability: 7.0,
      c1_visual_understanding: 5.0, c2_format_adherence: 8.0, c3_long_context_coherence: 7.5, c4_architecture_awareness: 7.3,
      d1_speed_score: 9.8, d2_cost_score: 8.5, d3_availability_score: 8.5,
    },
  },
  {
    modelId: "groq/llama-3.1-8b-instant",
    provider: "groq",
    tier: "ECONOMIC",
    isThinkingModel: false,
    contextWindowTokens: 128_000,
    capabilities: {
      modelId: "groq/llama-3.1-8b-instant",
      a1_overall_intelligence: 6.0, a2_reasoning_depth: 5.8, a3_instruction_following: 7.0, a4_hallucination_resistance: 6.0,
      b1_coding_quality: 6.2, b2_coding_multilang: 6.0, b3_context_window_score: 8.0, b4_context_effective_score: 6.5,
      b5_tool_calling_accuracy: 6.5, b6_agentic_reliability: 5.8,
      c1_visual_understanding: 5.0, c2_format_adherence: 7.0, c3_long_context_coherence: 6.5, c4_architecture_awareness: 5.8,
      d1_speed_score: 9.9, d2_cost_score: 9.9, d3_availability_score: 8.5,
    },
  },
  {
    modelId: "groq/deepseek-r1-distill-llama-70b",
    provider: "groq",
    tier: "ECONOMIC",
    isThinkingModel: true,
    contextWindowTokens: 128_000,
    capabilities: {
      modelId: "groq/deepseek-r1-distill-llama-70b",
      a1_overall_intelligence: 8.0, a2_reasoning_depth: 8.5, a3_instruction_following: 7.8, a4_hallucination_resistance: 7.5,
      b1_coding_quality: 8.0, b2_coding_multilang: 7.8, b3_context_window_score: 8.0, b4_context_effective_score: 7.8,
      b5_tool_calling_accuracy: 7.3, b6_agentic_reliability: 7.5,
      c1_visual_understanding: 5.0, c2_format_adherence: 7.5, c3_long_context_coherence: 7.8, c4_architecture_awareness: 7.8,
      d1_speed_score: 9.3, d2_cost_score: 8.2, d3_availability_score: 8.3,
    },
  },

  // ── Mistral ────────────────────────────────────────────────────────────────
  {
    modelId: "mistral/mistral-large-latest",
    provider: "mistral",
    tier: "BALANCED",
    isThinkingModel: false,
    contextWindowTokens: 128_000,
    capabilities: {
      modelId: "mistral/mistral-large-latest",
      a1_overall_intelligence: 8.0, a2_reasoning_depth: 7.8, a3_instruction_following: 8.5, a4_hallucination_resistance: 7.8,
      b1_coding_quality: 8.0, b2_coding_multilang: 8.3, b3_context_window_score: 8.0, b4_context_effective_score: 7.8,
      b5_tool_calling_accuracy: 8.3, b6_agentic_reliability: 7.8,
      c1_visual_understanding: 5.0, c2_format_adherence: 8.5, c3_long_context_coherence: 7.8, c4_architecture_awareness: 7.8,
      d1_speed_score: 7.5, d2_cost_score: 7.0, d3_availability_score: 8.8,
    },
  },
  {
    modelId: "mistral/codestral-latest",
    provider: "mistral",
    tier: "BALANCED",
    isThinkingModel: false,
    contextWindowTokens: 256_000,
    capabilities: {
      modelId: "mistral/codestral-latest",
      a1_overall_intelligence: 7.5, a2_reasoning_depth: 7.0, a3_instruction_following: 8.0, a4_hallucination_resistance: 7.5,
      b1_coding_quality: 9.0, b2_coding_multilang: 9.2, b3_context_window_score: 9.0, b4_context_effective_score: 8.5,
      b5_tool_calling_accuracy: 8.0, b6_agentic_reliability: 7.5,
      c1_visual_understanding: 5.0, c2_format_adherence: 8.5, c3_long_context_coherence: 8.0, c4_architecture_awareness: 8.0,
      d1_speed_score: 8.5, d2_cost_score: 9.2, d3_availability_score: 8.8,
    },
  },
  {
    modelId: "mistral/mistral-small-latest",
    provider: "mistral",
    tier: "ECONOMIC",
    isThinkingModel: false,
    contextWindowTokens: 32_000,
    capabilities: {
      modelId: "mistral/mistral-small-latest",
      a1_overall_intelligence: 6.5, a2_reasoning_depth: 6.0, a3_instruction_following: 7.5, a4_hallucination_resistance: 6.5,
      b1_coding_quality: 6.5, b2_coding_multilang: 6.5, b3_context_window_score: 6.5, b4_context_effective_score: 6.5,
      b5_tool_calling_accuracy: 7.0, b6_agentic_reliability: 6.0,
      c1_visual_understanding: 5.0, c2_format_adherence: 7.5, c3_long_context_coherence: 6.0, c4_architecture_awareness: 6.0,
      d1_speed_score: 8.8, d2_cost_score: 9.8, d3_availability_score: 8.8,
    },
  },

  // ── DeepSeek ───────────────────────────────────────────────────────────────
  {
    modelId: "deepseek/deepseek-chat",
    provider: "deepseek",
    tier: "ECONOMIC",
    isThinkingModel: false,
    contextWindowTokens: 64_000,
    capabilities: {
      modelId: "deepseek/deepseek-chat",
      a1_overall_intelligence: 8.2, a2_reasoning_depth: 8.0, a3_instruction_following: 8.3, a4_hallucination_resistance: 7.8,
      b1_coding_quality: 8.8, b2_coding_multilang: 8.5, b3_context_window_score: 7.5, b4_context_effective_score: 7.5,
      b5_tool_calling_accuracy: 8.0, b6_agentic_reliability: 7.8,
      c1_visual_understanding: 5.0, c2_format_adherence: 8.3, c3_long_context_coherence: 7.5, c4_architecture_awareness: 8.0,
      d1_speed_score: 7.0, d2_cost_score: 9.5, d3_availability_score: 8.0,
    },
  },
  {
    modelId: "deepseek/deepseek-r1",
    provider: "deepseek",
    tier: "ECONOMIC",
    isThinkingModel: true,
    contextWindowTokens: 64_000,
    capabilities: {
      modelId: "deepseek/deepseek-r1",
      a1_overall_intelligence: 9.0, a2_reasoning_depth: 9.5, a3_instruction_following: 8.5, a4_hallucination_resistance: 8.5,
      b1_coding_quality: 9.2, b2_coding_multilang: 9.0, b3_context_window_score: 8.0, b4_context_effective_score: 8.0,
      b5_tool_calling_accuracy: 8.0, b6_agentic_reliability: 8.5,
      c1_visual_understanding: 5.0, c2_format_adherence: 8.3, c3_long_context_coherence: 8.5, c4_architecture_awareness: 9.0,
      d1_speed_score: 4.5, d2_cost_score: 8.5, d3_availability_score: 7.5,
    },
  },

  // ── xAI ────────────────────────────────────────────────────────────────────
  {
    modelId: "xai/grok-3-beta",
    provider: "xai",
    tier: "BALANCED",
    isThinkingModel: false,
    contextWindowTokens: 131_072,
    capabilities: {
      modelId: "xai/grok-3-beta",
      a1_overall_intelligence: 8.8, a2_reasoning_depth: 8.7, a3_instruction_following: 8.5, a4_hallucination_resistance: 8.0,
      b1_coding_quality: 8.5, b2_coding_multilang: 8.3, b3_context_window_score: 8.0, b4_context_effective_score: 8.0,
      b5_tool_calling_accuracy: 8.3, b6_agentic_reliability: 8.2,
      c1_visual_understanding: 8.0, c2_format_adherence: 8.5, c3_long_context_coherence: 8.2, c4_architecture_awareness: 8.5,
      d1_speed_score: 7.0, d2_cost_score: 7.0, d3_availability_score: 8.5,
    },
  },
  {
    modelId: "xai/grok-3-mini-beta",
    provider: "xai",
    tier: "ECONOMIC",
    isThinkingModel: true,
    contextWindowTokens: 131_072,
    capabilities: {
      modelId: "xai/grok-3-mini-beta",
      a1_overall_intelligence: 7.8, a2_reasoning_depth: 8.0, a3_instruction_following: 8.2, a4_hallucination_resistance: 7.5,
      b1_coding_quality: 7.5, b2_coding_multilang: 7.3, b3_context_window_score: 8.0, b4_context_effective_score: 7.8,
      b5_tool_calling_accuracy: 8.0, b6_agentic_reliability: 7.5,
      c1_visual_understanding: 5.0, c2_format_adherence: 8.3, c3_long_context_coherence: 7.8, c4_architecture_awareness: 7.5,
      d1_speed_score: 8.5, d2_cost_score: 9.2, d3_availability_score: 8.5,
    },
  },
];

// ─── Fases a evaluar ──────────────────────────────────────────────────────────

const PHASES: SddPhaseV4[] = [
  "orchestrator", "init", "explore", "propose", "spec",
  "design", "tasks", "apply", "verify", "archive", "onboard",
];

// ─── V3 Estimado (para comparación) ──────────────────────────────────────────
// Simulamos un score V3 promedio basado en las 5 dimensiones que V3 trackea.
// V3 usa: codingScore, thinkingScore, designScore, instructionScore, contextEfficiency
// (todas en 0-1 scale). Calculamos el promedio normalizado como proxy.

function estimateV3Score(caps: ModelCapabilitiesV4): number {
  const codingScore = caps.b1_coding_quality / 10.0;
  const thinkingScore = caps.a2_reasoning_depth / 10.0;
  const designScore = caps.c4_architecture_awareness / 10.0;
  const instructionScore = caps.a3_instruction_following / 10.0;
  const contextEfficiency = caps.b4_context_effective_score / 10.0;

  // Requirimiento vector promedio de V3 (simplificado):
  // coding: 0.2, thinking: 0.25, design: 0.2, instruction: 0.2, context: 0.15
  const v3Score =
    codingScore * 0.2 +
    thinkingScore * 0.25 +
    designScore * 0.2 +
    instructionScore * 0.2 +
    contextEfficiency * 0.15;

  return Math.min(1.0, Math.max(0.0, v3Score));
}

// ─── Reporte ──────────────────────────────────────────────────────────────────

interface ModelPhaseResult {
  modelId: string;
  phase: SddPhaseV4;
  isThinkingModel: boolean;
  v4Score: number;       // En escala [0, 10]
  v3Estimated: number;   // En escala [0, 1]
  v4Normalized: number;  // V4 en escala [0, 1] para comparar con V3
  delta: number;         // v4Normalized - v3Estimated
  excluded: boolean;
  exclusionReason?: string;
  specialRulesApplied: string[];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  console.log("═".repeat(70));
  console.log("V4 Score Validation Report");
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Models: ${CURATED_MODELS.length} | Phases: ${PHASES.length}`);
  console.log("═".repeat(70));
  console.log();

  const results: ModelPhaseResult[] = [];
  let validationErrors = 0;
  let validationWarnings = 0;

  // ── Calcular scores para todos los modelos × fases ─────────────────────────
  for (const curatedModel of CURATED_MODELS) {
    const modelV4: ModelV4 = {
      modelId: curatedModel.modelId,
      isThinkingModel: curatedModel.isThinkingModel,
      contextWindowTokens: curatedModel.contextWindowTokens,
      provider: curatedModel.provider,
      tier: curatedModel.tier,
      capabilities: curatedModel.capabilities,
    };

    for (const phase of PHASES) {
      const result = finalScore(modelV4, phase, STANDARD_PROFILE);
      const v3Est = estimateV3Score(curatedModel.capabilities);

      const v4Normalized = result.excluded ? 0 : result.finalScore / 10.0;

      results.push({
        modelId: curatedModel.modelId,
        phase,
        isThinkingModel: curatedModel.isThinkingModel,
        v4Score: result.excluded ? EXCLUSION_SCORE : result.finalScore,
        v3Estimated: v3Est,
        v4Normalized,
        delta: v4Normalized - v3Est,
        excluded: result.excluded,
        exclusionReason: result.exclusionReason,
        specialRulesApplied: result.specialRulesApplied,
      });

      // Verificar rango [0, 10] para scores no excluidos
      if (!result.excluded && (result.finalScore < 0 || result.finalScore > 10)) {
        console.error(`❌ ERROR: Score fuera de rango [0,10] para ${curatedModel.modelId} en ${phase}: ${result.finalScore}`);
        validationErrors++;
      }
    }
  }

  // ── Verificación 1: Todos los scores V4 en rango [0, 10] ──────────────────
  console.log("─".repeat(70));
  console.log("CHECK 1: Scores V4 en rango [0.0, 10.0]");
  console.log("─".repeat(70));
  const outOfRange = results.filter(
    (r) => !r.excluded && (r.v4Score < 0 || r.v4Score > 10)
  );
  if (outOfRange.length === 0) {
    console.log(`✅ PASS — Todos los ${results.filter((r) => !r.excluded).length} scores no-excluidos están en [0, 10]`);
  } else {
    console.log(`❌ FAIL — ${outOfRange.length} scores fuera de rango:`);
    for (const r of outOfRange) {
      console.log(`   ${r.modelId} / ${r.phase}: ${r.v4Score}`);
    }
    validationErrors += outOfRange.length;
  }
  console.log();

  // ── Verificación 2: Reglas especiales anti-thinking ───────────────────────
  console.log("─".repeat(70));
  console.log("CHECK 2: Reglas anti-thinking en fases orchestrator, tasks, archive");
  console.log("─".repeat(70));
  const antiThinkingPhases = ["orchestrator", "tasks", "archive"] as const;
  let antiThinkingOk = true;

  for (const phase of antiThinkingPhases) {
    const thinkingModelsInPhase = results.filter(
      (r) => r.phase === phase && r.isThinkingModel
    );
    const notExcluded = thinkingModelsInPhase.filter((r) => !r.excluded);

    if (notExcluded.length === 0) {
      console.log(`✅ ${phase}: todos los thinking models excluidos correctamente (${thinkingModelsInPhase.length} models)`);
    } else {
      console.log(`❌ ${phase}: ${notExcluded.length} thinking models NO excluidos:`);
      for (const r of notExcluded) {
        console.log(`   ${r.modelId}: score=${r.v4Score.toFixed(4)}`);
      }
      validationErrors++;
      antiThinkingOk = false;
    }
  }
  if (antiThinkingOk) {
    console.log("✅ PASS — Anti-thinking rules aplicadas correctamente en todas las fases");
  }
  console.log();

  // ── Verificación 3: Prefer-thinking en explore, propose, verify ───────────
  console.log("─".repeat(70));
  console.log("CHECK 3: Prefer-thinking en fases explore, propose, verify");
  console.log("─".repeat(70));
  const preferThinkingPhases = ["explore", "propose", "verify"] as const;
  let preferThinkingOk = true;

  for (const phase of preferThinkingPhases) {
    const thinkingResults = results.filter(
      (r) => r.phase === phase && r.isThinkingModel && !r.excluded
    );
    const modelsWithBonus = thinkingResults.filter((r) =>
      r.specialRulesApplied.includes("prefer-thinking-bonus")
    );

    if (modelsWithBonus.length === thinkingResults.length && thinkingResults.length > 0) {
      console.log(`✅ ${phase}: ${modelsWithBonus.length} thinking models recibieron bonus`);
    } else {
      console.log(`⚠️  ${phase}: ${modelsWithBonus.length}/${thinkingResults.length} thinking models con bonus`);
      validationWarnings++;
      preferThinkingOk = false;
    }
  }
  if (preferThinkingOk) {
    console.log("✅ PASS — Prefer-thinking bonus aplicado correctamente");
  }
  console.log();

  // ── Verificación 4: Contexto mínimo para orchestrator ─────────────────────
  console.log("─".repeat(70));
  console.log("CHECK 4: Exclusión por contexto mínimo (orchestrator requiere 260k)");
  console.log("─".repeat(70));
  const smallContextModels = CURATED_MODELS.filter(
    (m) => m.contextWindowTokens < 260_000
  );
  const orchestratorResults = results.filter((r) => r.phase === "orchestrator");
  let contextCheckOk = true;

  for (const model of smallContextModels) {
    const orchResult = orchestratorResults.find((r) => r.modelId === model.modelId);
    if (orchResult && !orchResult.excluded) {
      // Puede que sea excluido por anti-thinking o por contexto
      // Solo reportamos si no es thinking model (si es thinking, ya está excluido por otra razón)
      if (!model.isThinkingModel) {
        console.log(`❌ ${model.modelId} (${(model.contextWindowTokens / 1000).toFixed(0)}k ctx) debería ser excluido en orchestrator por contexto insuficiente`);
        validationErrors++;
        contextCheckOk = false;
      }
    } else if (orchResult?.excluded) {
      const reason = orchResult.exclusionReason ?? "unknown";
      console.log(`✅ ${model.modelId} (${(model.contextWindowTokens / 1000).toFixed(0)}k ctx): excluido correctamente — "${reason.substring(0, 60)}"`);
    }
  }
  if (contextCheckOk) {
    console.log("✅ PASS — Exclusiones por contexto mínimo aplicadas correctamente");
  }
  console.log();

  // ── Comparación V3 vs V4 — top diferencias ────────────────────────────────
  console.log("─".repeat(70));
  console.log("COMPARISON: V3 Estimado vs V4 — Top 10 diferencias más grandes");
  console.log("─".repeat(70));

  const nonExcluded = results.filter((r) => !r.excluded);
  const sortedByDelta = [...nonExcluded].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta)
  );

  console.log(
    "Model".padEnd(42) +
    "Phase".padEnd(14) +
    "V3-est".padEnd(10) +
    "V4-norm".padEnd(10) +
    "Delta"
  );
  console.log("─".repeat(90));

  for (const r of sortedByDelta.slice(0, 10)) {
    const deltaStr = r.delta >= 0 ? `+${r.delta.toFixed(3)}` : r.delta.toFixed(3);
    const modelShort = r.modelId.length > 40 ? r.modelId.substring(0, 39) + "…" : r.modelId;
    console.log(
      modelShort.padEnd(42) +
      r.phase.padEnd(14) +
      r.v3Estimated.toFixed(3).padEnd(10) +
      r.v4Normalized.toFixed(3).padEnd(10) +
      deltaStr
    );
  }
  console.log();

  // ── Estadísticas globales ──────────────────────────────────────────────────
  const excludedCount = results.filter((r) => r.excluded).length;
  const activeCount = results.length - excludedCount;
  const avgDelta = nonExcluded.reduce((sum, r) => sum + r.delta, 0) / nonExcluded.length;
  const modelsWithHigherV4 = nonExcluded.filter((r) => r.delta > 0.05).length;
  const modelsWithLowerV4 = nonExcluded.filter((r) => r.delta < -0.05).length;

  console.log("─".repeat(70));
  console.log("SUMMARY STATISTICS");
  console.log("─".repeat(70));
  console.log(`  Total model×phase combinations: ${results.length}`);
  console.log(`  Excluded (anti-thinking/context): ${excludedCount} (${((excludedCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`  Active scores: ${activeCount}`);
  console.log(`  Avg delta V4-V3: ${avgDelta >= 0 ? "+" : ""}${avgDelta.toFixed(4)}`);
  console.log(`  Scores where V4 > V3 (>+0.05): ${modelsWithHigherV4}`);
  console.log(`  Scores where V4 < V3 (<-0.05): ${modelsWithLowerV4}`);
  console.log();

  // ── Tabla por modelo (resumen propose score) ───────────────────────────────
  console.log("─".repeat(70));
  console.log("MODEL SCORES — propose phase (most impactful, sorted by V4 score)");
  console.log("─".repeat(70));
  const proposeResults = results
    .filter((r) => r.phase === "propose")
    .sort((a, b) => b.v4Normalized - a.v4Normalized);

  console.log("Model".padEnd(42) + "Thinking".padEnd(10) + "V3-est".padEnd(10) + "V4-norm".padEnd(10) + "Status");
  console.log("─".repeat(90));

  for (const r of proposeResults) {
    const modelShort = r.modelId.length > 40 ? r.modelId.substring(0, 39) + "…" : r.modelId;
    const status = r.excluded ? `EXCL: ${r.exclusionReason?.substring(0, 20)}` : `active (rules: [${r.specialRulesApplied.join(",")}])`;
    console.log(
      modelShort.padEnd(42) +
      String(r.isThinkingModel).padEnd(10) +
      r.v3Estimated.toFixed(3).padEnd(10) +
      (r.excluded ? "EXCL".padEnd(10) : r.v4Normalized.toFixed(3).padEnd(10)) +
      status
    );
  }
  console.log();

  // ── Resultado final de validación ─────────────────────────────────────────
  console.log("═".repeat(70));
  if (validationErrors === 0 && validationWarnings === 0) {
    console.log(`✅ VALIDATION PASSED — ${results.length} combinations verified`);
    console.log(`   ${CURATED_MODELS.length} models × ${PHASES.length} phases`);
    console.log(`   ${excludedCount} exclusions applied (anti-thinking + context)`);
    console.log(`   0 errors, 0 warnings`);
  } else if (validationErrors === 0) {
    console.log(`⚠️  VALIDATION PASSED WITH WARNINGS`);
    console.log(`   ${validationWarnings} warnings, 0 errors`);
  } else {
    console.log(`❌ VALIDATION FAILED`);
    console.log(`   ${validationErrors} errors, ${validationWarnings} warnings`);
  }
  console.log("═".repeat(70));

  // ── Escribir reporte en archivo ────────────────────────────────────────────
  const reportPath = path.join(process.cwd(), "docs", "v4-validation-report.md");

  try {
    const docsDir = path.dirname(reportPath);
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const mdLines: string[] = [
      "# V4 Score Validation Report",
      "",
      `> Generated: ${new Date().toISOString()}`,
      `> Models evaluated: ${CURATED_MODELS.length}`,
      `> Phases evaluated: ${PHASES.length}`,
      `> Total combinations: ${results.length}`,
      "",
      "## Validation Summary",
      "",
      `| Check | Status | Details |`,
      `|-------|--------|---------|`,
      `| Scores in [0,10] range | ${outOfRange.length === 0 ? "✅ PASS" : "❌ FAIL"} | ${outOfRange.length === 0 ? `All ${results.filter((r) => !r.excluded).length} active scores valid` : `${outOfRange.length} out of range`} |`,
      `| Anti-thinking rules | ${antiThinkingOk ? "✅ PASS" : "❌ FAIL"} | orchestrator, tasks, archive |`,
      `| Prefer-thinking bonus | ${preferThinkingOk ? "✅ PASS" : "⚠️ WARN"} | explore, propose, verify |`,
      `| Context min (orchestrator) | ${contextCheckOk ? "✅ PASS" : "❌ FAIL"} | 260k token minimum |`,
      "",
      "## Statistics",
      "",
      `- **Excluded** (anti-thinking + context): ${excludedCount} (${((excludedCount / results.length) * 100).toFixed(1)}%)`,
      `- **Active scores**: ${activeCount}`,
      `- **Avg delta V4 vs V3**: ${avgDelta >= 0 ? "+" : ""}${avgDelta.toFixed(4)}`,
      `- **V4 > V3 (+0.05)**: ${modelsWithHigherV4} combinations`,
      `- **V4 < V3 (-0.05)**: ${modelsWithLowerV4} combinations`,
      "",
      "## Top Differences V3 vs V4",
      "",
      "| Model | Phase | V3-est | V4-norm | Delta |",
      "|-------|-------|--------|---------|-------|",
    ];

    for (const r of sortedByDelta.slice(0, 15)) {
      const deltaStr = r.delta >= 0 ? `+${r.delta.toFixed(3)}` : r.delta.toFixed(3);
      mdLines.push(`| \`${r.modelId}\` | ${r.phase} | ${r.v3Estimated.toFixed(3)} | ${r.v4Normalized.toFixed(3)} | ${deltaStr} |`);
    }

    mdLines.push("", "## Propose Phase Ranking (V4)", "");
    mdLines.push("| Model | Thinking | V3-est | V4-norm | Rules Applied |");
    mdLines.push("|-------|----------|--------|---------|---------------|");

    for (const r of proposeResults) {
      const v4Str = r.excluded ? "EXCL" : r.v4Normalized.toFixed(3);
      const rulesStr = r.specialRulesApplied.length > 0 ? r.specialRulesApplied.join(", ") : "-";
      mdLines.push(`| \`${r.modelId}\` | ${r.isThinkingModel ? "✓" : "—"} | ${r.v3Estimated.toFixed(3)} | ${v4Str} | ${rulesStr} |`);
    }

    fs.writeFileSync(reportPath, mdLines.join("\n"), "utf-8");
    console.log(`\n📄 Report saved to: ${reportPath}`);
  } catch (err) {
    console.warn(`⚠️  Could not write report file: ${err}`);
  }

  // Exit con código de error si hay fallos
  if (validationErrors > 0) {
    process.exit(1);
  }
}

main();
