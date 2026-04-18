# Tasks: Critical Fixes — Pool, Discovery, UI Polish, Translations & V4 Engine Issues

## Phase 1: Orchestrator Fixes

- [x] 1.1 **Strict Pool** — In `oim-orchestrator.ts`, update pool logic to strictly prioritize `inputModels` over `dbFallback` when `inputModels.length > 0`. Only fall back to `dbFallback` when the user provided no models.
- [x] 1.2 **Forced Discovery** — In `oim-orchestrator.ts`, before V3/auto scoring, detect models missing from `UnifiedModelScores` and run embedding-based estimation via `categorizeModel()`, then upsert as `WEB_INFERRED` source.

## Phase 2: UI Polish

- [x] 2.1 **TerminalUI completion banner** — When `loading=false` and `events.length > 0` (pipeline done), show "FINALIZADO, RESULTADOS MÁS ABAJO" with a `CheckCircle2` icon and animated `ArrowDown`. Translatable via `t("optimizer", "terminalFinalized")`.
- [x] 2.2 **SystemMaintenanceSection Admin gate** — Added `isAdmin` prop and default env-var check (`NEXT_PUBLIC_ADMIN_MODE === "true"`). Section returns `null` when not admin. Settings page passes `isAdmin={flags.nodeEnv === "development" || ...}`.

## Phase 3: Translations

- [x] 3.1 **translations.ts** — Added new keys: `terminalFinalized`, `v2v3Title`, `v2v3Subtitle`, `hideMatrix`, `showMatrix`, `v3HintText`, `scoringEngineLabel`, `viewModelDetails`, `rosterLabel`.
- [x] 3.2 **DataMatrix.tsx** — Translated `title="Ver detalles del modelo"` → `t("optimizer", "viewModelDetails")`.
- [x] 3.3 **PhaseCard.tsx** — Translated hardcoded `roster` text → `t("optimizer", "rosterLabel")`.
- [x] 3.4 **OptimizerPage.tsx** — Translated `"Scoring Engine"`, `"V2 vs V3 Engine Comparison"`, `"Side-by-side scoring diff…"`, `"Hide Matrix"` / `"Show Matrix"`, and the V3 hint text.

## Phase 4: Type Check

- [x] 4.1 Run `tsc --noEmit` — 0 errors after all changes.

## Phase 5: V4 Engine Critical Fixes (verify-report blockers)

- [x] 5.1 **Default Strategy `env`** — Change default strategy in `app/api/optimize/route.ts` from `"auto"` to `"env"`. SCORING_VERSION env var now governs endpoint behavior by default.

- [x] 5.2 **API Debug Field** — Extend `OptimizeResponse` in `types/index.ts` with optional `debug?: DebugInfo`. Add `DebugInfo` and `DimensionBreakdownSummary` types. Include `debug` in response when `?debug=true`.

- [x] 5.3 **OrchestratorResult `debugInfo`** — Add `debugInfo: OrchestratorDebugInfo` field to `OrchestratorResult` and `OrchestratorDebugInfo` interface in `oim-orchestrator.ts`. All return paths populated with `{ v4Results: null }`.

- [x] 5.4 **`scoringVersion` in type** — Added `scoringVersion` field to `OptimizeResponse` type (was returned by endpoint but missing from the type contract — warning in verify-report).

- [x] 5.5 **Tests for critical fixes** — Created `lib/optimizer/__tests__/api-route-logic.test.ts` with 9 tests: 5 for default strategy resolution, 4 for debug payload shape.

- [x] 5.6 **`.env.example` documentation** — Added note about `env` default strategy and `?debug=true` usage.

- [x] 5.7 **Type check** — `tsc --noEmit` passes with 0 errors after all changes.

- [x] 5.8 **Full test suite** — 46 tests pass: 15 V4 unit + 12 selector integration + 10 fallback V3 + 9 new API logic.

## Phase 6: Frontend Feature-Flag Bypass Fix (Warning #2)

- [x] 6.1 **`InputModule.tsx` default** — Changed `scoringVersion` prop type to include `"env"` and changed default from `"auto"` to `"env"`. Added JSDoc explaining the SCORING_VERSION feature flag contract. Backward-compat: `"auto"` still accepted.
- [x] 6.2 **`OptimizerPage.tsx` type + state** — Added `"env"` to `ScoringStrategy` type. Changed `scoringStrategy` state default from `"auto"` to `"env"`. Added localStorage migration: old `"auto"` values are upgraded to `"env"` on load.
- [x] 6.3 **`OptimizerPage.tsx` UI toggle** — Changed dropdown buttons from `["auto", "v2", "v3"]` to `["env", "v2", "v3"]`. Button label uses new `strategyEnv` i18n key (`"Auto (.env)"`).
- [x] 6.4 **`translations.ts`** — Added `strategyEnv` (`"Auto (.env)"`) and `strategyEnvFallback` keys. Updated `v3HintText` to remove misleading "or Auto" reference.
- [x] 6.5 **Type check** — `tsc --noEmit` passes with 0 errors after all changes.
