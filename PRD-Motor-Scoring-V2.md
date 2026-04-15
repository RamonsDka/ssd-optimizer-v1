# PRD: Motor de Scoring V2 con LM Arena Integration

## Metadata
- **Versión**: 2.0.0
- **Fecha**: 2026-04-14
- **Autor**: RamonsDk-Dev
- **Estado**: Draft - Fase de Ideación
- **Proyecto**: SDD Team Optimizer

---

## TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Contexto y Motivación](#contexto-y-motivación)
3. [Análisis del Sistema Actual](#análisis-del-sistema-actual)
4. [Visión del Motor V2](#visión-del-motor-v2)
5. [Arquitectura Propuesta](#arquitectura-propuesta)
6. [Integración con LM Arena](#integración-con-lm-arena)
7. [Fórmula de Scoring](#fórmula-de-scoring)
8. [Plan de Implementación](#plan-de-implementación)
9. [Riesgos y Mitigaciones](#riesgos-y-mitigaciones)
10. [Métricas de Éxito](#métricas-de-éxito)

---

## 1. RESUMEN EJECUTIVO

### Problema
El motor de scoring actual (V1) utiliza datos hardcodeados y suposiciones manuales para evaluar modelos de IA. No hay sincronización con benchmarks reales como LM Arena, lo que resulta en recomendaciones subóptimas y datos obsoletos.

### Solución
Construir un Motor de Scoring V2 desde cero que:
- Se sincronice diariamente con LM Arena API
- Use las 27 categorías de benchmarks reales
- Aplique pesos dinámicos por fase SDD
- Mantenga 3 perfiles (Premium/Balanced/Economic)
- Incluya sistema de reintentos y fallback

### Impacto Esperado
- **Precisión**: +40% en recomendaciones vs V1
- **Actualización**: Datos frescos cada 24h
- **Confianza**: Basado en 292K+ votos reales
- **Escalabilidad**: Soporta 288+ modelos automáticamente

---

## 2. CONTEXTO Y MOTIVACIÓN

### 2.1 El Problema de Acoplamiento

Los pipelines de orquestación (como SDD) suelen acoplar fuertemente:
- Lógica de negocio (fases del proyecto)
- Dependencias de infraestructura (nombres específicos de modelos)

Esto viola el **Principio de Inversión de Dependencias** (SOLID).

### 2.2 Por Qué Esto es Crítico

Si mañana:
- Anthropic cambia el nombre de claude-sonnet-4.6
- Google lanza Gemini 4.0
- Un modelo baja de precio 50%

**El pipeline entero colapsa o queda desactualizado.**

### 2.3 La Oportunidad: LM Arena

LM Arena es el benchmark más confiable de la industria:
- **292,770 votos** de usuarios reales
- **288 modelos** evaluados
- **27 categorías** especializadas
- **Actualización continua**

**Categorías disponibles:**
1. Overall
2. Expert
3. Occupational
4. Math
5. Instruction Following
6. Multi-Turn
7. Creative Writing
8. Coding
9. Hard Prompts
10. Hard Prompts (English)
11. Longer Query
12. Language
13. Exclude Ties
14. ... (27 total)

---

## 3. ANÁLISIS DEL SISTEMA ACTUAL (V1)

### 3.1 Arquitectura Actual

`
lib/optimizer/
├── scoring.ts       → Motor básico (4 factores: speed, cost, context, coding)
├── selector.ts      → Motor avanzado (5 factores + phase weights)
└── parser.ts        → Parsing de input de usuario
`

**Problema**: Dos motores coexistiendo. selector.ts es el que realmente se usa.

### 3.2 Factores de Evaluación Actuales

`	ypescript
interface PhaseWeight {
  reasoning: number;   // Razonamiento arquitectónico
  coding: number;      // Precisión en código
  speed: number;       // Velocidad de respuesta
  context: number;     // Ventana de contexto
  structured: number;  // Salida estructurada
}
`

### 3.3 Fórmula de Scoring V1

`	ypescript
score = (strengthScore + contextBonus) * initPenalty * costMultiplier
`

Donde:
- strengthScore: Suma de pesos de tags que coinciden con model.strengths
- contextBonus: Bonus si context ≥ 128k (full) o ≥ 64k (partial)
- initPenalty: 50% de penalización si fase = sdd-init y context < 100k
- costMultiplier: 5% bonus si es gratis, 2% si cuesta < \/1M

### 3.4 Gaps Críticos

| Gap | Impacto | Prioridad |
|---|---|---|
| **No hay datos reales de LM Arena** | Scoring basado en suposiciones | 🔴 CRÍTICO |
| **No hay categorías de LM Arena** | No aprovecha las 27 categorías | 🔴 CRÍTICO |
| **No hay actualización dinámica** | Datos obsoletos rápidamente | 🟠 ALTO |
| **Strengths son tags manuales** | No hay mapeo a capacidades reales | 🟠 ALTO |
| **No hay UI/UX scoring** | Falta dimensión importante | 🟡 MEDIO |
| **No hay latency real** | speed es un número inventado | 🟡 MEDIO |

---

## 4. VISIÓN DEL MOTOR V2

### 4.1 Principios de Diseño

1. **Single Source of Truth**: LM Arena es la fuente de datos
2. **Clean Architecture**: Separación de capas (Domain, Application, Infrastructure)
3. **Capability-Based Routing**: Emparejar necesidad exacta con modelo óptimo
4. **Graceful Degradation**: Siempre devolver Top 3 modelos (fallbacks)
5. **Real-Time Sync**: Datos frescos cada 24h con reintentos

### 4.2 Objetivos Clave

| Objetivo | Métrica | Target |
|---|---|---|
| **Precisión** | % de recomendaciones correctas vs manual | ≥ 90% |
| **Frescura** | Edad máxima de datos | ≤ 24h |
| **Cobertura** | % de modelos en LM Arena cubiertos | ≥ 80% |
| **Disponibilidad** | Uptime del servicio de sync | ≥ 99% |
| **Latencia** | Tiempo de respuesta de scoring | ≤ 200ms |

### 4.3 Casos de Uso

#### Caso 1: Usuario pide recomendación para sdd-apply
**Input**: Fase = sdd-apply, Tier = BALANCED
**Output**: 
- Primary: qwen3-coder-480b (score: 0.92)
- Fallback 1: claude-sonnet-4-6 (score: 0.88)
- Fallback 2: gpt-5.3-codex (score: 0.85)
- Reason: "Qwen3-Coder lidera en categoría Coding (score 1507) con 89% de precisión en implementación"

#### Caso 2: Sincronización diaria falla
**Escenario**: API de LM Arena está down
**Comportamiento**: 
1. Reintento cada hora (max 24 reintentos)
2. Si falla todo el día, usar datos del día anterior
3. Mostrar warning en UI: "⚠ Datos de hace 48h"

#### Caso 3: Nuevo modelo aparece en LM Arena
**Escenario**: gemini-4-pro se agrega al leaderboard
**Comportamiento**:
1. Sync automático lo detecta
2. Categoriza usando embeddings locales
3. Calcula scores para las 10 fases SDD
4. Disponible en próxima recomendación

---

## 5. ARQUITECTURA PROPUESTA

### 5.1 Diagrama de Capas

`
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  - API Routes (/api/optimize, /api/models)                  │
│  - UI Components (OptimizerGrid, ComparisonTable)           │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│  - Use Cases (GenerateRecommendation, SyncModels)           │
│  - DTOs (TeamRecommendation, ModelRecord)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                     DOMAIN LAYER                             │
│  - Entities (Model, Phase, Profile)                         │
│  - Value Objects (Score, Tier, Capability)                  │
│  - Domain Services (ScoringEngine, CategoryMapper)          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                         │
│  - LMArenaClient (API integration)                          │
│  - PrismaRepository (DB persistence)                        │
│  - EmbeddingService (Local AI for categorization)          │
│  - CronScheduler (Daily sync)                               │
└─────────────────────────────────────────────────────────────┘
`

### 5.2 Componentes Clave

#### 5.2.1 LMArenaClient

`	ypescript
interface LMArenaClient {
  // Fetch leaderboard for a specific category
  fetchLeaderboard(category: LMArenaCategory): Promise<LeaderboardData>;
  
  // Fetch all categories in parallel
  fetchAllCategories(): Promise<Map<LMArenaCategory, LeaderboardData>>;
  
  // Health check
  ping(): Promise<boolean>;
}
`

**Responsabilidades:**
- Conectar con https://api.wulong.dev/arena-ai-leaderboards/v1/
- Manejar rate limiting
- Retry logic con backoff exponencial
- Cache de respuestas (5 min TTL)

#### 5.2.2 ScoringEngine V2

`	ypescript
interface ScoringEngineV2 {
  // Calculate score for a model on a specific phase
  scoreModel(
    model: ModelRecord,
    phase: SddPhase,
    arenaScores: Map<LMArenaCategory, number>
  ): ScoringResult;
  
  // Rank all models for a phase
  rankModelsForPhase(
    models: ModelRecord[],
    phase: SddPhase,
    tierPreference: Tier[]
  ): RankedModel[];
}

interface ScoringResult {
  score: number;           // 0-1 normalized
  breakdown: {
    arenaScore: number;    // Weighted average from LM Arena categories
    contextBonus: number;  // Bonus for large context
    costMultiplier: number;// Cost efficiency factor
    tierBonus: number;     // Tier preference bonus
  };
  confidence: number;      // 0-1 (based on vote count)
  reason: string;
}
`

#### 5.2.3 CategoryMapper

`	ypescript
interface CategoryMapper {
  // Map LM Arena categories to SDD phase requirements
  getRelevantCategories(phase: SddPhase): WeightedCategory[];
}

interface WeightedCategory {
  category: LMArenaCategory;
  weight: number; // 0-1 (sum to 1.0)
}

// Example mapping
const PHASE_CATEGORY_MAPPING: Record<SddPhase, WeightedCategory[]> = {
  "sdd-explore": [
    { category: "Expert", weight: 0.4 },
    { category: "Creative Writing", weight: 0.3 },
    { category: "Multi-Turn", weight: 0.3 }
  ],
  "sdd-apply": [
    { category: "Coding", weight: 0.7 },
    { category: "Instruction Following", weight: 0.2 },
    { category: "Expert", weight: 0.1 }
  ],
  // ... resto de fases
};
`

#### 5.2.4 EmbeddingService (Local AI)

`	ypescript
interface EmbeddingService {
  // Categorize a new model using local embeddings
  categorizeModel(
    modelName: string,
    modelDescription?: string
  ): Promise<ModelCapabilities>;
}

interface ModelCapabilities {
  reasoning: number;    // 0-100
  coding: number;       // 0-100
  creative: number;     // 0-100
  speed: number;        // 0-100
  context: number;      // 0-100
  confidence: number;   // 0-1
}
`

**Implementación sugerida:**
- **Modelo**: ll-MiniLM-L6-v2 (80MB, rápido)
- **Librería**: @xenova/transformers (ONNX runtime en Node.js)
- **Uso**: Categorizar modelos nuevos que aún no tienen scores en LM Arena

---

## 6. INTEGRACIÓN CON LM ARENA

### 6.1 API Endpoints Disponibles

`
Base URL: https://api.wulong.dev/arena-ai-leaderboards/v1/
`

| Endpoint | Método | Descripción |
|---|---|---|
| /leaderboard?name=text | GET | Overall text leaderboard |
| /leaderboard?name=expert | GET | Expert category |
| /leaderboard?name=coding | GET | Coding category |
| /leaderboard?name=math | GET | Math category |
| ... | ... | (27 categorías total) |

### 6.2 Estructura de Respuesta

`json
{
  "meta": {
    "leaderboard": "expert",
    "source_url": "https://arena.ai/leaderboard/text/expert",
    "fetched_at": "2026-04-14T04:32:21.141286+00:00",
    "model_count": 288
  },
  "models": [
    {
      "rank": 1,
      "model": "claude-opus-4-6",
      "vendor": "Anthropic",
      "license": "proprietary",
      "score": 1544,
      "ci": 17,
      "votes": 1382
    }
  ]
}
`

### 6.3 Mapeo de Datos

| Campo LM Arena | Campo Interno | Transformación |
|---|---|---|
| model | id | Normalizar a formato endor/model |
| endor | providerId | Lowercase |
| score | renaScore | Normalizar a 0-1 (min: 1078, max: 1544) |
| otes | confidence | Más votos = más confianza |
| license | 	ier | proprietary → PREMIUM/BALANCED, open → ECONOMIC |

### 6.4 Estrategia de Sincronización

#### Opción A: Cron Job Diario (ELEGIDA)

`	ypescript
// lib/sync/lmarena-sync.ts
export async function syncLMArenaData() {
  const categories = [
    "text", "expert", "coding", "math", "creative-writing",
    "instruction-following", "multi-turn", "hard-prompts"
  ];
  
  const results = await Promise.allSettled(
    categories.map(cat => lmArenaClient.fetchLeaderboard(cat))
  );
  
  // Process results
  const modelsMap = new Map<string, ModelAggregated>();
  
  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const model of result.value.models) {
        // Aggregate scores across categories
        aggregateModelScores(modelsMap, model, result.value.meta.leaderboard);
      }
    }
  }
  
  // Persist to DB
  await prisma.model.upsertMany(Array.from(modelsMap.values()));
  
  console.log(✅ Synced  models from LM Arena);
}
`

**Cron Schedule:**
`
0 2 * * * → Todos los días a las 2 AM
`

#### Sistema de Reintentos

`	ypescript
async function syncWithRetry(maxRetries = 24, retryInterval = 3600000) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      await syncLMArenaData();
      return { success: true, attempt };
    } catch (error) {
      attempt++;
      console.warn(⚠ Sync failed (attempt /):, error);
      
      if (attempt < maxRetries) {
        await sleep(retryInterval); // 1 hora
      }
    }
  }
  
  // Fallback: usar datos del día anterior
  console.error("🔴 Sync failed after 24 attempts. Using stale data.");
  return { success: false, attempt };
}
`

---

## 7. FÓRMULA DE SCORING V2

### 7.1 Fórmula Completa

`	ypescript
finalScore = (
  arenaWeightedScore * 0.70 +
  contextScore * 0.15 +
  costScore * 0.10 +
  tierPreferenceScore * 0.05
) * penaltyMultiplier
`

### 7.2 Componentes Detallados

#### 7.2.1 Arena Weighted Score (70% del peso)

`	ypescript
arenaWeightedScore = Σ (categoryScore[i] * categoryWeight[i])
`

**Ejemplo para sdd-apply:**
`	ypescript
arenaWeightedScore = 
  (codingScore * 0.7) +
  (instructionFollowingScore * 0.2) +
  (expertScore * 0.1)
`

Donde cada categoryScore se normaliza:
`	ypescript
categoryScore = (rawScore - minScore) / (maxScore - minScore)
// rawScore: 1078-1544 → normalizado a 0-1
`

#### 7.2.2 Context Score (15% del peso)

`	ypescript
contextScore = 
  if (contextWindow >= 1_000_000) → 1.0
  else if (contextWindow >= 500_000) → 0.8
  else if (contextWindow >= 200_000) → 0.6
  else if (contextWindow >= 128_000) → 0.4
  else if (contextWindow >= 64_000) → 0.2
  else → 0.0
`

**Penalización especial para sdd-init:**
`	ypescript
if (phase === "sdd-init" && contextWindow < 100_000) {
  penaltyMultiplier *= 0.5; // 50% de penalización
}
`

#### 7.2.3 Cost Score (10% del peso)

`	ypescript
costScore = 1 - normalize(costPer1M, 0, 100)

// Bonus para modelos económicos
if (costPer1M === 0) costScore *= 1.1;        // +10% para free
else if (costPer1M < 1.0) costScore *= 1.05;  // +5% para < \
`

#### 7.2.4 Tier Preference Score (5% del peso)

`	ypescript
tierPreferenceScore = 
  if (model.tier === profile.preferredTier) → 1.0
  else if (model.tier === profile.secondaryTier) → 0.6
  else → 0.3
`

**Tier Order:**
- Premium profile: PREMIUM (1.0) → BALANCED (0.6) → ECONOMIC (0.3)
- Balanced profile: BALANCED (1.0) → PREMIUM (0.6) → ECONOMIC (0.6)
- Economic profile: ECONOMIC (1.0) → BALANCED (0.6) → PREMIUM (0.3)

### 7.3 Confidence Score

`	ypescript
confidence = Math.min(1.0, votes / 10_000)
// Más de 10K votos = confianza máxima
`

**Uso:**
- Si confidence < 0.3 → Mostrar warning "⚠ Pocos votos, score preliminar"
- Si confidence < 0.1 → Usar embedding local como fallback

---

## 8. PLAN DE IMPLEMENTACIÓN

### 8.1 Fases del Proyecto

#### FASE 0: Corrección de Bugs Críticos (3-4 horas) 🔴 PRIORIDAD MÁXIMA

**Objetivo**: Eliminar todos los bugs existentes antes de implementar Motor V2

**Bugs identificados:**

1. **Bug #1: Falta de Aislamiento de Sesiones (CRÍTICO)**
   - Problema: Usuarios comparten estado (localStorage sin session ID)
   - Solución: Session Manager con UUID en cookies
   - Tiempo: 1.5h

2. **Bug #2 & #3: Nombres de Modelos Cortados**
   - Problema: Nombres largos se cortan en DataMatrix y /models
   - Solución: Tooltip + multiline + sistema de vistas múltiples
   - Tiempo: 1h

3. **Bug #4.1: Clear/Reset no funciona completamente**
   - Problema: Quedan providers y modelos sin eliminar
   - Solución: Agregar onDelete: Cascade en Prisma
   - Tiempo: 0.5h

4. **Bug #5: Secciones Innecesarias**
   - Problema: "Recommended Toolkit" y "API Keys" no son necesarias
   - Solución: Eliminar ambas secciones
   - Tiempo: 0.5h

**Tareas:**
- [ ] Instalar uuid
- [ ] Crear lib/session/session-manager.ts
- [ ] Crear lib/session/migrate-legacy-data.ts
- [ ] Actualizar useOptimizerPersistence
- [ ] Actualizar todos los hooks con localStorage
- [ ] Agregar migración en app/layout.tsx
- [ ] Arreglar nombres cortados (tooltip + multiline)
- [ ] Actualizar schema.prisma con CASCADE
- [ ] Crear migración de DB
- [ ] Actualizar API routes de Clear/Reset
- [ ] Eliminar secciones innecesarias
- [ ] Testing completo

**Entregables:**
- Session Manager funcional
- Migración de datos existentes
- UI sin nombres cortados
- Clear/Reset funcionando correctamente
- Código limpio sin secciones innecesarias

**Criterios de aceptación:**
- ✅ Dos navegadores diferentes tienen sesiones independientes
- ✅ Nombres de modelos se ven completos
- ✅ Clear History elimina TODO
- ✅ Reset Models elimina TODO
- ✅ No hay secciones innecesarias

---

#### FASE 1: Investigación y Diseño (1 semana) ✅ COMPLETADA

**Tareas:**
- [x] Auditar código actual
- [x] Investigar API de LM Arena
- [x] Crear PRD estructurado
- [x] Crear TASK-TRACKER.md con 89 tareas
- [x] Crear ANALISIS-BUGS-MEJORAS.md
- [x] Validar PRD con usuario

**Entregables:**
- ✅ PRD completo (PRD-Motor-Scoring-V2.md)
- ✅ Task Tracker (TASK-TRACKER.md)
- ✅ Análisis de bugs (ANALISIS-BUGS-MEJORAS.md)
- ✅ Guía de Git (Guia-Github-Comit.md)

---

#### FASE 2: Infraestructura Base (4-5 horas)

**Tareas:**
1. Crear LMArenaClient
   - Implementar fetch para todas las categorías
   - Retry logic con backoff exponencial
   - Tests unitarios
2. Crear CategoryMapper
   - Mapeo de 27 categorías → 10 fases SDD
   - Pesos configurables
3. Setup de Cron Job
   - Usar 
ode-cron o similar
   - Logging con Winston
   - Alertas si falla

**Entregables:**
- lib/sync/lmarena-client.ts
- lib/sync/category-mapper.ts
- lib/sync/cron-scheduler.ts
- Tests con 80%+ coverage

---

#### FASE 3: Scoring Engine V2 (4-5 horas)

**Tareas:**
1. Implementar nueva fórmula de scoring
   - Arena weighted score
   - Context score
   - Cost score
   - Tier preference
2. Migrar lógica de selector.ts → scoring-engine-v2.ts
3. Crear ScoringResult con breakdown detallado
4. Tests de regresión vs V1

**Entregables:**
- lib/optimizer/scoring-engine-v2.ts
- Tests comparativos V1 vs V2
- Documentación de fórmula

---

#### FASE 4: Nuevas Features (6-8 horas)

**Tareas:**
1. Advanced Options UI
   - Model Usage Limits
   - Phase Preferences
   - Model Exclusions
   - Account Tier Selection
2. Recreate Query desde /history
3. Custom SDD Phases

**Entregables:**
- components/optimizer/AdvancedOptions.tsx
- Recreate Query funcional
- Custom SDD Phases funcional

---

#### FASE 5: Mejoras de UX (3-4 horas)

**Tareas:**
1. Sistema de vistas múltiples (Grid, List, Table, Compact)
2. Nuevas opciones en /settings

**Entregables:**
- ViewModeSelector completo
- Settings mejorado

---

#### FASE 6: Embedding Service (3-4 horas)

**Tareas:**
1. Integrar @xenova/transformers
2. Implementar categorización automática con all-mpnet-base-v2 (420MB)
3. Fallback para modelos sin scores en LM Arena

**Entregables:**
- lib/ai/embedding-service.ts
- Tests con modelos ficticios

---

#### FASE 7: Testing y Deploy (2-3 horas)

**Tareas:**
1. Tests de integración completos
2. Performance testing (latencia < 200ms)
3. Load testing (100 req/s)
4. Deploy a staging
5. Smoke tests
6. Deploy a producción
7. Monitoreo post-deploy

**Entregables:**
- Motor V2 en producción
- Métricas de performance
- Dashboard de monitoreo

---

### 8.2 Timeline Total

```
Fase 0: Bugs (3-4h) - PRIORIDAD MÁXIMA
Fase 1: Investigación (COMPLETADA)
Fase 2: Infraestructura (4-5h)
Fase 3: Scoring V2 (4-5h)
Fase 4: Features (6-8h)
Fase 5: UX (3-4h)
Fase 6: Embeddings (3-4h)
Fase 7: Testing y Deploy (2-3h)

TOTAL: 25-33 horas
```

---

## 9. RIESGOS Y MITIGACIONES

### 9.1 Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **API de LM Arena down** | Media | Alto | Sistema de reintentos + fallback a datos del día anterior |
| **Rate limiting en API** | Baja | Medio | Cache de 5 min + fetch en paralelo con throttling |
| **Cambio en estructura de API** | Baja | Alto | Versionado de cliente + tests de contrato |
| **Performance degradation** | Media | Medio | Cache de scores calculados + índices en DB |
| **Embedding service lento** | Baja | Bajo | Async processing + queue |

### 9.2 Riesgos de Negocio

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Usuarios prefieren V1** | Baja | Alto | A/B testing + feedback loop |
| **Scores no coinciden con expectativas** | Media | Medio | Explicabilidad (breakdown) + ajuste de pesos |
| **Costo de infraestructura** | Baja | Bajo | Optimizar queries + cache agresivo |

---

## 10. MÉTRICAS DE ÉXITO

### 10.1 KPIs Técnicos

| Métrica | Baseline (V1) | Target (V2) | Método de Medición |
|---|---|---|---|
| **Precisión de recomendaciones** | 60% | ≥ 90% | Comparación manual con expertos |
| **Frescura de datos** | N/A (hardcoded) | ≤ 24h | Timestamp en DB |
| **Latencia de scoring** | ~50ms | ≤ 200ms | APM (Datadog) |
| **Cobertura de modelos** | ~30 modelos | ≥ 230 modelos | Count en DB |
| **Uptime de sync** | N/A | ≥ 99% | Cron job logs |

### 10.2 KPIs de Producto

| Métrica | Baseline | Target | Método de Medición |
|---|---|---|---|
| **Satisfacción de usuario** | N/A | ≥ 4.5/5 | Encuesta post-uso |
| **Tasa de adopción** | N/A | ≥ 80% | Analytics |
| **Tiempo de decisión** | ~10 min | ≤ 2 min | Time tracking |

---

## 11. PREGUNTAS ABIERTAS

### 11.1 Decisiones Pendientes

1. **¿Qué hacer con modelos que no están en LM Arena?**
   - Opción A: Usar embedding service para categorizar
   - Opción B: Marcar como "No evaluado" y excluir
   - **Decisión**: Opción A (más flexible)

2. **¿Cómo manejar modelos con múltiples variantes?**
   - Ejemplo: claude-sonnet-4-6 vs claude-sonnet-4-6-thinking
   - Opción A: Tratarlos como modelos separados
   - Opción B: Agrupar y usar el mejor score
   - **Decisión**: Opción A (más preciso)

3. **¿Permitir override manual de scores?**
   - Opción A: Sí, con interfaz de admin
   - Opción B: No, 100% automático
   - **Decisión**: Opción A (para casos edge)

### 11.2 Investigación Adicional Necesaria

- [ ] Evaluar alternativas a @xenova/transformers para embeddings
- [ ] Investigar si LM Arena tiene webhook para cambios
- [ ] Validar si 27 categorías son suficientes o necesitamos más granularidad

---

## 12. APÉNDICES

### Apéndice A: Mapeo Completo de Categorías

`	ypescript
const PHASE_CATEGORY_WEIGHTS: Record<SddPhase, Record<LMArenaCategory, number>> = {
  "sdd-explore": {
    "Expert": 0.4,
    "Creative Writing": 0.3,
    "Multi-Turn": 0.2,
    "Longer Query": 0.1
  },
  "sdd-propose": {
    "Expert": 0.35,
    "Instruction Following": 0.3,
    "Multi-Turn": 0.25,
    "Creative Writing": 0.1
  },
  "sdd-spec": {
    "Instruction Following": 0.4,
    "Expert": 0.3,
    "Hard Prompts": 0.2,
    "Multi-Turn": 0.1
  },
  "sdd-design": {
    "Expert": 0.4,
    "Creative Writing": 0.25,
    "Multi-Turn": 0.2,
    "Instruction Following": 0.15
  },
  "sdd-tasks": {
    "Instruction Following": 0.4,
    "Expert": 0.3,
    "Multi-Turn": 0.2,
    "Math": 0.1
  },
  "sdd-apply": {
    "Coding": 0.7,
    "Instruction Following": 0.2,
    "Expert": 0.1
  },
  "sdd-verify": {
    "Coding": 0.4,
    "Expert": 0.3,
    "Hard Prompts": 0.2,
    "Instruction Following": 0.1
  },
  "sdd-archive": {
    "Instruction Following": 0.4,
    "Expert": 0.3,
    "Creative Writing": 0.2,
    "Multi-Turn": 0.1
  },
  "sdd-init": {
    "Expert": 0.4,
    "Longer Query": 0.3,
    "Multi-Turn": 0.2,
    "Coding": 0.1
  },
  "sdd-onboard": {
    "Expert": 0.4,
    "Instruction Following": 0.3,
    "Multi-Turn": 0.2,
    "Creative Writing": 0.1
  }
};
`

### Apéndice B: Ejemplo de Respuesta de Scoring V2

`json
{
  "phase": "sdd-apply",
  "primary": {
    "id": "alibaba/qwen3-coder-480b",
    "name": "Qwen3 Coder 480B",
    "score": 0.92,
    "breakdown": {
      "arenaScore": 0.95,
      "contextScore": 0.8,
      "costScore": 0.9,
      "tierPreferenceScore": 1.0
    },
    "confidence": 0.85,
    "reason": "Qwen3-Coder lidera en categoría Coding (score 1507, rank #1) con 89% de precisión en implementación. Context window de 262K tokens. Costo: \.26/1M."
  },
  "fallbacks": [
    {
      "id": "anthropic/claude-sonnet-4-6",
      "name": "Claude Sonnet 4.6",
      "score": 0.88,
      "reason": "Excelente en Coding (score 1503, rank #11) y Expert (score 1503, rank #11). Premium tier."
    },
    {
      "id": "openai/gpt-5.3-codex",
      "name": "GPT-5.3 Codex",
      "score": 0.85,
      "reason": "Fuerte en Coding (score 1498) con buen balance costo/performance."
    }
  ],
  "warnings": [],
  "metadata": {
    "dataFreshness": "2026-04-14T02:00:00Z",
    "totalModelsEvaluated": 288,
    "syncStatus": "healthy"
  }
}
`

---

## 13. CONCLUSIÓN

El Motor de Scoring V2 representa un salto cualitativo en la capacidad del SDD Team Optimizer para recomendar modelos de IA de forma precisa, actualizada y basada en datos reales.

**Beneficios clave:**
- ✅ Datos reales de 292K+ votos
- ✅ 27 categorías especializadas
- ✅ Actualización diaria automática
- ✅ Explicabilidad completa (breakdown)
- ✅ Fallbacks robustos
- ✅ Escalabilidad a 288+ modelos

**Próximos pasos:**
1. Validar PRD con equipo
2. Iniciar Fase 2: Infraestructura Base
3. Iterar basado en feedback

---

**Documento vivo**: Este PRD se actualizará conforme avance la implementación.

**Última actualización**: 2026-04-14
**Versión**: 2.0.0-draft
