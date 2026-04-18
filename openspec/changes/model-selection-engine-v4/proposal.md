# Proposal: Model Selection Engine V4 — 17-Dimensional Scoring

## Intent

El motor actual (V2 + V3) usa un esquema de 5 dimensiones (`coding`, `thinking`, `design`, `instruction`, `context`) que **sobrecomprime la realidad**: trata igual el razonamiento causal de `sdd-explore` y la generación de código de `sdd-apply`, y no puede distinguir modelos con gran contexto nominal pero `Lost-in-Middle` severo de los que lo usan eficientemente.

El documento `SDD-MODEL-SELECTION-ENGINE.md` (§3) formaliza **17 dimensiones** en 4 grupos (A: Inteligencia, B: Técnicas, C: Especializadas, D: Operacionales) con criterios y pesos distintos por fase. Esta propuesta migra el motor a ese esquema.

**Problemas concretos que resuelve:**
- V3 asigna el mismo modelo para `sdd-tasks` (pura velocidad) y `sdd-propose` (máximo razonamiento) porque la distancia vectorial en 5D es engañosa.
- No existe penalización por `is_thinking_model` en `sdd-orchestrator`/`sdd-tasks` (donde añade latencia sin beneficio).
- Regla anti-sesgo `apply_provider ≠ verify_provider` no está implementada.
- `UnifiedModelScores` solo guarda 5 dimensiones; las 12 restantes (B5, B6, C1–C4, D1–D3, etc.) no tienen persistencia.

---

## Scope

### In Scope
- Nueva tabla `ModelCapabilities` con las 17 dimensiones del documento §11.1
- Nuevo `scoring-engine-v4.ts` que implementa la fórmula §8.1 (suma ponderada + reglas especiales)
- Actualización de `selector.ts` para usar V4 como estrategia default, manteniendo V2/V3 como fallback
- Actualización de `category-mapper.ts` para mapear scores de fuentes externas a las 17 dimensiones
- Migración Prisma: nueva tabla `ModelCapabilities` + campo `is_thinking_model` en `models`
- Feature flag `SCORING_VERSION` en `oim-orchestrator.ts` para activación gradual sin cortar V3
- API route `/api/optimize` sigue funcionando igual (output contract no cambia)

### Out of Scope
- UI de visualización de las 17 dimensiones (fase posterior)
- Ingesta automática de benchmarks externos (ArtificialAnalysis API, SWE-bench)
- Motor de embeddings para modelos desconocidos (§10.3, §14)
- Reglas de perfil PREMIUM/MIXTO/FREE completas (§6) — solo perfil único en esta iteración
- `sdd-orchestrator` como fase evaluable (ya existe, no es fase SDD del pipeline de usuario)

---

## Capabilities

### New Capabilities
- `model-selection-engine-v4`: Motor de scoring de 17 dimensiones con reglas especiales por fase, feature flag de activación, y migración de BD.

### Modified Capabilities
- None — no hay specs existentes en `openspec/specs/` que cubran el motor de scoring.

---

## Approach

**Migración gradual con feature flag** (recomendada en el análisis de exploración):

1. La tabla `ModelCapabilities` se crea vacía junto a `UnifiedModelScores` existente.
2. `scoring-engine-v4.ts` implementa el algoritmo §8.1; si no hay datos V4 para un modelo, hace downgrade a V3 automáticamente.
3. El flag `SCORING_VERSION` en `.env` controla cuál engine usa `selector.ts` como primario.
4. `category-mapper.ts` se extiende para alimentar V4 a partir de los mismos datos que ya recolecta para V3.
5. Validación con `compare-scoring.ts` (ya existe) para confirmar que V4 produce rankings mejores o iguales antes de promoverlo.

**Por qué no Big Bang:** reescribir los 4 archivos críticos simultáneamente sin fallback deja el sistema inoperable si los datos de las 17 dimensiones están incompletos para algún modelo.

**Por qué no Incremental sin flag:** sin flag, cualquier deploy intermedio activa parcialmente V4 con datos incompletos, produciendo scores incorrectos en producción.

---

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Nueva tabla `ModelCapabilities` (17 cols), campo `is_thinking_model` en `models` |
| `lib/db/oim-service.ts` | Modified | CRUD para `ModelCapabilities` |
| `lib/optimizer/scoring-engine-v4.ts` | New | Algoritmo §8.1 + reglas especiales §8.1/§13 |
| `lib/optimizer/selector.ts` | Modified | Añadir estrategia `"v4"`, feature flag lookup |
| `lib/optimizer/category-mapper.ts` | Modified | Mapeo de raw benchmarks → 17 dimensiones normalizadas |
| `lib/optimizer/oim-orchestrator.ts` | Modified | Leer `SCORING_VERSION` env var; pasar a selector |
| `lib/optimizer/scoring-engine-v2.ts` | Unchanged | Se mantiene como fallback |
| `lib/optimizer/scoring-engine-v3.ts` | Unchanged | Se mantiene como fallback/A-B |
| `.env.example` | Modified | Agregar `SCORING_VERSION=v3` default |

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `ModelCapabilities` vacía para modelos existentes → V4 scores = 0 | High | Downgrade automático a V3 si no hay datos V4 |
| Reglas especiales (thinking_bonus, exclusiones) cambian ranking esperado | Med | `compare-scoring.ts` A/B antes de flag flip |
| Migración Prisma falla en prod por tabla nueva | Low | `migrate deploy` es additive, no destructivo |
| `category-mapper.ts` mapea dimensiones incorrectamente | Med | Type-safe schema + revisión manual en PR |

---

## Rollback Plan

1. Setear `SCORING_VERSION=v3` en `.env` (sin redeploy si es env var de runtime).
2. Si se hizo deploy: `git revert` del commit de `scoring-engine-v4.ts` — `scoring-engine-v2/v3` quedan intactos.
3. La tabla `ModelCapabilities` puede quedar en BD sin afectar nada — no rompe queries existentes.
4. En caso extremo: `prisma migrate reset` solo en dev; en prod ejecutar `DROP TABLE model_capabilities` manual.

---

## Dependencies

- `SDD-MODEL-SELECTION-ENGINE.md` como source of truth para pesos, fórmulas y reglas especiales
- Prisma CLI disponible en el proyecto (ya lo está: `package.json`)
- Datos de benchmarks para al menos los modelos top-10 del registry actual (poblar `ModelCapabilities`)

---

## Implementation Phases

| Fase | Descripción | Esfuerzo estimado |
|------|-------------|-------------------|
| **F1** | Schema Prisma + migración + CRUD `oim-service.ts` | 1 sesión |
| **F2** | `scoring-engine-v4.ts` (algoritmo §8.1 + reglas especiales §13) | 1 sesión |
| **F3** | Extender `category-mapper.ts` para 17 dimensiones | 1 sesión |
| **F4** | Feature flag en `selector.ts` + `oim-orchestrator.ts` | 0.5 sesión |
| **F5** | Poblar `ModelCapabilities` para modelos del registry | 1 sesión |
| **F6** | Validación A/B con `compare-scoring.ts` | 0.5 sesión |
| **F7** | Flip flag a `v4` + deprecar rama V3 | 0.5 sesión |

**Total estimado: ~5.5 sesiones**

---

## Success Criteria

- [ ] `tsc --noEmit` pasa sin errores con V4 activado
- [ ] `scoring-engine-v4.ts` asigna modelos de razonamiento a `sdd-propose`/`sdd-explore` y modelos fast a `sdd-tasks`/`sdd-archive` (validación manual con modelos conocidos)
- [ ] Regla anti-sesgo `apply_provider ≠ verify_provider` activa y verificable en output
- [ ] `ModelCapabilities` tiene datos para ≥ 80% de modelos del registry
- [ ] Feature flag `SCORING_VERSION=v3` restaura comportamiento idéntico al actual
- [ ] `/api/optimize` response shape no cambia (compatibilidad regresiva)
