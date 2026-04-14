// lib/optimizer/scoring.ts
// Multi-factor scoring engine for SDD Team Optimizer recommendations

export interface ScoringFactors {
  speed: number;        // 0-1 scale (higher is better)
  cost: number;         // 0-1 scale (higher is better, lower cost)
  context: number;      // 0-1 scale (higher is better)
  coding: number;       // 0-1 scale (higher is better)
}

export interface WeightedScoreConfig {
  speedWeight?: number;
  costWeight?: number;
  contextWeight?: number;
  codingWeight?: number;
}

// Default weights - can be adjusted based on user preferences or use cases
const DEFAULT_WEIGHTS: Required<WeightedScoreConfig> = {
  speedWeight: 0.25,
  costWeight: 0.25,
  contextWeight: 0.25,
  codingWeight: 0.25
};

export type PhaseType = 'exploracion' | 'propuesta' | 'especificacion' | 'diseno' | 'planificacion' | 'implementacion' | 'verificacion' | 'archivo' | 'inicializacion' | 'onboard';

export function calculateWeightedScore(
  factors: ScoringFactors,
  phase: PhaseType,
  weights: WeightedScoreConfig = {}
): number {

  const phaseWeights: Record<PhaseType, Required<WeightedScoreConfig>> = {
    exploracion: { speedWeight: 0.1, costWeight: 0.1, contextWeight: 0.7, codingWeight: 0.1 },
    implementacion: { speedWeight: 0.2, costWeight: 0.2, contextWeight: 0.1, codingWeight: 0.5 },
    propuesta: DEFAULT_WEIGHTS,
    especificacion: DEFAULT_WEIGHTS,
    diseno: DEFAULT_WEIGHTS,
    planificacion: DEFAULT_WEIGHTS,
    verificacion: DEFAULT_WEIGHTS,
    archivo: DEFAULT_WEIGHTS,
    inicializacion: DEFAULT_WEIGHTS,
    onboard: DEFAULT_WEIGHTS,
  };
  
  const selectedWeights = phaseWeights[phase];
  const {
    speedWeight,
    costWeight,
    contextWeight,
    codingWeight
  } = { ...selectedWeights, ...weights };

  // Validate weights sum to approximately 1
  const weightSum = speedWeight + costWeight + contextWeight + codingWeight;
  if (Math.abs(weightSum - 1) > 0.01) {
    console.warn(`Weights sum to ${weightSum}, not 1. Normalizing...`);
  }

  // Normalize weights to sum to 1
  const normalizedSpeedWeight = speedWeight / weightSum;
  const normalizedCostWeight = costWeight / weightSum;
  const normalizedContextWeight = contextWeight / weightSum;
  const normalizedCodingWeight = codingWeight / weightSum;

  // Calculate weighted score
  const score = (
    factors.speed * normalizedSpeedWeight +
    factors.cost * normalizedCostWeight +
    factors.context * normalizedContextWeight +
    factors.coding * normalizedCodingWeight
  );

  // Ensure score is between 0 and 1
  return Math.max(0, Math.min(1, score));
}

/**
 * Normalize a value to a 0-1 scale based on min/max bounds
 * @param value The raw value to normalize
 * @param min Minimum possible value
 * @param max Maximum possible value
 * @returns Normalized value between 0 and 1
 */
export function normalizeValue(value: number, min: number, max: number): number {
  if (min === max) return 0.5; // Avoid division by zero
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Calculate factor scores based on model characteristics
 * @param contextWindow Model's context window size
 * @param costPer1M Model's cost per 1M tokens
 * @param speed Response speed rating (1-10)
 * @param codingProficiency Coding proficiency rating (1-10)
 * @returns Object with normalized factor scores
 */
export function calculateFactorScores(
  contextWindow: number,
  costPer1M: number,
  speed: number,
  codingProficiency: number
): ScoringFactors {
  // Normalize factors (higher is better for all)
  // For cost, we invert since lower cost is better
  const costFactor = 1 - normalizeValue(costPer1M, 0, 100); // Assuming max $100/1M tokens
  
  return {
    speed: normalizeValue(speed, 1, 10),
    cost: costFactor,
    context: normalizeValue(contextWindow, 2048, 200000), // Assuming max 200K context
    coding: normalizeValue(codingProficiency, 1, 10)
  };
}