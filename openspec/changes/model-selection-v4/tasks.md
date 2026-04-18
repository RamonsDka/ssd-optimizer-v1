# Tasks: Motor de Selección V4

## Fase 1: Schema y Migración de BD
- [x] 1.1 Actualizar `prisma/schema.prisma` con el modelo `ModelCapabilities` (17 campos).
- [x] 1.2 Agregar índices en `ModelCapabilities` para optimizar búsquedas por `modelId` y `phase`.
- [x] 1.3 Ejecutar `npx prisma migrate dev --name add_model_capabilities`.
- [x] 1.4 Crear script `scripts/migrate-v3-to-v4-data.ts` para poblar capacidades iniciales.
- [x] 1.5 Ejecutar script de migración y verificar datos en BD.

## Fase 2: Implementar Scoring Engine V4
- [ ] 2.1 Crear `lib/optimizer/v4/phase-weights.ts` con el mapa de 17 pesos por fase.
- [ ] 2.2 Crear `lib/optimizer/v4/special-rules.ts` con lógica de bonuses/penalizaciones.
- [ ] 2.3 Crear `lib/optimizer/v4/scoring-engine-v4.ts` implementando `calculate_phase_score()`.
- [ ] 2.4 Implementar lógica de agregación de scores finales en `scoring-engine-v4.ts`.

## Fase 3: Servicios de BD y Cache
- [x] 3.1 Extender `lib/db/oim-service.ts` con CRUD para `ModelCapabilities`.
- [x] 3.2 Implementar `getCapabilitiesByModelId` con cache (TTL 1h) en `oim-service.ts`.
- [x] 3.3 Implementar `updateModelScores` para persistir resultados de benchmarks.

## Fase 4: Integración con Selector
- [ ] 4.1 Modificar `lib/optimizer/selector.ts` para leer `SCORING_VERSION` del entorno.
- [ ] 4.2 Implementar switch en `selector.ts` para usar Engine V4 si la versión es `v4`.
- [ ] 4.3 Implementar fallback a V3 en `selector.ts` ante errores en el cálculo V4.
- [ ] 4.4 Actualizar `lib/orchestrator/oim-orchestrator.ts` para pasar contexto V4 al selector.

## Fase 5: Testing y Validación
- [x] 5.1 Crear `tests/unit/scoring-engine-v4.test.ts` (validar 17 pesos y reglas especiales).
- [x] 5.2 Crear `tests/integration/selector-v4.test.ts` (flujo completo con BD).
- [x] 5.3 Crear `tests/e2e/fallback-v3.test.ts` (verificar que no se rompa nada si V4 falla).
- [x] 5.4 Documentar el mapeo de capacidades en `docs/model-selection-v4.md`.
