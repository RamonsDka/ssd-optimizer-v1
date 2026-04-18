// ─── Domain Types — SDD Team Optimizer ─────────────────────────────────────

export type Tier = "PREMIUM" | "BALANCED" | "ECONOMIC";

// ─── SDD Phases ────────────────────────────────────────────────────────────────

export type SddPhase =
  | "sdd-explore"
  | "sdd-propose"
  | "sdd-spec"
  | "sdd-design"
  | "sdd-tasks"
  | "sdd-apply"
  | "sdd-verify"
  | "sdd-archive"
  | "sdd-init"
  | "sdd-onboard";

export const SDD_PHASES: SddPhase[] = [
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

export const SDD_PHASE_LABELS: Record<SddPhase, { es: string; en: string }> = {
  "sdd-explore": { es: "Exploración", en: "Explore" },
  "sdd-propose": { es: "Propuesta", en: "Propose" },
  "sdd-spec": { es: "Especificación", en: "Specification" },
  "sdd-design": { es: "Diseño Técnico", en: "Design" },
  "sdd-tasks": { es: "Planificación de Tareas", en: "Task Planning" },
  "sdd-apply": { es: "Implementación", en: "Implementation" },
  "sdd-verify": { es: "Verificación", en: "Verification" },
  "sdd-archive": { es: "Archivo", en: "Archive" },
  "sdd-init": { es: "Inicialización", en: "Initialization" },
  "sdd-onboard": { es: "onboard", en: "onboard" },
};

export function getPhaseLabel(phase: SddPhase | string, lang: 'es' | 'en'): string {
  // Check if it's a built-in phase
  if (phase in SDD_PHASE_LABELS) {
    return SDD_PHASE_LABELS[phase as SddPhase][lang];
  }
  
  // Custom phase: return the phase name as-is (will be overridden by displayName in UI)
  return phase;
}

// ─── Parsed Model ──────────────────────────────────────────────────────────

export interface ParsedModel {
  /** Canonical model ID (e.g. "anthropic/claude-sonnet-4-5") */
  canonical: string;
  /** Original raw string from user input */
  raw: string;
  wasAliasExpanded: boolean;
  wasVersionStripped: boolean;
  wasQuoteStripped: boolean;
}

// ─── Model record (Prisma-compatible shape for scoring) ────────────────────

export interface ModelRecord {
  id: string;
  name: string;
  providerId: string;
  tier: Tier;
  contextWindow: number;
  costPer1M: number;
  strengths: string[];
  discoveredByAI: boolean;
  lastSyncedAt?: Date | null;
}

// ─── Gemini AI Categorization ──────────────────────────────────────────────

export interface GeminiCategorization {
  id: string;
  name: string;
  providerId: string;
  tier: Tier;
  contextWindow: number;
  costPer1M: number;
  strengths: string[];
  confidence: number; // 0-1
  reasoning: string;
}

// ─── Scoring ──────────────────────────────────────────────────────────────

export interface PhaseAssignment {
  phase: SddPhase | string; // Support custom phases (string)
  phaseLabel: string;
  primary: ModelRecord;
  fallbacks: ModelRecord[];
  score: number;
  reason: string;
  warnings: string[];
  /** Confidence score (0-1) for the primary model when it was categorized by AI.
   *  Only set when primary.discoveredByAI === true. */
  aiConfidence?: number;
}

export interface TeamProfile {
  tier: Tier;
  phases: PhaseAssignment[];
  totalEstimatedCost: number;
  avgContextWindow: number;
}

export interface TeamRecommendation {
  premium: TeamProfile;
  balanced: TeamProfile;
  economic: TeamProfile;
  inputModels: ParsedModel[];
  unresolvedModels: string[];
  generatedAt: string;
  jobId?: string;
}

// ─── API Payloads ──────────────────────────────────────────────────────────

export interface OptimizeRequest {
  modelList: string;
  customPhases?: CustomSddPhase[];
}

// ─── Debug Info (exposed when ?debug=true) ─────────────────────────────────

/**
 * Per-dimension score breakdown for a single model × phase pair.
 * Only available when the V4 scoring engine is active.
 */
export interface DimensionBreakdownSummary {
  raw: number;
  weight: number;
  contribution: number;
}

/**
 * Debug information returned by /api/optimize when ?debug=true.
 * Allows inspecting the scoring engine's reasoning without polluting
 * the default payload.
 */
export interface DebugInfo {
  /**
   * The scoring engine version that actually produced the recommendation.
   * May differ from the requested version when a fallback occurred.
   */
  resolvedScoringVersion: "v2" | "v3" | "v4";
  /**
   * Whether the engine fell back to a lower version and why.
   */
  fallback: {
    v3Attempted: boolean;
    usedFallback: boolean;
    reason: string;
  };
  /**
   * Per-model V4 score breakdown, keyed by modelId.
   * null when the V4 engine was not used (V2 or V3 mode).
   */
  scoreBreakdown: Record<string, Record<string, DimensionBreakdownSummary>> | null;
  /**
   * Special rules applied per model, keyed by modelId.
   * null when the V4 engine was not used.
   */
  specialRulesApplied: Record<string, string[]> | null;
}

export interface OptimizeResponse {
  success: true;
  jobId: string;
  data: TeamRecommendation;
  /**
   * The scoring engine version that produced this recommendation.
   * Reflects the actual engine used (may differ from requested when fallback occurs).
   */
  scoringVersion: "v2" | "v3" | "v4";
  /** Scoring engine debug info. Only present when ?debug=true is passed. */
  debug?: DebugInfo;
}

export interface OptimizeErrorResponse {
  success: false;
  error: string;
  details?: string;
}

export interface ModelsLookupRequest {
  query?: string;
  tier?: Tier;
  limit?: number;
}

export interface ModelsLookupResponse {
  success: true;
  data: ModelRecord[];
  total: number;
}

// ─── Deploy API ────────────────────────────────────────────────────────────

export interface DeployRequest {
  jobId: string;
  tier: Tier;
}

export interface DeploySelection {
  phase: SddPhase;
  modelId: string;
  action: "applied" | "skipped";
  reason?: string;
}

export interface DeployResponse {
  success: true;
  jobId: string;
  tier: Tier;
  selections: DeploySelection[];
  appliedCount: number;
  skippedCount: number;
}

export interface DeployErrorResponse {
  success: false;
  error: string;
}

// ─── Advanced Options ──────────────────────────────────────────────────────

export interface ModelLimit {
  providerId: string;
  modelId: string;
  maxUses: number;
}

export interface PhasePreference {
  phase: SddPhase;
  providerId: string;
  modelId: string;
}

export interface ModelExclusion {
  phase: SddPhase;
  providerId: string;
  modelId: string;
}

export type AccountTier = "free" | "tier1" | "tier2" | "tier3";

export interface ProviderAccountTier {
  providerId: string;
  tier: AccountTier;
}

export interface AdvancedOptions {
  modelLimits: ModelLimit[];
  phasePreferences: PhasePreference[];
  modelExclusions: ModelExclusion[];
  accountTiers: ProviderAccountTier[];
}

export interface RecreateQueryPayload {
  input: string;
  advancedOptions?: AdvancedOptions;
  sourceJobId?: string;
}

export interface CustomSddPhase {
  name: string;
  displayName: string;
  description?: string;
  categoryWeights: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomPhaseInput {
  name: string;
  displayName: string;
  description?: string;
  categoryWeights: Record<string, number>;
}

// ─── OIM — Unified Model Matrix ────────────────────────────────────────────

/**
 * Source of truth for a UnifiedModelScores snapshot.
 * Mirrors the Prisma `ScoreSource` enum.
 */
export type ScoreSource =
  | "ARENA"               // LM Arena leaderboard data
  | "ARTIFICIAL_ANALYSIS" // ArtificialAnalysis.ai benchmarks
  | "WEB_INFERRED";       // AI-inferred from web / embedding heuristics

/**
 * Multi-dimensional score record for a single model snapshot.
 * Mirrors the Prisma `UnifiedModelScores` model.
 */
export interface UnifiedModelScores {
  id: string;
  modelId: string;

  /** Source that produced this score snapshot */
  source: ScoreSource;
  /** Date of the benchmark snapshot used as the historical anchor */
  snapshotDate: Date;

  /** Coding / programming capability score (0.0 – 1.0) */
  codingScore: number | null;
  /** Reasoning / thinking capability score (0.0 – 1.0) */
  thinkingScore: number | null;
  /** Design / creativity capability score (0.0 – 1.0) */
  designScore: number | null;
  /** Instruction-following capability score (0.0 – 1.0) */
  instructionScore: number | null;

  /** Context-efficiency metric — how well the model uses its context window (0.0 – 1.0) */
  contextEfficiency: number | null;

  /** Raw source payload, kept for reprocessing / debugging */
  rawData: Record<string, unknown> | null;

  syncedAt: Date;
}

/**
 * Input shape used by `upsertUnifiedScores()` in the OIM service.
 * `id` and `syncedAt` are generated server-side.
 */
export interface UnifiedModelScoresData {
  modelId: string;
  source: ScoreSource;
  snapshotDate: Date;

  codingScore?: number | null;
  thinkingScore?: number | null;
  designScore?: number | null;
  instructionScore?: number | null;
  contextEfficiency?: number | null;
  rawData?: Record<string, unknown> | null;
}

/**
 * Lightweight summary returned after a successful upsert operation.
 */
export interface UnifiedModelScoresUpsertResult {
  id: string;
  modelId: string;
  source: ScoreSource;
  snapshotDate: Date;
  /** `true` if a new record was created, `false` if an existing one was updated */
  created: boolean;
}
