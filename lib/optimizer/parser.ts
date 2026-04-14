// ─── Model List Parser ───────────────────────────────────────────────────────
// Normalizes raw text from `opencode models` output into canonical model IDs.

import type { ParsedModel } from "@/types";

// ─── Alias Map — common human-readable names → canonical IDs ─────────────────

const ALIAS_MAP: Record<string, string> = {
  // Anthropic
  "claude-opus-4":          "anthropic/claude-opus-4-5",
  "claude-sonnet-4":        "anthropic/claude-sonnet-4-5",
  "claude-haiku-3-5":       "anthropic/claude-haiku-3-5",
  "claude-3-5-sonnet":      "anthropic/claude-sonnet-3-5",
  "claude-3-5-haiku":       "anthropic/claude-haiku-3-5",
  "claude-3-7-sonnet":      "anthropic/claude-3-7-sonnet-latest",
  "claude-3-opus":          "anthropic/claude-3-opus-20240229",
  "claude-sonnet":          "anthropic/claude-sonnet-4-5",
  "claude-haiku":           "anthropic/claude-haiku-3-5",
  "claude-opus":            "anthropic/claude-opus-4-5",

  // OpenAI
  "gpt-4o":                 "openai/gpt-4o",
  "gpt-4o-mini":            "openai/gpt-4o-mini",
  "gpt-4-turbo":            "openai/gpt-4-turbo",
  "gpt-4.5":                "openai/gpt-4.5-preview",
  "gpt-o3":                 "openai/o3",
  "gpt-o3-mini":            "openai/o3-mini",
  "gpt-o4-mini":            "openai/o4-mini",
  "o1":                     "openai/o1",
  "o1-mini":                "openai/o1-mini",
  "o3":                     "openai/o3",
  "o3-mini":                "openai/o3-mini",
  "o4-mini":                "openai/o4-mini",

  // Google
  "gemini-2.0-flash":       "google/gemini-2.0-flash",
  "gemini-2.5-pro":         "google/gemini-2.5-pro-preview",
  "gemini-2.5-flash":       "google/gemini-2.5-flash-preview",
  "gemini-flash":           "google/gemini-2.0-flash",
  "gemini-pro":             "google/gemini-2.5-pro-preview",

  // Groq / meta
  "llama-3.3-70b":          "groq/llama-3.3-70b-versatile",
  "llama-3.1-8b":           "groq/llama-3.1-8b-instant",
  "llama-70b":              "groq/llama-3.3-70b-versatile",
  "llama-8b":               "groq/llama-3.1-8b-instant",

  // Mistral
  "mistral-large":          "mistral/mistral-large-latest",
  "mistral-small":          "mistral/mistral-small-latest",
  "codestral":              "mistral/codestral-latest",

  // Deepseek
  "deepseek-r1":            "deepseek/deepseek-r1",
  "deepseek-v3":            "deepseek/deepseek-chat",
  "deepseek-chat":          "deepseek/deepseek-chat",

  // xAI
  "grok-3":                 "xai/grok-3-beta",
  "grok-3-mini":            "xai/grok-3-mini-beta",
  "grok-2":                 "xai/grok-2-latest",
};

// ─── Version suffix patterns (applied to the last segment only) ──────────────

const VERSION_SUFFIX_PATTERNS: RegExp[] = [
  /-\d{4}-\d{2}-\d{2}$/,       // ISO date: -2024-05-13
  /-\d{8}$/,                    // Compact date: -20240513
  /-\d{4}$/,                    // 4-digit date: -0528
  /-latest$/,
  /-preview(-\d+)?$/,
  /-stable$/,
  /-exp(-\d+)?$/,
  /-turbo$/,                    // trailing -turbo duplicates
  /-online$/,
  /-fast$/,
];

// ─── Separator normalization ───────────────────────────────────────────────

/**
 * Split raw model list text into individual raw entries.
 * Handles: newlines, commas, semicolons, pipes, tabs.
 */
function splitEntries(raw: string): string[] {
  return raw
    .split(/[\n\r,;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Strip leading/trailing quotes (single, double, backtick).
 */
function stripQuotes(s: string): [string, boolean] {
  const stripped = s.replace(/^["'`]|["'`]$/g, "");
  return [stripped, stripped !== s];
}

/**
 * Normalize whitespace: collapse inner spaces/tabs to single space,
 * then replace spaces with hyphens (for IDs like "claude sonnet").
 */
function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, "-");
}

/**
 * Strip version suffixes from the LAST path segment only.
 * E.g. "provider/org/model-0528" → "provider/org/model"
 */
function stripVersionSuffix(s: string): [string, boolean] {
  const slashIdx = s.lastIndexOf("/");
  const prefix = slashIdx >= 0 ? s.slice(0, slashIdx + 1) : "";
  let segment = slashIdx >= 0 ? s.slice(slashIdx + 1) : s;

  let stripped = false;
  for (const pattern of VERSION_SUFFIX_PATTERNS) {
    const next = segment.replace(pattern, "");
    if (next !== segment) {
      segment = next;
      stripped = true;
      break; // one pass is enough
    }
  }

  return [prefix + segment, stripped];
}

/**
 * Try alias expansion: look up the fully lowercased string in ALIAS_MAP.
 * Returns the canonical ID or undefined if not in map.
 */
function expandAlias(s: string): [string, boolean] {
  const lower = s.toLowerCase();
  if (ALIAS_MAP[lower]) {
    return [ALIAS_MAP[lower], true];
  }
  return [s, false];
}

/**
 * Detect if the string already looks like a canonical "provider/model" ID.
 * A valid ID must contain at least one slash.
 */
function looksCanonical(s: string): boolean {
  return s.includes("/");
}

// ─── Main: parseModelList ───────────────────────────────────────────────────

/**
 * Parse a raw model list string (from `opencode models` output or manual paste)
 * into an array of normalized ParsedModel entries.
 *
 * Pipeline per entry:
 *   raw → strip quotes → normalize whitespace → lowercase →
 *   alias expand → version suffix strip → deduplicate by canonical
 */
export function parseModelList(rawInput: string): ParsedModel[] {
  if (!rawInput?.trim()) return [];

  const entries = splitEntries(rawInput);
  const seen = new Set<string>();
  const results: ParsedModel[] = [];

  for (const entry of entries) {
    const raw = entry;

    // 1. Strip surrounding quotes
    const [unquoted, wasQuoteStripped] = stripQuotes(raw);

    // 2. Normalize whitespace → hyphens
    const normalized = normalizeWhitespace(unquoted);

    // 3. Lowercase for alias lookup
    const lowered = normalized.toLowerCase();

    // 4. Alias expansion (priority — known aliases take precedence)
    const [afterAlias, wasAliasExpanded] = expandAlias(lowered);

    // 5. Strip version suffix (only if not already canonical from alias)
    const [afterStrip, wasVersionStripped] = wasAliasExpanded
      ? [afterAlias, false]
      : stripVersionSuffix(afterAlias);

    // 6. Final canonical ID
    const canonical = afterStrip;

    // 7. Skip empty or too short
    if (!canonical || canonical.length < 3) continue;

    // 8. Deduplicate
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    results.push({
      canonical,
      raw,
      wasAliasExpanded,
      wasVersionStripped,
      wasQuoteStripped,
    });
  }

  return results;
}

/**
 * Extract unique provider IDs from a list of parsed models.
 * E.g. "anthropic/claude-sonnet" → "anthropic"
 */
export function extractProviders(models: ParsedModel[]): string[] {
  const providers = new Set<string>();
  for (const m of models) {
    const slash = m.canonical.indexOf("/");
    if (slash > 0) {
      providers.add(m.canonical.slice(0, slash));
    }
  }
  return [...providers];
}
