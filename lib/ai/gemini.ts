// ─── Gemini AI Client — Model Categorization ─────────────────────────────────
// Uses @google/genai SDK to categorize unknown models into SDD tier/metadata.

import { GoogleGenAI } from "@google/genai";
import type { GeminiCategorization, SddPhase, Tier } from "@/types";
import { SDD_PHASES } from "@/types";

// ─── Validation helpers (no Zod — manual type guards) ─────────────────────

const VALID_TIERS = new Set<Tier>(["PREMIUM", "BALANCED", "ECONOMIC"]);

function isValidTier(v: unknown): v is Tier {
  return typeof v === "string" && VALID_TIERS.has(v as Tier);
}

function isValidSddPhase(v: unknown): v is SddPhase {
  return typeof v === "string" && (SDD_PHASES as string[]).includes(v);
}

function assertCategorization(obj: unknown): GeminiCategorization {
  if (!obj || typeof obj !== "object") {
    throw new Error("Gemini response is not an object");
  }
  const o = obj as Record<string, unknown>;

  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) throw new Error("Missing `id` in Gemini response");

  const name = typeof o.name === "string" ? o.name.trim() : id;

  const providerId = typeof o.providerId === "string" ? o.providerId.trim() : "";
  if (!providerId) throw new Error("Missing `providerId` in Gemini response");

  if (!isValidTier(o.tier)) {
    throw new Error(`Invalid tier: ${String(o.tier)}`);
  }

  const contextWindow =
    typeof o.contextWindow === "number" && o.contextWindow > 0
      ? Math.round(o.contextWindow)
      : 32000;

  const costPer1M =
    typeof o.costPer1M === "number" && o.costPer1M >= 0 ? o.costPer1M : 0;

  const strengths = Array.isArray(o.strengths)
    ? (o.strengths as unknown[])
        .filter((s) => typeof s === "string")
        .map((s) => (s as string).trim())
        .filter(Boolean)
    : [];

  // Validate best_phases if present — filter out invalid values
  const rawPhases = Array.isArray(o.best_phases) ? o.strengths : [];
  void rawPhases; // not used directly in the shape — kept in strengths

  const confidence =
    typeof o.confidence === "number"
      ? Math.max(0, Math.min(1, o.confidence))
      : 0.5;

  const reasoning =
    typeof o.reasoning === "string" ? o.reasoning.trim() : "";

  return {
    id,
    name,
    providerId,
    tier: o.tier as Tier,
    contextWindow,
    costPer1M,
    strengths,
    confidence,
    reasoning,
  };
}

// ─── Gemini Client ─────────────────────────────────────────────────────────

export class GeminiAIClient {
  private readonly client: GoogleGenAI;
  private readonly model = "gemini-2.0-flash";
  private readonly maxRetries = 3;
  private readonly perModelTimeoutMs = 12_000;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. AI categorization is unavailable."
      );
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * Categorize a single unknown model ID into SDD metadata.
   * Retries up to 3 times on rate-limit / server errors.
   */
  async categorizeModel(modelId: string): Promise<GeminiCategorization> {
    const prompt = buildCategorizationPrompt(modelId);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.1,
            maxOutputTokens: 512,
          },
        });

        const text = response.text?.trim();
        if (!text) {
          throw new Error("Empty response from Gemini");
        }

        // Parse JSON — handle ```json ... ``` fences
        const jsonText = text.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
        const parsed: unknown = JSON.parse(jsonText);
        return assertCategorization(parsed);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Only retry on retryable errors
        if (!isRetryableError(lastError) || attempt === this.maxRetries) {
          break;
        }

        // Exponential backoff: 500ms, 1s, 2s
        await sleep(500 * Math.pow(2, attempt - 1));
      }
    }

    throw lastError ?? new Error("Unknown error during Gemini categorization");
  }

  /**
   * Batch categorize multiple unknown models.
   * Sequential — respects Gemini rate limits.
   */
  async categorizeModels(
    modelIds: string[]
  ): Promise<Map<string, GeminiCategorization | null>> {
    const results = new Map<string, GeminiCategorization | null>();

    for (const id of modelIds) {
      try {
        const cat = await withTimeout(
          this.categorizeModel(id),
          this.perModelTimeoutMs,
          `Gemini categorization timed out for ${id}`
        );
        results.set(id, cat);
      } catch {
        // Non-fatal: model remains unresolved
        results.set(id, null);
      }
    }

    return results;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildCategorizationPrompt(modelId: string): string {
  return `You are an AI model database expert. Categorize this AI model for the SDD (Spec-Driven Development) workflow.

Model ID: "${modelId}"

Respond ONLY with a JSON object matching this schema:
{
  "id": "<canonical model id, preserve provider/model format>",
  "name": "<human-readable name>",
  "providerId": "<provider slug, e.g. anthropic, openai, google, groq, mistral, deepseek, xai>",
  "tier": "<PREMIUM | BALANCED | ECONOMIC>",
  "contextWindow": <context window in tokens, integer>,
  "costPer1M": <estimated cost per 1M tokens in USD, float>,
  "strengths": ["<tag1>", "<tag2>", ...],
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation>"
}

Tier guidelines:
- PREMIUM: flagship models (GPT-4o, Claude Sonnet 4+, Gemini 2.5 Pro) — best quality, higher cost
- BALANCED: mid-tier models (Claude Haiku, GPT-4o-mini, Gemini Flash) — good quality, moderate cost
- ECONOMIC: fast/cheap models (small open-source, free-tier, instruct models) — lower cost, lower capability

Strength tags (use relevant ones): reasoning, coding, architecture, analysis, speed, context, cost-efficient, creative, structured-output, multimodal

If you don't recognize the model, make your best estimate and set confidence to a low value (0.2-0.4).`;
}

function isRetryableError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("500") ||
    msg.includes("unavailable")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// ─── Singleton + feature flag ──────────────────────────────────────────────

let _client: GeminiAIClient | null = null;

export function getGeminiClient(): GeminiAIClient | null {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    _client ??= new GeminiAIClient();
    return _client;
  } catch {
    return null;
  }
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
