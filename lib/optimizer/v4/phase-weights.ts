// ─── Phase Weights V4 — 17-Dimensional SDD Scoring ───────────────────────────
//
// Este módulo define los pesos de las 17 dimensiones para cada fase SDD.
// Fuente de verdad: SDD-MODEL-SELECTION-ENGINE.md §8.2 Tabla de Pesos por Fase
//
// Las 17 dimensiones se organizan en 4 grupos:
//   Grupo A: Inteligencia y Razonamiento (a1-a4)
//   Grupo B: Capacidades Técnicas        (b1-b6)
//   Grupo C: Capacidades Especializadas  (c1-c4)
//   Grupo D: Operacionales               (d1-d3)
//
// Los pesos SON comparativos entre dimensiones dentro de la misma fase.
// La fórmula normaliza dividiendo por el total: weighted_sum / total_weight
// → El resultado siempre está en [0.0, 10.0]

// ─── Fases SDD V4 ────────────────────────────────────────────────────────────

/** Fases SDD soportadas por el motor V4, incluyendo "orchestrator" */
export type SddPhaseV4 =
  | "orchestrator"
  | "init"
  | "explore"
  | "propose"
  | "spec"
  | "design"
  | "tasks"
  | "apply"
  | "verify"
  | "archive"
  | "onboard";

// ─── Tipo PhaseWeights ────────────────────────────────────────────────────────

/**
 * Pesos de las 17 dimensiones para una fase SDD específica.
 * Cada dimensión tiene un peso numérico (0.0-10.0) que indica su importancia.
 * Los pesos NO necesitan sumar 10.0 — la fórmula normaliza automáticamente.
 */
export interface PhaseWeights {
  // Grupo A: Inteligencia y Razonamiento
  a1_overall_intelligence: number;
  a2_reasoning_depth: number;
  a3_instruction_following: number;
  a4_hallucination_resistance: number;

  // Grupo B: Capacidades Técnicas
  b1_coding_quality: number;
  b2_coding_multilang: number;
  b3_context_window_score: number;
  b4_context_effective_score: number;
  b5_tool_calling_accuracy: number;
  b6_agentic_reliability: number;

  // Grupo C: Capacidades Especializadas
  c1_visual_understanding: number;
  c2_format_adherence: number;
  c3_long_context_coherence: number;
  c4_architecture_awareness: number;

  // Grupo D: Operacionales
  d1_speed_score: number;
  d2_cost_score: number;
  d3_availability_score: number;
}

// ─── Reglas Especiales por Fase ───────────────────────────────────────────────

/**
 * Configuración de reglas especiales para una fase.
 * Las reglas especiales se aplican DESPUÉS del cálculo de la suma ponderada.
 */
export interface PhaseSpecialRuleConfig {
  /**
   * Si true, los modelos thinking son EXCLUIDOS de esta fase.
   * Su latencia de "pensar" es overhead puro para tareas triviales.
   * Fases: orchestrator, tasks, archive
   */
  excludeThinkingModels?: boolean;

  /**
   * Si true, los modelos thinking reciben un bonus y los no-thinking una penalización.
   * Fases: explore, propose, verify
   */
  preferThinkingModels?: boolean;

  /**
   * Bonus aplicado al score base si el modelo ES thinking y preferThinkingModels=true.
   * Default: +1.5
   */
  thinkingBonus?: number;

  /**
   * Penalización aplicada al score base si el modelo NO ES thinking y preferThinkingModels=true.
   * Default: -1.5
   */
  penaltyForNonThinking?: number;

  /**
   * Ventana de contexto mínima (tokens nominales) requerida para la fase.
   * Si el modelo no cumple, es EXCLUIDO completamente.
   */
  minContextWindowTokens?: number;

  /**
   * Score compuesto mínimo que debe tener el modelo para ser seleccionado.
   * Modelos por debajo de este umbral emiten warnings pero no son excluidos automáticamente.
   */
  minQualityThreshold?: number;
}

// ─── Tabla de Pesos — §8.2 SDD-MODEL-SELECTION-ENGINE.md ─────────────────────

/**
 * Pesos de las 17 dimensiones para cada una de las 11 fases SDD.
 * Valores extraídos EXACTAMENTE de la tabla §8.2 del documento fundacional.
 *
 * | Dimensión                | Orchestrator | Init | Explore | Propose | Spec | Design | Tasks | Apply | Verify | Archive | Onboard |
 * |--------------------------|-------------|------|---------|---------|------|--------|-------|-------|--------|---------|---------|
 * | A1 overall_intelligence  |     7.5     |  6.5 |   7.0   |   9.0   | 6.0  |  7.5   |  4.5  |  7.5  |  8.0   |   2.0   |   9.0   |
 * | A2 reasoning_depth       |     4.5     |  3.0 |  10.0   |  10.0   | 5.0  |  8.5   |  1.5  |  7.0  | 10.0   |   0.5   |   5.0   |
 * | A3 instruction_following |    10.0     |  8.0 |   6.0   |   7.5   | 9.0  |  7.0   |  9.0  |  8.0  |  7.0   |   8.0   |   8.5   |
 * | A4 hallucination_resist  |     7.0     |  8.0 |   9.5   |   9.5   | 9.5  |  7.0   |  7.0  |  9.0  |  9.0   |   6.0   |   8.0   |
 * | B1 coding_quality        |     3.5     |  5.0 |   7.5   |   4.0   | 8.5  |  8.0   |  3.0  | 10.0  |  9.5   |   1.5   |   7.5   |
 * | B2 coding_multilang      |     0.5     |  3.0 |   5.0   |   3.0   | 5.0  |  5.0   |  1.0  |  8.5  |  7.0   |   0.5   |   4.0   |
 * | B3 context_window        |     8.5     | 10.0 |   8.5   |   6.5   | 7.5  |  6.5   |  6.5  |  8.5  |  8.0   |   3.0   |   9.5   |
 * | B4 context_effective     |     7.5     |  9.5 |   7.0   |   5.5   | 6.5  |  5.5   |  5.0  |  7.0  |  7.0   |   2.5   |   8.5   |
 * | B5 tool_calling          |     9.5     |  3.0 |   4.0   |   3.5   | 3.0  |  3.0   |  2.0  |  5.0  |  3.0   |   2.0   |   3.5   |
 * | B6 agentic_reliability   |     9.0     |  4.0 |   5.0   |   5.0   | 4.5  |  4.5   |  3.0  |  7.5  |  5.5   |   2.5   |   6.0   |
 * | C1 visual_understanding  |     1.5     |  3.5 |   2.0   |   1.5   | 1.0  | 10.0   |  0.0  |  3.5  |  2.5   |   0.5   |   4.0   |
 * | C2 format_adherence      |     5.0     |  4.0 |   5.0   |   6.5   |10.0  |  7.5   |  9.5  |  6.0  |  5.5   |   9.0   |   8.0   |
 * | C3 long_context_coherence|     7.5     |  9.0 |   7.5   |   7.0   | 6.5  |  6.0   |  4.5  |  8.5  |  7.5   |   3.5   |   8.0   |
 * | C4 architecture_awareness|     4.0     |  4.0 |   9.0   |  10.0   | 8.0  |  9.5   |  2.0  |  9.0  |  9.0   |   1.0   |   5.5   |
 * | D1 speed                 |     8.5     |  4.0 |   2.5   |   1.0   | 5.5  |  4.0   | 10.0  |  4.5  |  2.0   |  10.0   |   4.5   |
 * | D2 cost                  |     5.0     |  6.0 |   5.5   |   5.0   | 5.5  |  5.0   |  7.5  |  5.5  |  5.0   |   9.5   |   5.5   |
 * | D3 availability          |     8.0     |  6.5 |   6.0   |   6.0   | 6.0  |  6.0   |  6.5  |  6.5  |  6.5   |   6.0   |   6.0   |
 */
export const PHASE_WEIGHTS: Record<SddPhaseV4, PhaseWeights> = {

  // ─── orchestrator ──────────────────────────────────────────────────────────
  // El cerebro del pipeline. Prioriza velocidad, tool-calling y contexto grande.
  // Anti-thinking: los modelos de razonamiento son overkill para ruteo.
  orchestrator: {
    a1_overall_intelligence:    7.5,
    a2_reasoning_depth:         4.5,   // No necesita razonamiento profundo para rutear
    a3_instruction_following:  10.0,   // CRÍTICO: debe obedecer el system prompt exactamente
    a4_hallucination_resistance: 7.0,
    b1_coding_quality:           3.5,  // Delega, rara vez escribe código
    b2_coding_multilang:         0.5,
    b3_context_window_score:     8.5,  // Necesita procesar el historial completo de sesión
    b4_context_effective_score:  7.5,
    b5_tool_calling_accuracy:    9.5,  // CRÍTICO: su función principal es hacer tool calls precisas
    b6_agentic_reliability:      9.0,  // MUY ALTO: maneja sesiones largas multi-step
    c1_visual_understanding:     1.5,
    c2_format_adherence:         5.0,
    c3_long_context_coherence:   7.5,
    c4_architecture_awareness:   4.0,
    d1_speed_score:              8.5,  // ALTO: el pipeline se bloquea esperando al orchestrator
    d2_cost_score:               5.0,
    d3_availability_score:       8.0,  // ALTO: si falla el orchestrator, el pipeline muere
  },

  // ─── init ──────────────────────────────────────────────────────────────────
  // Bootstrap del contexto. Ventana de contexto es el factor discriminante primario.
  init: {
    a1_overall_intelligence:     6.5,
    a2_reasoning_depth:          3.0,  // Comprensión, no razonamiento profundo
    a3_instruction_following:    8.0,
    a4_hallucination_resistance: 8.0,  // No puede inventar dependencias del proyecto
    b1_coding_quality:           5.0,  // Necesita leer código para mapear el proyecto
    b2_coding_multilang:         3.0,
    b3_context_window_score:    10.0,  // CRÍTICO: define si puede leer el proyecto completo
    b4_context_effective_score:  9.5,  // CRÍTICO: ventana efectiva real (sin "Lost in the Middle")
    b5_tool_calling_accuracy:    3.0,
    b6_agentic_reliability:      4.0,
    c1_visual_understanding:     3.5,  // Algunos proyectos tienen diagramas
    c2_format_adherence:         4.0,
    c3_long_context_coherence:   9.0,  // MUY ALTO: mantener coherencia leyendo archivos dispersos
    c4_architecture_awareness:   4.0,
    d1_speed_score:              4.0,  // Una sola llamada, puede tardar
    d2_cost_score:               6.0,  // Medio: consume muchos tokens con contexto largo
    d3_availability_score:       6.5,
  },

  // ─── explore ───────────────────────────────────────────────────────────────
  // Análisis de impacto y dependencias. Razonamiento causal profundo.
  // Prefer-thinking: modelos R1, o1, Magistral son ideales aquí.
  explore: {
    a1_overall_intelligence:     7.0,
    a2_reasoning_depth:         10.0,  // CRÍTICO: el core de la exploración es razonamiento causal
    a3_instruction_following:    6.0,
    a4_hallucination_resistance: 9.5,  // CRÍTICO: no puede inventar dependencias
    b1_coding_quality:           7.5,  // ALTO: debe leer y entender código complejo
    b2_coding_multilang:         5.0,
    b3_context_window_score:     8.5,  // Necesita leer múltiples archivos relacionados
    b4_context_effective_score:  7.0,
    b5_tool_calling_accuracy:    4.0,
    b6_agentic_reliability:      5.0,
    c1_visual_understanding:     2.0,  // Rara vez necesita procesar imágenes
    c2_format_adherence:         5.0,
    c3_long_context_coherence:   7.5,  // ALTO: traza cadenas largas de dependencias
    c4_architecture_awareness:   9.0,  // MUY ALTO: necesita entender patrones para trazar deps
    d1_speed_score:              2.5,  // BAJO: calidad >> velocidad aquí
    d2_cost_score:               5.5,
    d3_availability_score:       6.0,
  },

  // ─── propose ───────────────────────────────────────────────────────────────
  // Decisión arquitectónica. La fase con mayor impacto en todo el pipeline.
  // Prefer-thinking: +1.5. El costo de un error aquí es el más alto.
  propose: {
    a1_overall_intelligence:     9.0,  // MUY ALTO: visión holística del sistema
    a2_reasoning_depth:         10.0,  // CRÍTICO: evaluar trade-offs entre opciones
    a3_instruction_following:    7.5,
    a4_hallucination_resistance: 9.5,  // CRÍTICO: no puede proponer patrones inexistentes
    b1_coding_quality:           4.0,  // BAJO: propone, no implementa
    b2_coding_multilang:         3.0,
    b3_context_window_score:     6.5,
    b4_context_effective_score:  5.5,
    b5_tool_calling_accuracy:    3.5,
    b6_agentic_reliability:      5.0,
    c1_visual_understanding:     1.5,  // MUY BAJO: raramente necesita imágenes
    c2_format_adherence:         6.5,
    c3_long_context_coherence:   7.0,
    c4_architecture_awareness:  10.0,  // CRÍTICO: el core de propose es decidir arquitectura
    d1_speed_score:              1.0,  // MUY BAJO: calidad absolutamente prioritaria
    d2_cost_score:               5.0,
    d3_availability_score:       6.0,
  },

  // ─── spec ──────────────────────────────────────────────────────────────────
  // Traducción a especificaciones formales Given/When/Then.
  // Adherencia al formato es el factor más crítico.
  spec: {
    a1_overall_intelligence:     6.0,
    a2_reasoning_depth:          5.0,
    a3_instruction_following:    9.0,  // MUY ALTO: debe seguir el template exactamente
    a4_hallucination_resistance: 9.5,  // CRÍTICO: no puede inventar requirements
    b1_coding_quality:           8.5,  // ALTO: los criterios de aceptación deben ser técnicamente correctos
    b2_coding_multilang:         5.0,
    b3_context_window_score:     7.5,
    b4_context_effective_score:  6.5,
    b5_tool_calling_accuracy:    3.0,
    b6_agentic_reliability:      4.5,
    c1_visual_understanding:     1.0,  // MUY BAJO
    c2_format_adherence:        10.0,  // CRÍTICO: la spec DEBE estar en formato estándar
    c3_long_context_coherence:   6.5,
    c4_architecture_awareness:   8.0,  // ALTO: la spec debe reflejar la arquitectura propuesta
    d1_speed_score:              5.5,
    d2_cost_score:               5.5,
    d3_availability_score:       6.0,
  },

  // ─── design ────────────────────────────────────────────────────────────────
  // Decisiones de arquitectura visual: diagramas, componentes, contratos.
  // Comprensión visual es el factor más crítico (mockups de UI).
  design: {
    a1_overall_intelligence:     7.5,
    a2_reasoning_depth:          8.5,  // MUY ALTO: trade-offs de diseño requieren razonamiento
    a3_instruction_following:    7.0,
    a4_hallucination_resistance: 7.0,
    b1_coding_quality:           8.0,  // ALTO: genera interfaces, tipos y contratos
    b2_coding_multilang:         5.0,
    b3_context_window_score:     6.5,
    b4_context_effective_score:  5.5,
    b5_tool_calling_accuracy:    3.0,
    b6_agentic_reliability:      4.5,
    c1_visual_understanding:    10.0,  // CRÍTICO: trabaja con mockups, wireframes, diagramas
    c2_format_adherence:         7.5,  // ALTO: genera diagramas Mermaid
    c3_long_context_coherence:   6.0,
    c4_architecture_awareness:   9.5,  // CRÍTICO: define la arquitectura de componentes
    d1_speed_score:              4.0,
    d2_cost_score:               5.0,
    d3_availability_score:       6.0,
  },

  // ─── tasks ─────────────────────────────────────────────────────────────────
  // Partición de spec en tareas atómicas. Tarea mecánica de menor carga cognitiva.
  // Anti-thinking: modelos R1/o1 son overkill puro aquí.
  tasks: {
    a1_overall_intelligence:     4.5,  // BAJO: tarea mecánica, no requiere alta inteligencia
    a2_reasoning_depth:          1.5,  // MUY BAJO: no hay razonamiento necesario
    a3_instruction_following:    9.0,  // CRÍTICO: debe seguir el template de tasks exactamente
    a4_hallucination_resistance: 7.0,  // No puede inventar tareas no especificadas
    b1_coding_quality:           3.0,
    b2_coding_multilang:         1.0,
    b3_context_window_score:     6.5,  // Necesita leer la spec completa
    b4_context_effective_score:  5.0,
    b5_tool_calling_accuracy:    2.0,
    b6_agentic_reliability:      3.0,
    c1_visual_understanding:     0.0,  // IRRELEVANTE
    c2_format_adherence:         9.5,  // CRÍTICO: output es JSON con numeración jerárquica
    c3_long_context_coherence:   4.5,
    c4_architecture_awareness:   2.0,
    d1_speed_score:             10.0,  // CRÍTICO: velocidad máxima para tarea trivial
    d2_cost_score:               7.5,  // ALTO: tarea trivial que no merece modelos caros
    d3_availability_score:       6.5,
  },

  // ─── apply ─────────────────────────────────────────────────────────────────
  // Implementación del código real. El agente más importante en output directo.
  // Balance entre calidad de código y velocidad razonable.
  apply: {
    a1_overall_intelligence:     7.5,
    a2_reasoning_depth:          7.0,  // ALTO: razonar si el código respeta la arquitectura
    a3_instruction_following:    8.0,  // ALTO: debe seguir el JSON de tareas exactamente
    a4_hallucination_resistance: 9.0,  // CRÍTICO: no puede importar librerías inexistentes
    b1_coding_quality:          10.0,  // CRÍTICO: escribe el código que irá a producción
    b2_coding_multilang:         8.5,  // MUY ALTO: proyectos reales usan múltiples lenguajes
    b3_context_window_score:     8.5,  // MUY ALTO: spec + design + tasks + código existente
    b4_context_effective_score:  7.0,
    b5_tool_calling_accuracy:    5.0,
    b6_agentic_reliability:      7.5,
    c1_visual_understanding:     3.5,  // BAJO-MEDIO: útil para frontend
    c2_format_adherence:         6.0,
    c3_long_context_coherence:   8.5,  // MUY ALTO: coherencia entre múltiples archivos
    c4_architecture_awareness:   9.0,  // CRÍTICO: debe respetar la arquitectura de propose/design
    d1_speed_score:              4.5,  // MEDIO: balance necesario
    d2_cost_score:               5.5,
    d3_availability_score:       6.5,
  },

  // ─── verify ────────────────────────────────────────────────────────────────
  // Auditoría del código generado. Análisis crítico y detección de errores sutiles.
  // Prefer-thinking: reviews exhaustivos requieren "pensar antes de juzgar".
  verify: {
    a1_overall_intelligence:     8.0,  // ALTO: juicio experto sobre calidad global
    a2_reasoning_depth:         10.0,  // CRÍTICO: análisis de correctitud formal
    a3_instruction_following:    7.0,
    a4_hallucination_resistance: 9.0,  // CRÍTICO: no puede reportar bugs inexistentes
    b1_coding_quality:           9.5,  // CRÍTICO: debe entender profundamente el código que revisa
    b2_coding_multilang:         7.0,
    b3_context_window_score:     8.0,  // ALTO: spec + código completo juntos
    b4_context_effective_score:  7.0,
    b5_tool_calling_accuracy:    3.0,
    b6_agentic_reliability:      5.5,
    c1_visual_understanding:     2.5,
    c2_format_adherence:         5.5,
    c3_long_context_coherence:   7.5,
    c4_architecture_awareness:   9.0,  // CRÍTICO: verifica que se respetó la arquitectura
    d1_speed_score:              2.0,  // MUY BAJO: exhaustividad > velocidad
    d2_cost_score:               5.0,
    d3_availability_score:       6.5,
  },

  // ─── archive ───────────────────────────────────────────────────────────────
  // Sincronización de delta specs y cierre del ciclo SDD.
  // La tarea de menor carga cognitiva: velocidad y costo son lo que importa.
  // Anti-thinking: exclusión estricta, solo agrega latencia y costo.
  archive: {
    a1_overall_intelligence:     2.0,  // MUY BAJO: comprimir logs no requiere inteligencia alta
    a2_reasoning_depth:          0.5,  // MÍNIMO: no hay razonamiento necesario
    a3_instruction_following:    8.0,  // ALTO: debe seguir el template de cierre
    a4_hallucination_resistance: 6.0,  // El resumen debe ser factual
    b1_coding_quality:           1.5,
    b2_coding_multilang:         0.5,
    b3_context_window_score:     3.0,
    b4_context_effective_score:  2.5,
    b5_tool_calling_accuracy:    2.0,
    b6_agentic_reliability:      2.5,
    c1_visual_understanding:     0.5,
    c2_format_adherence:         9.0,  // MUY ALTO: el resumen debe seguir el template de Engram
    c3_long_context_coherence:   3.5,
    c4_architecture_awareness:   1.0,
    d1_speed_score:             10.0,  // CRÍTICO: velocidad máxima para la tarea más trivial
    d2_cost_score:               9.5,  // CRÍTICO: la tarea de menor valor debe tener costo cero
    d3_availability_score:       6.0,
  },

  // ─── onboard ───────────────────────────────────────────────────────────────
  // Guía end-to-end del workflow SDD. Síntesis pedagógica del proyecto completo.
  onboard: {
    a1_overall_intelligence:     9.0,  // MUY ALTO: síntesis inteligente y pedagogía
    a2_reasoning_depth:          5.0,
    a3_instruction_following:    8.5,  // MUY ALTO: output con estructura específica
    a4_hallucination_resistance: 8.0,  // ALTO: no puede inventar convenciones del proyecto
    b1_coding_quality:           7.5,  // ALTO: incluye ejemplos de código reales
    b2_coding_multilang:         4.0,
    b3_context_window_score:     9.5,  // CRÍTICO: necesita leer toda la documentación
    b4_context_effective_score:  8.5,
    b5_tool_calling_accuracy:    3.5,
    b6_agentic_reliability:      6.0,
    c1_visual_understanding:     4.0,  // MEDIO: puede necesitar leer diagramas del proyecto
    c2_format_adherence:         8.0,
    c3_long_context_coherence:   8.0,  // ALTO: documento largo y coherente
    c4_architecture_awareness:   5.5,
    d1_speed_score:              4.5,
    d2_cost_score:               5.5,
    d3_availability_score:       6.0,
  },
};

// ─── Reglas Especiales por Fase ───────────────────────────────────────────────

/**
 * Configuración de reglas especiales para cada fase SDD.
 * Fuente: §7 y §8.1 del documento SDD-MODEL-SELECTION-ENGINE.md
 */
export const PHASE_SPECIAL_RULES: Record<SddPhaseV4, PhaseSpecialRuleConfig> = {
  orchestrator: {
    // Anti-thinking: overkill para ruteo de herramientas
    excludeThinkingModels: true,
    // Contexto mínimo: debe procesar historial completo de sesión
    minContextWindowTokens: 260_000,
    minQualityThreshold: 7.5,
  },
  init: {
    minContextWindowTokens: 32_000,
    minQualityThreshold: 6.5,
  },
  explore: {
    // Prefer-thinking: razonamiento causal encadenado
    preferThinkingModels: true,
    thinkingBonus: 1.5,
    penaltyForNonThinking: -1.5,
    minQualityThreshold: 7.5,
  },
  propose: {
    // Prefer-thinking: evaluación de trade-offs arquitectónicos
    preferThinkingModels: true,
    thinkingBonus: 1.5,
    penaltyForNonThinking: -1.5,
    minQualityThreshold: 8.5,   // El umbral más alto del pipeline
  },
  spec: {
    minQualityThreshold: 7.0,
  },
  design: {
    minQualityThreshold: 7.5,
  },
  tasks: {
    // Anti-thinking: extended thinking no aporta nada a generar una lista
    excludeThinkingModels: true,
    minQualityThreshold: 5.5,
  },
  apply: {
    minQualityThreshold: 7.8,
  },
  verify: {
    // Prefer-thinking: reviews exhaustivos con "pensar antes de juzgar"
    preferThinkingModels: true,
    thinkingBonus: 1.5,
    penaltyForNonThinking: -1.5,
    minQualityThreshold: 8.0,
  },
  archive: {
    // Anti-thinking: exclusión estricta, la tarea más trivial del pipeline
    excludeThinkingModels: true,
    minQualityThreshold: 4.0,
  },
  onboard: {
    minContextWindowTokens: 32_000,
    minQualityThreshold: 7.0,
  },
};

// ─── Score Mínimos de Calidad por Fase (para warnings) ───────────────────────

/**
 * Scores mínimos recomendados para emitir warnings cuando no se alcanza.
 * Fuente: §6.2 global_rules.min_quality_threshold_per_phase
 */
export const PHASE_MIN_QUALITY_SCORES: Record<SddPhaseV4, number> = {
  orchestrator: 7.5,
  init:         6.5,
  explore:      7.5,
  propose:      8.5,   // El más alto — errores aquí son los más costosos
  spec:         7.0,
  design:       7.5,
  tasks:        5.5,   // El más bajo — tarea trivial
  apply:        7.8,
  verify:       8.0,
  archive:      4.0,   // Muy bajo: velocidad > calidad
  onboard:      7.0,
};
