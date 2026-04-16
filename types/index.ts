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

export interface OptimizeResponse {
  success: true;
  jobId: string;
  data: TeamRecommendation;
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
