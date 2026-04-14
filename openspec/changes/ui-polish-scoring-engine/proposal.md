# Proposal: UI Polish & Formal Scoring Engine

## Intent

The optimizer grid has four outstanding UX defects and zero explainability for model selection. Users can see *which* model was chosen but not *why* — a critical gap for a tool whose value proposition is transparency. This change fixes the layout bugs, renames one phase label, adds the SDD Orchestrator phase header, and builds a formal multi-factor scoring engine with full modal explainability.

## Scope

### In Scope
- **Scroll icon z-index fix**: Add `z-10` to the scroll indicator in `LandingHero.tsx` so it renders above overlays
- **Fallback rosters expanded by default**: Change `useState(false)` → `useState(true)` in `PhaseCard.tsx`; fallbacks visible on first render
- **Modal scoring explainability**: `PhaseDetailModal` shows a "Logic" section (factor weights breakdown per phase) and a "Fallback" section (why fallback models rank lower than primary); data sourced from the scoring engine
- **Phase rename**: `SDD_PHASE_LABELS["sdd-onboard"]` → `"onboard"` (from `"Incorporación"`); `PHASE_INDEX["sdd-onboard"]` → `"P-09 onboard"` badge
- **SDD Orchestrator header**: Wide rectangular header band above the 2×5 phase grid in `DataMatrix.tsx`; displays tier name + orchestrator label
- **Formal scoring engine**: `lib/optimizer/scoring.ts` — `ScoreBreakdown` type with individual factor contributions (capability, context, cost, speed) per model per phase; wired into `selector.ts` and exposed on `PhaseAssignment`
- **Modal wiring**: `PhaseDetailModal` receives `ScoreBreakdown` for primary and fallbacks; renders factor bars and text explanations

### Out of Scope
- Full redesign of the grid layout
- New SDD phases beyond the existing 10
- i18n for scoring explanation labels (Spanish only for now)
- Backend API changes for scoring data

## Capabilities

### New Capabilities
- `scoring-breakdown`: Formal `ScoreBreakdown` type — per-factor scores (capability, context, cost, speed) with weights and computed contribution; produced by `scoreModelWithBreakdown()` in `lib/optimizer/scoring.ts`
- `score-explainability-modal`: `PhaseDetailModal` panel rendering factor breakdown bars + "why chosen" and "why fallback" narrative text

### Modified Capabilities
- `phase-detail-modal`: Add Logic + Fallback explanation panels fed by `ScoreBreakdown`; existing roster pagination unchanged
- `phase-card-ui`: Default fallbacks to open; Orchestrator header above grid in `DataMatrix.tsx`

## Approach

1. **Scoring engine first** — New `lib/optimizer/scoring.ts` exports `ScoreBreakdown` type and `scoreModelWithBreakdown(model, phase): { score, breakdown }`. The existing `scoreModel()` in `selector.ts` delegates to it for zero regression.
2. **Type propagation** — Add `scoreBreakdown?: ScoreBreakdown` to `PhaseAssignment` type; `buildProfile()` populates it; fallback entries carry their own breakdowns.
3. **Modal panels** — `PhaseDetailModal` receives full `PhaseAssignment` (not just `primaryModel`); renders two new `ModalSection` panels: "Puntuación lógica" (factor bars) and "Por qué fallback?" for each ranked alternate.
4. **Grid header** — `DataMatrix.tsx`: add a full-width `div` above the `grid` with `SDD ORCHESTRATOR` label + current tier badge; `z-10` isolation.
5. **Quick fixes** — `LandingHero.tsx`: scroll indicator gets `z-10`; `PhaseCard.tsx`: `useState(true)`; `types/index.ts`: rename label.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/optimizer/scoring.ts` | New | `ScoreBreakdown` type + `scoreModelWithBreakdown()` |
| `lib/optimizer/selector.ts` | Modified | Delegates to `scoring.ts`; populates `scoreBreakdown` on `PhaseAssignment` |
| `types/index.ts` | Modified | Add `scoreBreakdown?` to `PhaseAssignment`; rename `sdd-onboard` label |
| `components/optimizer/PhaseCard.tsx` | Modified | `useState(true)` for open fallbacks; `P-09 onboard` badge |
| `components/optimizer/DataMatrix.tsx` | Modified | Orchestrator header band above grid |
| `components/optimizer/PhaseDetailModal.tsx` | Modified | Logic + Fallback explainability panels; receives full `PhaseAssignment` |
| `app/optimizer/page.tsx` | Modified | Pass full `selectedPhaseAssignment` to `PhaseDetailModal` |
| `components/landing/LandingHero.tsx` | Modified | `z-10` on scroll indicator div |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `scoreModelWithBreakdown` diverges from legacy `scoreModel` output | Low | New function is the canonical implementation; old function wraps it |
| Modal prop expansion breaks existing `onPhaseClick` call sites | Low | `PhaseDetailModal` already receives `primaryModel`; extend to full `assignment` with optional fallback |
| `useState(true)` causes layout shift on initial paint | Low | Framer `AnimatePresence` already wraps fallbacks; no CLS risk |

## Rollback Plan

All changes are additive or single-file edits. `scoring.ts` is a new file — delete it and revert `selector.ts` import. Modal panels are new `ModalSection` blocks — remove them and the prop type. `PhaseCard` init state: revert to `false`. `LandingHero` z-index: remove `z-10`. Each file is independently revertable via `git checkout`.

## Dependencies

- No new npm packages
- Existing: `motion/react`, `lucide-react`, Tailwind 4, TypeScript strict mode

## Success Criteria

- [ ] Scroll indicator renders above all overlays in `LandingHero`
- [ ] PhaseCard fallback list is visible on first render (no click required)
- [ ] Modal shows factor breakdown bars (capability, context, cost, speed) for primary model
- [ ] Modal shows "why fallback" explanation for each alternate model
- [ ] `SDD_PHASE_LABELS["sdd-onboard"]` === `"onboard"` in all UI surfaces
- [ ] Orchestrator header band renders above the 2×5 grid in every tier
- [ ] `tsc --noEmit` passes with 0 errors after all changes
