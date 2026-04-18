# Design: Model Selection Engine V4

## Technical Approach

Implementar el motor de scoring de 17 dimensiones definido en el PRD (V4). La implementación será incremental, utilizando un feature flag (`SCORING_VERSION=v4`) que permitirá evaluar la nueva lógica sin romper el motor V3 actual. Se creará una nueva tabla en Prisma `ModelCapabilities` para almacenar de forma persistente las 17 métricas normalizadas, además de una bandera `is_thinking_model` en el modelo base. El núcleo del nuevo motor se implementará en `scoring-engine-v4.ts`, donde se aplicará la fórmula de suma ponderada combinada con bonuses y penalizaciones específicas por fase a través de reglas especiales.

## Architecture Decisions

### Decision: Almacenamiento de Dimensiones V4

**Choice**: Crear una nueva tabla `ModelCapabilities` con las 17 columnas de evaluación y agregar `is_thinking_model` a la tabla `Model`.
**Alternatives considered**: Ampliar la tabla existente `UnifiedModelScores` con 12 columnas nuevas.
**Rationale**: `UnifiedModelScores` contiene snapshots ligados a una fuente de benchmarking específica. `ModelCapabilities` representa el estado "oficial" y consolidado (las 17 dimensiones normalizadas de 0.0 a 10.0) que consume el motor V4 de forma directa, desacoplándolo del historial de ingestión y limpieza de datos crudos.

### Decision: Estrategia de Migración

**Choice**: Uso de feature flag `SCORING_VERSION` y downgrade automático a V3 por modelo.
**Alternatives considered**: Reemplazo directo (Big Bang) o migración incremental de endpoints separados.
**Rationale**: Permite mantener el endpoint de optimización operando con V4 siempre y cuando existan datos en `ModelCapabilities`. Si para un modelo específico falta información en la nueva tabla, se recurre transparente e individualmente al score V3, asegurando zero downtime durante la recolección progresiva de los nuevos benchmarks.

### Decision: Implementación de Reglas Especiales

**Choice**: Implementar un sistema de reglas especiales desacoplado (middleware-like) (`apply_special_rules`) en el motor V4.
**Alternatives considered**: Integrar (hardcodear) los modificadores dentro de la misma función de cálculo por fase.
**Rationale**: Mantiene el cálculo base de la suma ponderada simple y testable. Inyectar exclusiones (ej. modelos thinking penalizados en tasks) o bonificaciones (modelos thinking premiados en propose) como modificadores aislados facilita el testing unitario y la legibilidad de las reglas de negocio.

## Data Flow

    [API Request] ──→ [oim-orchestrator] ──(SCORING_VERSION=v4)──→ [selector.ts]
                                                                        │
                                                                        ▼
    [DB Prisma] ◀──(Fetch ModelCapabilities & Models)── [scoring-engine-v4.ts]
                                                                        │
                                                                        ├── 1. Calculate weighted base score
                                                                        ├── 2. Apply special rules (bonus/penalty)
                                                                        └── 3. Calculate final phase score
                                                                        │
    [Client Response] ◀──(TeamRecommendation JSON)──────────────────────┘

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Agregar tabla `ModelCapabilities` (17 dimensiones) y campo `is_thinking_model` en `Model`. |
| `lib/optimizer/scoring-engine-v4.ts` | Create | Implementa algoritmo principal V4, delegando a pesos y modificadores. |
| `lib/optimizer/phase-weights.ts` | Create | Define constantes y pesos de las 17 dimensiones para cada fase SDD. |
| `lib/optimizer/special-rules.ts` | Create | Lógica de reglas especiales (bonuses, penalizaciones, exclusiones de contexto y costo). |
| `lib/optimizer/selector.ts` | Modify | Agrega estrategia `v4` e integra el mecanismo de fallback a V3. |
| `lib/optimizer/oim-orchestrator.ts` | Modify | Lee `SCORING_VERSION` desde env y la pasa al selector. |
| `.env.example` | Modify | Añadir `SCORING_VERSION=v3` como valor default. |
| `lib/db/oim-service.ts` | Modify | Añadir CRUD para `ModelCapabilities` y `is_thinking_model`. |

## Interfaces / Contracts

```typescript
// lib/optimizer/scoring-engine-v4.ts

export interface ModelCapabilities {
  modelId: string;
  // Grupo A: Inteligencia
  a1_overall_intelligence: number;
  a2_reasoning_depth: number;
  a3_instruction_following: number;
  a4_hallucination_resistance: number;
  // Grupo B: Técnicas
  b1_coding_quality: number;
  b2_coding_multilang: number;
  b3_context_window_score: number;
  b4_context_effective_score: number;
  b5_tool_calling_accuracy: number;
  b6_agentic_reliability: number;
  // Grupo C: Especializadas
  c1_visual_understanding: number;
  c2_format_adherence: number;
  c3_long_context_coherence: number;
  c4_architecture_awareness: number;
  // Grupo D: Operacionales
  d1_speed_score: number;
  d2_cost_score: number;
  d3_availability_score: number;
}

export interface PhaseWeights {
  [dimension: keyof Omit<ModelCapabilities, 'modelId'>]: number;
}

export interface ScoringResult {
  modelId: string;
  phaseId: string;
  finalScore: number;
  baseScore: number;
  scoreBreakdown: Record<string, { raw: number; weight: number; contribution: number }>;
  specialRulesApplied: string[];
  exclusionReason?: string;
}

export type SpecialRule = (model: any, capabilities: ModelCapabilities, phase: string, currentScore: number) => {
  adjustedScore: number;
  appliedRules: string[];
  exclusionReason?: string;
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `scoring-engine-v4.ts` | Mockear `ModelCapabilities` y validar que el producto escalar (suma ponderada) produzca el score matemático correcto por fase. |
| Unit | `special-rules.ts` | Verificar que las exclusiones actúen correctamente (e.g. `is_thinking_model=true` en `tasks` retorna penalización severa/exclusión). |
| Integration | `selector.ts` | Verificar la funcionalidad de graceful degradation: si `SCORING_VERSION=v4` y un modelo carece de datos V4, el engine debe solicitar transparentemente el fallback al score V3. |

## Migration / Rollout

Plan de rollout progresivo y seguro:
1. Desplegar actualización del schema de Prisma (`prisma migrate deploy`). Es una migración aditiva, no interrumpe operaciones actuales.
2. Poblar `ModelCapabilities` con valores normalizados iniciales a partir de fuentes de benchmarks para los modelos clave.
3. El backend arranca con `SCORING_VERSION=v3` (default) para evitar impactos tempranos.
4. Validar la precisión del motor V4 localmente o en un entorno de staging a través de las utilidades comparativas (`compare-scoring.ts`).
5. Flip del feature flag a `SCORING_VERSION=v4` en producción. Reversión instantánea mediante un rollback de la variable si se detectan anomalías.

## Open Questions

- [ ] ¿Cómo obtendremos y aseguraremos la precisión de los valores normalizados (0.0-10.0) de las 17 métricas para la carga inicial de los modelos menos populares en producción?
- [ ] ¿Cómo implementaremos rigurosamente la regla anti-sesgo de confirmación (`apply_provider != verify_provider`) a nivel del selector que consolida la recomendación del equipo, dado que los scores iniciales se evalúan independientemente por modelo y fase?