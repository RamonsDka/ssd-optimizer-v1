# Tasks: Visual Polish, Deep Interactivity & Social Integration

## Phase 1: Asset Migration & Visual Polish (Batch 1) ✅

- [x] 1.1 Replace all picsum.photos URLs with local /public/ asset paths via ASSETS constant
- [x] 1.2 Update LandingHero background to use local `/panel.jpeg` via `ASSETS.landingBg`
- [x] 1.3 Update Landing page banner to use `/plataforma.jpg` via `ASSETS.banner`
- [x] 1.4 Update Landing page author avatar to use `/autor.jpg` via `ASSETS.authorAvatar`
- [x] 1.5 Update Sidebar admin avatar to use `/yo.jpeg` via `ASSETS.adminAvatar`
- [x] 1.6 Update AuthorSection profile avatar to use `/yo.jpeg` via `ASSETS.profileAvatar`
- [x] 1.7 Fix "GUIA" → "GUÍA" typography (accent mark) in translations and page
- [x] 1.8 Fix "PODRAS" → "PODRÁS" and "LISTADOS" → "LISTADO" and "LENGUAJES-IAS" → "LENGUAJE-IA" in guide description
- [x] 1.9 Fix "pagina/seccion" → "página/sección" in bottom quote text
- [x] 1.10 Enhance GuideStep typography: number → `text-5xl font-black`, "Paso" → `text-lg font-black`
- [x] 1.11 Enhance section headers: "AGRADECIMIENTOS" and "GUÍA" to `text-5xl md:text-6xl font-black`
- [x] 1.12 Verify hero background effects: gradient-overlay + AnimatedLines SVG + scan-lines CSS all active
- [x] 1.13 Replace hardcoded "SDD Team Optimizer" and "v0.1.0" with APP_NAME/APP_VERSION constants
- [x] 1.14 Update asset-mapping.ts: all semantic aliases point to local assets, no picsum fallbacks needed
- [x] 1.15 Update footer copyright year to 2026
- [x] 1.16 Verify social links are wired with real URLs (confirmed: all SOCIAL_LINKS constants have real URLs)
- [x] 1.17 TypeScript `tsc --noEmit` passes with 0 errors

## Phase 2: Deep Interactivity — Modals (Remaining)

- [ ] 2.1 Create `components/ui/Modal.tsx` — reusable modal wrapper with AnimatePresence
- [ ] 2.2 Create `components/history/LogDetailModal.tsx` — full OptimizationJob detail view
- [ ] 2.3 Create `app/api/history/[id]/route.ts` — GET single job detail endpoint
- [ ] 2.4 Create `components/models/ModelDetailModal.tsx` — full Model detail view
- [ ] 2.5 Create `app/api/models/[id]/route.ts` — GET single model detail endpoint
- [ ] 2.6 Create `components/optimizer/PhaseDetailModal.tsx` — per-phase model roster modal
- [ ] 2.7 Create `app/api/phases/[phase]/route.ts` — GET phase model list endpoint

## Phase 3: Settings Enhancements & Admin Panel (Remaining)

- [ ] 3.1 Create `app/api/admin/[action]/route.ts` — POST admin actions (sync, clear-cache, re-seed)
- [ ] 3.2 Add Admin Panel section to Settings page with action buttons
- [ ] 3.3 Add AppSiteLink and build info display to Settings page

## Phase 4: Polish & Verification (Remaining)

- [ ] 4.1 Add confirmation dialogs for destructive admin actions
- [ ] 4.2 Ensure all modal z-index values work correctly across all pages
- [ ] 4.3 Full TypeScript compilation check after all changes
- [ ] 4.4 Verify no picsum URLs remain anywhere in the codebase