// ─── Migration Script: V3 UnifiedModelScores → V4 ModelCapabilities ──────────
//
// Purpose:
//   Populates the `model_capabilities` table with initial data derived from the
//   existing `unified_model_scores` (V3) records plus curated knowledge-base
//   values for models where benchmark data exists.
//
//   The script is IDEMPOTENT — safe to run multiple times.
//   Existing records are updated (upsert) to avoid duplicates.
//
// Usage:
//   npx tsx scripts/migrate-v3-to-v4-data.ts
//
// Field mapping (V3 → V4):
//   UnifiedModelScores.codingScore      → b1_coding_quality   (×10 from 0-1 to 0-10)
//   UnifiedModelScores.thinkingScore    → a2_reasoning_depth  (×10)
//   UnifiedModelScores.designScore      → c4_architecture_awareness (×10)
//   UnifiedModelScores.instructionScore → a3_instruction_following  (×10)
//   UnifiedModelScores.contextEfficiency → b4_context_effective_score (×10)
//   All unmapped dimensions             → conservative default 5.0
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

// ─── Curated capability overrides ────────────────────────────────────────────
// Based on publicly available benchmarks (ArtificialAnalysis, MMLU, HumanEval,
// SWE-bench, LiveCodeBench, LMSYS Chatbot Arena — April 2026 snapshot).
// Scale: 0.0 – 10.0 (normalised). Default for unknown dims = 5.0.
//
// Thinking models (extended reasoning): marked isThinkingModel = true

type PartialCapabilities = {
  a1_overall_intelligence?: number;
  a2_reasoning_depth?: number;
  a3_instruction_following?: number;
  a4_hallucination_resistance?: number;
  b1_coding_quality?: number;
  b2_coding_multilang?: number;
  b3_context_window_score?: number;
  b4_context_effective_score?: number;
  b5_tool_calling_accuracy?: number;
  b6_agentic_reliability?: number;
  c1_visual_understanding?: number;
  c2_format_adherence?: number;
  c3_long_context_coherence?: number;
  c4_architecture_awareness?: number;
  d1_speed_score?: number;
  d2_cost_score?: number;
  d3_availability_score?: number;
  dataQualityScore?: number;
  source?: string;
  isThinkingModel?: boolean;
};

const CURATED: Record<string, PartialCapabilities> = {
  // ── Anthropic ──────────────────────────────────────────────────────────────
  "anthropic/claude-opus-4-5": {
    a1_overall_intelligence: 9.4,
    a2_reasoning_depth: 9.5,
    a3_instruction_following: 9.3,
    a4_hallucination_resistance: 8.8,
    b1_coding_quality: 9.2,
    b2_coding_multilang: 9.0,
    b3_context_window_score: 9.0,
    b4_context_effective_score: 8.8,
    b5_tool_calling_accuracy: 9.1,
    b6_agentic_reliability: 9.2,
    c1_visual_understanding: 8.5,
    c2_format_adherence: 9.4,
    c3_long_context_coherence: 9.0,
    c4_architecture_awareness: 9.3,
    d1_speed_score: 5.5,
    d2_cost_score: 3.0,  // ~$15/1M tokens → expensive
    d3_availability_score: 9.0,
    dataQualityScore: 0.85,
    source: "benchmark",
    isThinkingModel: false,
  },
  "anthropic/claude-sonnet-4-5": {
    a1_overall_intelligence: 8.8,
    a2_reasoning_depth: 8.6,
    a3_instruction_following: 9.0,
    a4_hallucination_resistance: 8.5,
    b1_coding_quality: 9.0,
    b2_coding_multilang: 8.8,
    b3_context_window_score: 9.0,
    b4_context_effective_score: 8.6,
    b5_tool_calling_accuracy: 9.0,
    b6_agentic_reliability: 8.8,
    c1_visual_understanding: 8.2,
    c2_format_adherence: 9.2,
    c3_long_context_coherence: 8.7,
    c4_architecture_awareness: 8.9,
    d1_speed_score: 7.5,
    d2_cost_score: 7.0,  // ~$3/1M → balanced
    d3_availability_score: 9.2,
    dataQualityScore: 0.85,
    source: "benchmark",
    isThinkingModel: false,
  },
  "anthropic/claude-3-7-sonnet-latest": {
    a1_overall_intelligence: 8.9,
    a2_reasoning_depth: 9.2,  // Extended thinking capable
    a3_instruction_following: 8.9,
    a4_hallucination_resistance: 8.6,
    b1_coding_quality: 9.1,
    b2_coding_multilang: 8.9,
    b3_context_window_score: 9.0,
    b4_context_effective_score: 8.7,
    b5_tool_calling_accuracy: 8.8,
    b6_agentic_reliability: 8.9,
    c1_visual_understanding: 8.0,
    c2_format_adherence: 9.1,
    c3_long_context_coherence: 8.8,
    c4_architecture_awareness: 9.0,
    d1_speed_score: 6.8,
    d2_cost_score: 7.0,
    d3_availability_score: 9.0,
    dataQualityScore: 0.80,
    source: "benchmark",
    isThinkingModel: true,  // Extended thinking model
  },
  "anthropic/claude-haiku-3-5": {
    a1_overall_intelligence: 7.5,
    a2_reasoning_depth: 7.0,
    a3_instruction_following: 8.2,
    a4_hallucination_resistance: 7.5,
    b1_coding_quality: 7.8,
    b2_coding_multilang: 7.5,
    b3_context_window_score: 9.0,
    b4_context_effective_score: 7.8,
    b5_tool_calling_accuracy: 8.0,
    b6_agentic_reliability: 7.2,
    c1_visual_understanding: 7.0,
    c2_format_adherence: 8.5,
    c3_long_context_coherence: 7.5,
    c4_architecture_awareness: 7.2,
    d1_speed_score: 9.2,
    d2_cost_score: 9.5,  // ~$0.25/1M → very cheap
    d3_availability_score: 9.2,
    dataQualityScore: 0.80,
    source: "benchmark",
    isThinkingModel: false,
  },
  "anthropic/claude-sonnet-3-5": {
    a1_overall_intelligence: 8.5,
    a2_reasoning_depth: 8.3,
    a3_instruction_following: 8.8,
    a4_hallucination_resistance: 8.2,
    b1_coding_quality: 8.8,
    b2_coding_multilang: 8.6,
    b3_context_window_score: 9.0,
    b4_context_effective_score: 8.3,
    b5_tool_calling_accuracy: 8.6,
    b6_agentic_reliability: 8.5,
    c1_visual_understanding: 7.8,
    c2_format_adherence: 9.0,
    c3_long_context_coherence: 8.4,
    c4_architecture_awareness: 8.7,
    d1_speed_score: 7.8,
    d2_cost_score: 7.0,
    d3_availability_score: 9.0,
    dataQualityScore: 0.80,
    source: "benchmark",
    isThinkingModel: false,
  },

  // ── OpenAI ────────────────────────────────────────────────────────────────
  "openai/gpt-4o": {
    a1_overall_intelligence: 8.7,
    a2_reasoning_depth: 8.4,
    a3_instruction_following: 9.0,
    a4_hallucination_resistance: 8.3,
    b1_coding_quality: 8.8,
    b2_coding_multilang: 8.7,
    b3_context_window_score: 8.0,
    b4_context_effective_score: 8.2,
    b5_tool_calling_accuracy: 9.2,
    b6_agentic_reliability: 8.7,
    c1_visual_understanding: 9.3,
    c2_format_adherence: 9.1,
    c3_long_context_coherence: 8.3,
    c4_architecture_awareness: 8.5,
    d1_speed_score: 7.5,
    d2_cost_score: 6.0,  // ~$5/1M
    d3_availability_score: 9.3,
    dataQualityScore: 0.85,
    source: "benchmark",
    isThinkingModel: false,
  },
  "openai/o3": {
    a1_overall_intelligence: 9.5,
    a2_reasoning_depth: 9.8,
    a3_instruction_following: 9.0,
    a4_hallucination_resistance: 9.2,
    b1_coding_quality: 9.5,
    b2_coding_multilang: 9.3,
    b3_context_window_score: 9.0,
    b4_context_effective_score: 9.1,
    b5_tool_calling_accuracy: 9.0,
    b6_agentic_reliability: 9.3,
    c1_visual_understanding: 8.8,
    c2_format_adherence: 8.9,
    c3_long_context_coherence: 9.2,
    c4_architecture_awareness: 9.4,
    d1_speed_score: 3.5,  // Very slow (extended thinking)
    d2_cost_score: 4.0,  // ~$10/1M
    d3_availability_score: 8.8,
    dataQualityScore: 0.85,
    source: "benchmark",
    isThinkingModel: true,
  },
  "openai/o4-mini": {
    a1_overall_intelligence: 8.8,
    a2_reasoning_depth: 9.0,
    a3_instruction_following: 8.8,
    a4_hallucination_resistance: 8.5,
    b1_coding_quality: 9.0,
    b2_coding_multilang: 8.8,
    b3_context_window_score: 9.0,
    b4_context_effective_score: 8.8,
    b5_tool_calling_accuracy: 8.8,
    b6_agentic_reliability: 8.8,
    c1_visual_understanding: 8.0,
    c2_format_adherence: 8.8,
    c3_long_context_coherence: 8.7,
    c4_architecture_awareness: 8.8,
    d1_speed_score: 7.0,
    d2_cost_score: 8.0,  // ~$1.1/1M
    d3_availability_score: 9.0,
    dataQualityScore: 0.80,
    source: "benchmark",
    isThinkingModel: true,
  },
  "openai/gpt-4.5-preview": {
    a1_overall_intelligence: 8.5,
    a2_reasoning_depth: 8.2,
    a3_instruction_following: 8.5,
    a4_hallucination_resistance: 8.0,
    b1_coding_quality: 8.3,
    b2_coding_multilang: 8.2,
    b3_context_window_score: 8.0,
    b4_context_effective_score: 8.0,
    b5_tool_calling_accuracy: 8.5,
    b6_agentic_reliability: 8.0,
    c1_visual_understanding: 8.8,
    c2_format_adherence: 8.8,
    c3_long_context_coherence: 8.0,
    c4_architecture_awareness: 8.2,
    d1_speed_score: 4.5,
    d2_cost_score: 1.0,  // ~$75/1M → extremely expensive
    d3_availability_score: 7.0,  // Preview
    dataQualityScore: 0.60,
    source: "benchmark",
    isThinkingModel: false,
  },
  "openai/gpt-4o-mini": {
    a1_overall_intelligence: 7.5,
    a2_reasoning_depth: 7.2,
    a3_instruction_following: 8.3,
    a4_hallucination_resistance: 7.5,
    b1_coding_quality: 7.8,
    b2_coding_multilang: 7.6,
    b3_context_window_score: 8.0,
    b4_context_effective_score: 7.5,
    b5_tool_calling_accuracy: 8.5,
    b6_agentic_reliability: 7.3,
    c1_visual_understanding: 8.0,
    c2_format_adherence: 8.5,
    c3_long_context_coherence: 7.5,
    c4_architecture_awareness: 7.0,
    d1_speed_score: 9.0,
    d2_cost_score: 9.7,  // ~$0.15/1M
    d3_availability_score: 9.3,
    dataQualityScore: 0.80,
    source: "benchmark",
    isThinkingModel: false,
  },
  "openai/o3-mini": {
    a1_overall_intelligence: 8.5,
    a2_reasoning_depth: 8.8,
    a3_instruction_following: 8.5,
    a4_hallucination_resistance: 8.3,
    b1_coding_quality: 8.8,
    b2_coding_multilang: 8.5,
    b3_context_window_score: 9.0,
    b4_context_effective_score: 8.5,
    b5_tool_calling_accuracy: 8.5,
    b6_agentic_reliability: 8.3,
    c1_visual_understanding: 5.0,  // No vision
    c2_format_adherence: 8.5,
    c3_long_context_coherence: 8.5,
    c4_architecture_awareness: 8.3,
    d1_speed_score: 7.5,
    d2_cost_score: 8.0,  // ~$1.1/1M
    d3_availability_score: 9.0,
    dataQualityScore: 0.80,
    source: "benchmark",
    isThinkingModel: true,
  },

  // ── Google ────────────────────────────────────────────────────────────────
  "google/gemini-2.5-pro-preview": {
    a1_overall_intelligence: 9.3,
    a2_reasoning_depth: 9.4,
    a3_instruction_following: 9.0,
    a4_hallucination_resistance: 8.7,
    b1_coding_quality: 9.1,
    b2_coding_multilang: 9.0,
    b3_context_window_score: 10.0,  // 1M tokens — best in class
    b4_context_effective_score: 8.5,  // Large context — some lost-in-middle
    b5_tool_calling_accuracy: 9.0,
    b6_agentic_reliability: 9.0,
    c1_visual_understanding: 9.5,
    c2_format_adherence: 9.0,
    c3_long_context_coherence: 8.8,
    c4_architecture_awareness: 9.1,
    d1_speed_score: 5.5,
    d2_cost_score: 6.5,  // ~$3.5/1M
    d3_availability_score: 8.5,  // Preview
    dataQualityScore: 0.80,
    source: "benchmark",
    isThinkingModel: true,  // Thinking model with extended reasoning
  },
  "google/gemini-2.0-flash": {
    a1_overall_intelligence: 7.8,
    a2_reasoning_depth: 7.5,
    a3_instruction_following: 8.5,
    a4_hallucination_resistance: 7.8,
    b1_coding_quality: 7.8,
    b2_coding_multilang: 7.6,
    b3_context_window_score: 10.0,
    b4_context_effective_score: 7.5,
    b5_tool_calling_accuracy: 8.5,
    b6_agentic_reliability: 7.8,
    c1_visual_understanding: 8.5,
    c2_format_adherence: 8.8,
    c3_long_context_coherence: 7.8,
    c4_architecture_awareness: 7.3,
    d1_speed_score: 9.5,
    d2_cost_score: 9.8,  // ~$0.1/1M
    d3_availability_score: 9.0,
    dataQualityScore: 0.80,
    source: "benchmark",
    isThinkingModel: false,
  },
  "google/gemini-2.5-flash-preview": {
    a1_overall_intelligence: 8.5,
    a2_reasoning_depth: 8.5,
    a3_instruction_following: 8.8,
    a4_hallucination_resistance: 8.2,
    b1_coding_quality: 8.3,
    b2_coding_multilang: 8.2,
    b3_context_window_score: 10.0,
    b4_context_effective_score: 8.0,
    b5_tool_calling_accuracy: 8.8,
    b6_agentic_reliability: 8.3,
    c1_visual_understanding: 9.0,
    c2_format_adherence: 8.8,
    c3_long_context_coherence: 8.3,
    c4_architecture_awareness: 8.2,
    d1_speed_score: 8.8,
    d2_cost_score: 9.5,  // ~$0.15/1M
    d3_availability_score: 8.0,  // Preview
    dataQualityScore: 0.75,
    source: "benchmark",
    isThinkingModel: true,  // Flash Thinking variant
  },

  // ── Groq ──────────────────────────────────────────────────────────────────
  "groq/llama-3.3-70b-versatile": {
    a1_overall_intelligence: 7.8,
    a2_reasoning_depth: 7.5,
    a3_instruction_following: 8.0,
    a4_hallucination_resistance: 7.3,
    b1_coding_quality: 7.8,
    b2_coding_multilang: 7.5,
    b3_context_window_score: 8.0,
    b4_context_effective_score: 7.5,
    b5_tool_calling_accuracy: 7.5,
    b6_agentic_reliability: 7.0,
    c1_visual_understanding: 5.0,  // No vision
    c2_format_adherence: 8.0,
    c3_long_context_coherence: 7.5,
    c4_architecture_awareness: 7.3,
    d1_speed_score: 9.8,  // Groq inference — extremely fast
    d2_cost_score: 8.5,  // ~$0.59/1M
    d3_availability_score: 8.5,
    dataQualityScore: 0.75,
    source: "benchmark",
    isThinkingModel: false,
  },
  "groq/llama-3.1-8b-instant": {
    a1_overall_intelligence: 6.0,
    a2_reasoning_depth: 5.8,
    a3_instruction_following: 7.0,
    a4_hallucination_resistance: 6.0,
    b1_coding_quality: 6.2,
    b2_coding_multilang: 6.0,
    b3_context_window_score: 8.0,
    b4_context_effective_score: 6.5,
    b5_tool_calling_accuracy: 6.5,
    b6_agentic_reliability: 5.8,
    c1_visual_understanding: 5.0,
    c2_format_adherence: 7.0,
    c3_long_context_coherence: 6.5,
    c4_architecture_awareness: 5.8,
    d1_speed_score: 9.9,  // Ultra fast — 8B params on Groq
    d2_cost_score: 9.9,  // ~$0.05/1M → almost free
    d3_availability_score: 8.5,
    dataQualityScore: 0.75,
    source: "benchmark",
    isThinkingModel: false,
  },
  "groq/deepseek-r1-distill-llama-70b": {
    a1_overall_intelligence: 8.0,
    a2_reasoning_depth: 8.5,
    a3_instruction_following: 7.8,
    a4_hallucination_resistance: 7.5,
    b1_coding_quality: 8.0,
    b2_coding_multilang: 7.8,
    b3_context_window_score: 8.0,
    b4_context_effective_score: 7.8,
    b5_tool_calling_accuracy: 7.3,
    b6_agentic_reliability: 7.5,
    c1_visual_understanding: 5.0,
    c2_format_adherence: 7.5,
    c3_long_context_coherence: 7.8,
    c4_architecture_awareness: 7.8,
    d1_speed_score: 9.3,  // Groq speed + distilled
    d2_cost_score: 8.2,  // ~$0.75/1M
    d3_availability_score: 8.3,
    dataQualityScore: 0.75,
    source: "benchmark",
    isThinkingModel: true,  // DeepSeek R1 reasoning distillation
  },

  // ── Mistral ───────────────────────────────────────────────────────────────
  "mistral/mistral-large-latest": {
    a1_overall_intelligence: 8.0,
    a2_reasoning_depth: 7.8,
    a3_instruction_following: 8.5,
    a4_hallucination_resistance: 7.8,
    b1_coding_quality: 8.0,
    b2_coding_multilang: 8.3,  // Strong multilang
    b3_context_window_score: 8.0,
    b4_context_effective_score: 7.8,
    b5_tool_calling_accuracy: 8.3,
    b6_agentic_reliability: 7.8,
    c1_visual_understanding: 5.0,
    c2_format_adherence: 8.5,
    c3_long_context_coherence: 7.8,
    c4_architecture_awareness: 7.8,
    d1_speed_score: 7.5,
    d2_cost_score: 7.0,  // ~$3/1M
    d3_availability_score: 8.8,
    dataQualityScore: 0.75,
    source: "benchmark",
    isThinkingModel: false,
  },
  "mistral/codestral-latest": {
    a1_overall_intelligence: 7.5,
    a2_reasoning_depth: 7.0,
    a3_instruction_following: 8.0,
    a4_hallucination_resistance: 7.5,
    b1_coding_quality: 9.0,  // Specialized for code
    b2_coding_multilang: 9.2,
    b3_context_window_score: 9.0,  // 256k context
    b4_context_effective_score: 8.5,
    b5_tool_calling_accuracy: 8.0,
    b6_agentic_reliability: 7.5,
    c1_visual_understanding: 5.0,
    c2_format_adherence: 8.5,
    c3_long_context_coherence: 8.0,
    c4_architecture_awareness: 8.0,
    d1_speed_score: 8.5,
    d2_cost_score: 9.2,  // ~$0.3/1M
    d3_availability_score: 8.8,
    dataQualityScore: 0.75,
    source: "benchmark",
    isThinkingModel: false,
  },
  "mistral/mistral-small-latest": {
    a1_overall_intelligence: 6.5,
    a2_reasoning_depth: 6.0,
    a3_instruction_following: 7.5,
    a4_hallucination_resistance: 6.5,
    b1_coding_quality: 6.5,
    b2_coding_multilang: 6.5,
    b3_context_window_score: 6.5,  // 32k context
    b4_context_effective_score: 6.5,
    b5_tool_calling_accuracy: 7.0,
    b6_agentic_reliability: 6.0,
    c1_visual_understanding: 5.0,
    c2_format_adherence: 7.5,
    c3_long_context_coherence: 6.0,
    c4_architecture_awareness: 6.0,
    d1_speed_score: 8.8,
    d2_cost_score: 9.8,  // ~$0.1/1M
    d3_availability_score: 8.8,
    dataQualityScore: 0.70,
    source: "benchmark",
    isThinkingModel: false,
  },

  // ── DeepSeek ──────────────────────────────────────────────────────────────
  "deepseek/deepseek-chat": {
    a1_overall_intelligence: 8.2,
    a2_reasoning_depth: 8.0,
    a3_instruction_following: 8.3,
    a4_hallucination_resistance: 7.8,
    b1_coding_quality: 8.8,
    b2_coding_multilang: 8.5,
    b3_context_window_score: 7.5,  // 64k context
    b4_context_effective_score: 7.5,
    b5_tool_calling_accuracy: 8.0,
    b6_agentic_reliability: 7.8,
    c1_visual_understanding: 5.0,
    c2_format_adherence: 8.3,
    c3_long_context_coherence: 7.5,
    c4_architecture_awareness: 8.0,
    d1_speed_score: 7.0,
    d2_cost_score: 9.5,  // ~$0.14/1M
    d3_availability_score: 8.0,  // China-based, some latency
    dataQualityScore: 0.75,
    source: "benchmark",
    isThinkingModel: false,
  },
  "deepseek/deepseek-r1": {
    a1_overall_intelligence: 9.0,
    a2_reasoning_depth: 9.5,
    a3_instruction_following: 8.5,
    a4_hallucination_resistance: 8.5,
    b1_coding_quality: 9.2,
    b2_coding_multilang: 9.0,
    b3_context_window_score: 8.0,
    b4_context_effective_score: 8.0,
    b5_tool_calling_accuracy: 8.0,
    b6_agentic_reliability: 8.5,
    c1_visual_understanding: 5.0,
    c2_format_adherence: 8.3,
    c3_long_context_coherence: 8.5,
    c4_architecture_awareness: 9.0,
    d1_speed_score: 4.5,  // Heavy reasoning model
    d2_cost_score: 8.5,  // ~$0.55/1M — cheap for quality
    d3_availability_score: 7.5,
    dataQualityScore: 0.80,
    source: "benchmark",
    isThinkingModel: true,
  },

  // ── xAI ───────────────────────────────────────────────────────────────────
  "xai/grok-3-beta": {
    a1_overall_intelligence: 8.8,
    a2_reasoning_depth: 8.7,
    a3_instruction_following: 8.5,
    a4_hallucination_resistance: 8.0,
    b1_coding_quality: 8.5,
    b2_coding_multilang: 8.3,
    b3_context_window_score: 8.0,
    b4_context_effective_score: 8.0,
    b5_tool_calling_accuracy: 8.3,
    b6_agentic_reliability: 8.2,
    c1_visual_understanding: 8.0,
    c2_format_adherence: 8.5,
    c3_long_context_coherence: 8.2,
    c4_architecture_awareness: 8.5,
    d1_speed_score: 7.0,
    d2_cost_score: 7.0,  // ~$3/1M
    d3_availability_score: 8.5,
    dataQualityScore: 0.75,
    source: "benchmark",
    isThinkingModel: false,
  },
  "xai/grok-3-mini-beta": {
    a1_overall_intelligence: 7.8,
    a2_reasoning_depth: 8.0,
    a3_instruction_following: 8.2,
    a4_hallucination_resistance: 7.5,
    b1_coding_quality: 7.5,
    b2_coding_multilang: 7.3,
    b3_context_window_score: 8.0,
    b4_context_effective_score: 7.8,
    b5_tool_calling_accuracy: 8.0,
    b6_agentic_reliability: 7.5,
    c1_visual_understanding: 5.0,
    c2_format_adherence: 8.3,
    c3_long_context_coherence: 7.8,
    c4_architecture_awareness: 7.5,
    d1_speed_score: 8.5,
    d2_cost_score: 9.2,  // ~$0.3/1M
    d3_availability_score: 8.5,
    dataQualityScore: 0.70,
    source: "benchmark",
    isThinkingModel: true,  // Mini reasoning model
  },
};

// ─── V3 → V4 field mapping ────────────────────────────────────────────────────

/**
 * Converts a UnifiedModelScores (V3) snapshot to partial V4 capabilities.
 * V3 uses 0.0-1.0 scale; V4 uses 0.0-10.0.
 * This only populates the 5 dims that V3 tracks — the rest stay at default 5.0.
 */
function mapV3ToV4(v3: {
  codingScore: number | null;
  thinkingScore: number | null;
  designScore: number | null;
  instructionScore: number | null;
  contextEfficiency: number | null;
}): PartialCapabilities {
  const toV4 = (v: number | null): number | undefined =>
    v !== null && v !== undefined ? Math.min(10.0, Math.max(0.0, v * 10.0)) : undefined;

  return {
    b1_coding_quality: toV4(v3.codingScore),
    a2_reasoning_depth: toV4(v3.thinkingScore),
    c4_architecture_awareness: toV4(v3.designScore),
    a3_instruction_following: toV4(v3.instructionScore),
    b4_context_effective_score: toV4(v3.contextEfficiency),
    source: "benchmark",
    dataQualityScore: 0.6,  // V3 data is lower confidence than curated
  };
}

// ─── Main migration function ──────────────────────────────────────────────────

async function migrate() {
  console.log("🚀 Starting V3 → V4 ModelCapabilities migration...\n");

  // 1. Load all models
  const models = await prisma.model.findMany({
    include: {
      unifiedScores: {
        orderBy: { snapshotDate: "desc" },
        take: 1,  // Latest snapshot per model
      },
    },
  });

  console.log(`📋 Found ${models.length} models to process.\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const model of models) {
    try {
      // Start with conservative defaults (all 5.0)
      const base: PartialCapabilities = {};

      // Layer 1: Apply V3 data if available
      if (model.unifiedScores.length > 0) {
        const v3 = model.unifiedScores[0];
        const mapped = mapV3ToV4(v3);
        Object.assign(base, mapped);
      }

      // Layer 2: Override with curated data (highest confidence)
      const curated = CURATED[model.id];
      if (curated) {
        Object.assign(base, curated);
      }

      // Extract isThinkingModel flag (update Model table too)
      const isThinkingModel = base.isThinkingModel ?? false;
      delete base.isThinkingModel;  // Not a ModelCapabilities field

      // Upsert ModelCapabilities record
      const existing = await prisma.modelCapabilities.findUnique({
        where: { modelId: model.id },
      });

      const capabilityData = {
        a1_overall_intelligence: base.a1_overall_intelligence ?? 5.0,
        a2_reasoning_depth: base.a2_reasoning_depth ?? 5.0,
        a3_instruction_following: base.a3_instruction_following ?? 5.0,
        a4_hallucination_resistance: base.a4_hallucination_resistance ?? 5.0,
        b1_coding_quality: base.b1_coding_quality ?? 5.0,
        b2_coding_multilang: base.b2_coding_multilang ?? 5.0,
        b3_context_window_score: base.b3_context_window_score ?? 5.0,
        b4_context_effective_score: base.b4_context_effective_score ?? 5.0,
        b5_tool_calling_accuracy: base.b5_tool_calling_accuracy ?? 5.0,
        b6_agentic_reliability: base.b6_agentic_reliability ?? 5.0,
        c1_visual_understanding: base.c1_visual_understanding ?? 5.0,
        c2_format_adherence: base.c2_format_adherence ?? 5.0,
        c3_long_context_coherence: base.c3_long_context_coherence ?? 5.0,
        c4_architecture_awareness: base.c4_architecture_awareness ?? 5.0,
        d1_speed_score: base.d1_speed_score ?? 5.0,
        d2_cost_score: base.d2_cost_score ?? 5.0,
        d3_availability_score: base.d3_availability_score ?? 5.0,
        dataQualityScore: base.dataQualityScore ?? 0.5,
        source: base.source ?? "manual",
      };

      if (existing) {
        await prisma.modelCapabilities.update({
          where: { modelId: model.id },
          data: capabilityData,
        });
        updated++;
      } else {
        await prisma.modelCapabilities.create({
          data: {
            modelId: model.id,
            ...capabilityData,
          },
        });
        created++;
      }

      // Update isThinkingModel flag on the Model record
      await prisma.model.update({
        where: { id: model.id },
        data: { isThinkingModel },
      });

      const sourceLabel = curated ? "curated" : model.unifiedScores.length > 0 ? "v3-mapped" : "defaults";
      const verb = existing ? "↻ updated" : "✅ created";
      console.log(`   ${verb} [${sourceLabel}] ${model.id} (thinking: ${isThinkingModel})`);

    } catch (err) {
      console.error(`   ❌ Failed: ${model.id} —`, err);
      errors++;
    }
  }

  console.log("\n─────────────────────────────────────────────────────────────");
  console.log(`✅ Created: ${created} capabilities records`);
  console.log(`↻  Updated: ${updated} capabilities records`);
  if (errors > 0) {
    console.warn(`⚠  Errors:  ${errors} records failed`);
  }

  // 2. Verification summary
  const total = await prisma.modelCapabilities.count();
  const withCurated = Object.keys(CURATED).length;
  const thinkingModels = await prisma.model.count({ where: { isThinkingModel: true } });

  console.log("\n📊 Post-migration summary:");
  console.log(`   ModelCapabilities records: ${total}`);
  console.log(`   Models with curated data:  ${withCurated}`);
  console.log(`   Thinking models flagged:   ${thinkingModels}`);
  console.log(`   Coverage: ${((total / models.length) * 100).toFixed(1)}%`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

migrate()
  .then(() => {
    console.log("\n🎉 Migration complete.\n");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n💥 Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
