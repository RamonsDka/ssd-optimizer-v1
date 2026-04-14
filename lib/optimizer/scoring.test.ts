/**
 * Example usage for the Scoring Engine
 */

import { calculateWeightedScore, calculateFactorScores } from './scoring';

// Example 1: Calculate score for exploration phase
const factors1 = calculateFactorScores(128000, 10, 9, 7);
const score1 = calculateWeightedScore(factors1, 'exploracion');
console.log('Exploration phase score:', score1);

// Example 2: Calculate score for implementation phase
const factors2 = calculateFactorScores(200000, 5, 6, 9);
const score2 = calculateWeightedScore(factors2, 'implementacion');
console.log('Implementation phase score:', score2);
