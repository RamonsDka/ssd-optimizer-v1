# Tasks: Advanced Refinements, Persistence & UI Polish

## Batch 1: Typography & Sidebar (pending)

- [ ] 1.1 Apply custom typography to "SDD OPTIMIZER" logo in `components/layout/Topbar.tsx` (pink, Space Grotesk, distinct weight).
- [ ] 1.2 Audit `components/layout/Sidebar.tsx` — verify `/docs` route already exists; fix any missing nav items.

## Batch 2: Core Features & Animations ✅ COMPLETE

- [x] 2.1 **Background Animation** — In `components/landing/LandingHero.tsx`, implement animated SVG "moving lines" over `/bg-hero.png` using Framer Motion. Added `<AnimatedLines />` component with 6 glowing diagonal lines + 1 glitch streak. "VER DOCUMENTACIÓN" button now links to `/docs`.
- [x] 2.2 **Documentation Page** — Created `app/docs/page.tsx` — structured, colorful React Server Component. Sections: ¿Qué es?, Guía Rápida (4 pasos), Arquitectura, Perfiles, Las 10 Fases SDD, Stack Tecnológico, Instalación Local, Créditos. Uses Kanagawa palette + 0px radius. Linked from hero button and sidebar.
- [x] 2.3 **Optimizer UX - Inline Guide** — Created `components/optimizer/GuideSteps.tsx`. In `app/optimizer/page.tsx`, the guide renders via `AnimatePresence` ONLY when `recommendation` is null. Exits with animation once results are generated.
- [x] 2.4 **Result Persistence** — Created `lib/hooks/useOptimizerPersistence.ts`. Hook uses `localStorage` to save/load `TeamRecommendation`. SSR-safe (reads in `useEffect`). `optimizer/page.tsx` updated to use the hook: loads on mount, saves on result, exposes "Limpiar" button with `clear()`.

## Batch 3: Modal & Settings Enhancements ✅ COMPLETE

- [x] 3.1 **Modal Cleanup** — Removed "Deploy Local Node" button from `ModelDetailModal.tsx`. Added Provider Context section (provider description, specialty, visit link). Added "Best Used For" heuristic section (maps strengths to SDD phases). Also removed "DEPLOY LOCAL NODE" card from `app/models/page.tsx`.
- [x] 3.2 **Settings Overhaul** — Added "Recommended Toolkit" section to `app/settings/page.tsx` with real links to Prisma Docs, Tailwind CSS, and Framer Motion. Added real "System Actions" section: "Clear Local Persistence" (clears localStorage keys with sdd- prefix) and "Trigger Catalog Sync" (calls /api/sync). Removed redundant OpenRouter Sync standalone button.
- [x] 3.3 **Utility Icons Functionalization** — In `components/layout/Topbar.tsx`, wired 4 utility icons: Activity → `router.refresh()` (refreshes current page), Globe → `/models`, Settings → `/settings`, User → `/settings`.
- [x] 3.4 **Project Hygiene** — Deleted `_vite_old/` directory. Removed `_vite_old` from tsconfig.json exclude list. Verified no imports reference the old directory. Removed unused `PlusCircle` import from models page, unused `handleOpenRouterSync` from settings page.

## Batch 4: Settings & Footer (pending)

- [ ] 4.1 Update `app/settings/page.tsx` — add version from `package.json` to build info section (partially done — Toolkit section added).
- [ ] 4.2 Wire footer utility icon actions in `components/layout/Shell.tsx`.

## Batch 5: Verification

- [x] 5.1 Run `tsc --noEmit` — passes with 0 errors after Batch 3 changes.
- [ ] 5.2 Verify animated lines render and animate in hero section.
- [ ] 5.3 Verify `/docs` page loads and renders all sections.
- [ ] 5.4 Verify guide disappears once optimizer result is rendered.
- [ ] 5.5 Verify localStorage persistence: navigate away from optimizer and return — result must be restored.
- [ ] 5.6 Verify "Limpiar" button clears both state and localStorage.