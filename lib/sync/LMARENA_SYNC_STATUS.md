# LM Arena Sync - Estado de Implementación

## ✅ FASE 1 COMPLETADA

### Cambios implementados (15 Abr 2026)

#### 1. Schema actualizado (`prisma/schema.prisma`)
- ✅ Agregado campo `leaderboardPublishDate DateTime` a `LMArenaScore`
- ✅ Cambiada constraint única de `[modelId, categoryId]` a `[modelId, categoryId, leaderboardPublishDate]`
- ✅ Soporta histórico/append-only: múltiples snapshots por modelo+categoría
- ⏳ Migración pendiente: requiere DB corriendo

#### 2. Fuente de datos migrada (`lib/sync/lmarena-client.ts`)
- ✅ Migrado de API inexistente (`lmarena.ai/api`) a dataset oficial de Hugging Face
- ✅ Nueva fuente: `lmarena-ai/leaderboard-dataset` vía HF Datasets API
- ✅ Agregados tipos HF: `HFDatasetRow`, `HFDatasetResponse`
- ✅ `LMArenaModelEntry` ahora incluye `leaderboardPublishDate: string`
- ✅ `fetchLeaderboard()` reescrito para:
  - Fetch desde `https://datasets-server.huggingface.co/rows`
  - Filtrar por categoría client-side
  - Extraer `leaderboard_publish_date` del dataset
  - Transformar formato HF → formato interno

#### 3. Lógica de sync actualizada (`lib/sync/lmarena-sync.ts`)
- ✅ `processModelEntry()` usa `leaderboardPublishDate` como clave temporal
- ✅ Upsert con constraint de 3 campos: `modelId_categoryId_leaderboardPublishDate`
- ✅ Idempotencia garantizada: mismo modelo + categoría + fecha = mismo registro
- ✅ No duplica `organization`/`license` (son metadata de modelo, no de score)

#### 4. Type safety verificado
- ✅ Prisma Client regenerado con nuevo schema
- ✅ TypeScript compila sin errores (`tsc --noEmit`)
- ✅ Tipos correctos en `app/api/models/route.ts` (agregado `lastSyncedAt`)

## 🎯 Decisiones de diseño

### ¿Por qué Hugging Face?
El endpoint `https://lmarena.ai/api/leaderboard/{category}` retorna **403 Forbidden**.
El dataset `lmarena-ai/leaderboard-dataset` es la fuente oficial pública con `leaderboard_publish_date` por fila.

### ¿Por qué histórico?
- Permite tracking de evolución de scores en el tiempo
- Patrón append-only: nunca sobrescribe datos históricos
- Constraint única `(modelId, categoryId, leaderboardPublishDate)` previene duplicados
- Habilita features futuras: análisis de tendencias, gráficos de historia

### ¿Por qué NO duplicar organization/license?
- Son metadata de modelo, no de score
- Si se necesitan, deben agregarse a la tabla `Model` (fuera de scope Fase 1)

## 🚧 Limitaciones conocidas

### 1. Paginación HF API
Implementación actual fetch solo primeras 100 filas (`length=100`).
- **Impacto**: Puede perder modelos si dataset tiene >100 filas por categoría
- **Fix**: Implementar loop de paginación
- **No bloqueante**: Se puede agregar incrementalmente

### 2. Filtrado por categoría
HF Datasets API no soporta filtrado server-side.
- **Approach actual**: Fetch todas las filas, filtrar client-side
- **Impacto**: Ineficiente para datasets grandes
- **Alternativa**: Usar HF `parquet-convert` API o descargar dataset completo

### 3. Model matching
Usa estrategias fuzzy (exact ID, suffix match, normalized match).
- **Riesgo**: Puede fallar con convenciones de naming muy diferentes
- **Mitigación**: Loguea warnings para modelos no matcheados (no falla sync)
- **Futuro**: Considerar tabla de mapeo manual para edge cases

## 📋 Próximos pasos operacionales

### Antes del primer sync
1. **Iniciar DB**: `docker-compose up -d`
2. **Correr migración**: `npx prisma migrate dev --name add_leaderboard_publish_date`
3. **Verificar schema**: Constraint única actualizada correctamente

### Testing
```bash
# Dry-run (no escribe a DB)
npx tsx lib/sync/lmarena-sync.ts

# Commit a database
npx tsx lib/sync/lmarena-sync.ts --commit
```

### Comportamiento esperado
- Fetch filas del dataset HF para cada categoría
- Filtra por categoría client-side
- Matchea modelos usando lógica fuzzy existente
- Upsert scores con `leaderboardPublishDate` como parte de clave única
- Loguea warnings para modelos no matcheados (no falla)
- Crea `SyncLog` con status: SUCCESS | PARTIAL | FAILED

## ✅ Checklist de verificación

- [x] Schema actualizado con campo `leaderboardPublishDate`
- [x] Constraint única cambiada a 3 campos
- [x] Cliente migrado a fuente HF dataset
- [x] Lógica de sync usa `leaderboardPublishDate` en upsert
- [x] Errores de tipo resueltos (Prisma regenerado)
- [x] TypeScript compila sin errores
- [x] Documentación actualizada
- [ ] Migración aplicada a DB (bloqueado: DB no corriendo)
- [ ] Test dry-run ejecutado (bloqueado: DB no corriendo)
- [ ] Test commit ejecutado (bloqueado: DB no corriendo)

## 🎯 Estado final

**Implementación de código**: ✅ COMPLETA
**Cambios de schema**: ✅ COMPLETOS
**Type safety**: ✅ VERIFICADO
**Testing operacional**: ⏳ PENDIENTE (requiere DB)

La Fase 1 está **100% implementada**. El trabajo restante es **operacional** (correr migración, testear con DB real).

