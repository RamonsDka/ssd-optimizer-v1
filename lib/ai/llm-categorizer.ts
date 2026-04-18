// ─── LLM Categorizer — Gemini-based fallback for embedding-service ────────────
// When the local ONNX embedding service is unavailable (production, no native
// bindings), this module uses the Gemini API to produce `ModelCapabilities`
// in exactly the same shape, so all callers work transparently.
//
// Usage:
//   import { categorizeModelViaLLM } from "@/lib/ai/llm-categorizer";
//   const caps = await categorizeModelViaLLM("claude-sonnet-4-5", "Anthropic's balanced model");

import { getGeminiClient } from "@/lib/ai/gemini";
import type { ModelCapabilities } from "@/lib/ai/embedding-service";

// ─── Category slug → Gemini strength tag mapping ────────────────────────────
// The Gemini prompt in gemini.ts asks for strengths from this set:
// "reasoning, coding, architecture, analysis, speed, context, cost-efficient,
//  creative, structured-output, multimodal"
//
// We map those back to the LM-Arena-compatible category slugs that
// embedding-service.ts produces so callers see identical shapes.

const STRENGTH_TO_CATEGORIES: Record<string, string[]> = {
  reasoning:          ["reasoning", "math", "analysis"],
  coding:             ["coding", "function-calling"],
  architecture:       ["planning", "reasoning"],
  analysis:           ["analysis", "reasoning"],
  speed:              ["fast-inference"],
  context:            ["long-context"],
  "cost-efficient":   ["cost-efficiency"],
  creative:           ["creative-writing", "dialogue"],
  "structured-output":["structured-output", "instruction-following"],
  multimodal:         ["multimodal"],
};

// All canonical category slugs mirrored from embedding-service.ts
const ALL_CATEGORIES = [
  "coding",
  "reasoning",
  "analysis",
  "planning",
  "instruction-following",
  "structured-output",
  "long-context",
  "summarization",
  "creative-writing",
  "dialogue",
  "function-calling",
  "tool-use",
  "agent-tasks",
  "math",
  "multimodal",
  "fast-inference",
  "cost-efficiency",
] as const;

type CategorySlug = (typeof ALL_CATEGORIES)[number];

// ─── Base confidence heuristics ───────────────────────────────────────────────
//
// When no strength tag maps to a given category we still want a non-zero
// baseline so that low-signal models aren't unfairly zeroed out.
// These values are intentionally conservative (0.3–0.4).

const BASE_CONFIDENCE: Record<CategorySlug, number> = {
  coding:                0.35,
  reasoning:             0.35,
  analysis:              0.35,
  planning:              0.30,
  "instruction-following": 0.40,
  "structured-output":   0.35,
  "long-context":        0.30,
  summarization:         0.35,
  "creative-writing":    0.25,
  dialogue:              0.40,
  "function-calling":    0.30,
  "tool-use":            0.30,
  "agent-tasks":         0.30,
  math:                  0.30,
  multimodal:            0.25,
  "fast-inference":      0.30,
  "cost-efficiency":     0.30,
};

// Boost applied to a category when a matching strength tag is present.
const STRENGTH_BOOST = 0.50;

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Classify an AI model into LM-Arena capability categories using Gemini LLM
 * analysis instead of local ONNX embeddings.
 *
 * Returns the same `ModelCapabilities` shape as `categorizeModel()` in
 * `embedding-service.ts` so all callers work with either implementation.
 *
 * Falls back to a zero-confidence result if Gemini is not configured or if
 * the API call fails, matching the behaviour of the embedding fallback path.
 *
 * @param modelName   Canonical or human-readable model ID.
 * @param description Optional capability description.
 */
export async function categorizeModelViaLLM(
  modelName: string,
  description: string
): Promise<ModelCapabilities> {
  // Guard: server-side only (same constraint as the embedding service).
  if (typeof window !== "undefined") {
    throw new Error(
      "[LLMCategorizer] categorizeModelViaLLM() must only be called server-side (Node.js)."
    );
  }

  const client = getGeminiClient();

  // Gemini not configured — return zero-confidence result so callers degrade.
  if (client === null) {
    return buildZeroResult();
  }

  try {
    const categorization = await client.categorizeModel(modelName);
    return buildCapabilitiesFromStrengths(categorization.strengths, categorization.confidence);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[LLMCategorizer] Gemini categorization failed for "${modelName}": ${msg}. Returning zero-confidence result.`
    );
    return buildZeroResult();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a `ModelCapabilities` object from a list of Gemini strength tags.
 *
 * Algorithm:
 * 1. Start every category at its conservative base confidence.
 * 2. For each strength tag, boost all mapped category slugs.
 * 3. Clamp to [0, 1].
 * 4. Sort descending by confidence.
 * 5. Overall confidence = average of top-3 categories (mirrors embedding logic).
 *
 * The `geminiConfidence` parameter (0–1) scales the boosts proportionally so
 * that a low-confidence Gemini result produces lower category scores.
 */
function buildCapabilitiesFromStrengths(
  strengths: string[],
  geminiConfidence: number
): ModelCapabilities {
  // Normalise tags to lower-case for robust matching.
  const normStrengths = strengths.map((s) => s.toLowerCase().trim());

  // Start from base confidences.
  const scores: Record<string, number> = {};
  for (const cat of ALL_CATEGORIES) {
    scores[cat] = BASE_CONFIDENCE[cat];
  }

  // Apply boosts from matched strength tags.
  for (const strength of normStrengths) {
    const mapped = STRENGTH_TO_CATEGORIES[strength];
    if (!mapped) continue;
    for (const cat of mapped) {
      if (cat in scores) {
        // Scale boost by Gemini's own confidence (0.5 boost × confidence factor).
        scores[cat] = Math.min(1, (scores[cat] ?? 0) + STRENGTH_BOOST * Math.max(0.2, geminiConfidence));
      }
    }
  }

  // Build sorted array.
  const categories = ALL_CATEGORIES.map((cat) => ({
    category: cat,
    confidence: scores[cat] ?? 0,
  })).sort((a, b) => b.confidence - a.confidence);

  // Overall confidence = average of top-3.
  const top3 = categories.slice(0, 3);
  const overallConfidence =
    top3.length > 0
      ? top3.reduce((sum, c) => sum + c.confidence, 0) / top3.length
      : 0;

  return { categories, overallConfidence };
}

/**
 * Returns a zero-confidence `ModelCapabilities` result.
 * Used when Gemini is unavailable, matching the ONNX fallback path.
 */
function buildZeroResult(): ModelCapabilities {
  const categories = ALL_CATEGORIES.map((cat) => ({
    category: cat,
    confidence: 0,
  }));
  return { categories, overallConfidence: 0 };
}
