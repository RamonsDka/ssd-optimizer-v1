# Proposal: UI Migration & Feature Injection

## Intent

Three prior changes (`visual-polish-interactivity`, `advanced-refinements-polish`, `project-finalization`) left confirmed failures: i18n labels mostly identical across ES/EN, an underscore still visible in the Author terminal mock, no real animated background using Image 8, modals with paginated DB content unfinished, and admin panel interaction via avatar not wired. This change completes every outstanding item and injects the remaining features (profiles, docs, functional social links, animated background) into the current Next.js 15 codebase in a single, coherent pass.

## Scope

### In Scope
- **Logo fix**: Remove underscores from "SDD_OPTIMIZER" → "SDD OPTIMIZER" in Topbar; apply pink bold typography
- **Text cutoff audit**: Fix all truncated/clipped labels across cards, modals, and headings (overflow, line-clamp, padding)
- **Image migration (1–15)**: Move images 1–15 to `public/`; replace all Picsum `seed/*` URLs with local paths in LandingHero, app/page.tsx, AuthorSection, Sidebar
- **Animated background**: Image 8 used as hero background; Framer Motion moving lines overlay effect
- **"Paso" UX**: Fix label positioning (number + "Paso" inline, same row), bigger/bolder step numbers, larger instruction text
- **Log/Model/Phase modals**: Paginated DB-backed content — full job detail, model detail, phase model roster
- **Optimizer persistence**: Ensure results survive full navigation cycle (fix hydration edge cases from verify-report FAIL)
- **`/profiles` page**: User preferences (name, avatar URL, lang, tier); `localStorage` backed; linked from Topbar user icon and Sidebar avatar
- **`/docs` page**: README-driven structured content page; sidebar link active
- **Functional i18n toggle (ES/EN)**: All main labels (nav items, page headings, optimizer headings) have DISTINCT ES vs EN values in translation map
- **Functional social links**: YouTube, GitHub, Gentleman Programming channels linked with real URLs in Landing and Shell footer
- **Admin panel via avatar**: Topbar avatar click → admin modal (trigger sync, clear cache, re-seed); protected by local confirmation dialog
- **Directory hygiene**: Audit and remove unused/redundant folders (any leftover stale assets, old temp directories)
- **Underscore cleanup**: Eliminate `"$ _"` in AuthorSection terminal mock and any remaining underscore in UI-visible text

### Out of Scope
- Full i18n library (next-intl / react-i18next) — lightweight string map only
- Backend DB schema migrations
- Authentication / access control for admin actions
- Dark/light theme toggle
- Mobile redesign
- OpenRouter sync full backend implementation

## Capabilities

### New Capabilities
- `image-asset-migration`: Local image management — Images 1–15 in `public/`; centralized `lib/assets/image-map.ts`
- `animated-hero-background`: Image 8 as hero background with Framer Motion moving lines overlay
- `i18n-labels`: Functional ES/EN string map with distinct values for all main labels; `useLang()` hook consumers updated

### Modified Capabilities
- `log-detail-modal`: Ensure paginated ModelSelections; verify data-fetch route `GET /api/history/[id]`
- `model-detail-modal`: Full model fields rendered; verify `GET /api/models/[id]`
- `phase-detail-modal`: Phase model roster; verify `GET /api/phases/[phase]`
- `user-profiles`: Fix hydration issues; ensure persistent across navigation
- `admin-panel`: Wire to Topbar avatar click; add confirmation dialogs
- `social-links`: Replace placeholder `#` hrefs with real URLs
- `navigation-layout`: Topbar logo and nav item text uses translated labels from i18n context

## Approach

1. **Images first** — Copy Images 1–15 to `public/images/`; create `lib/assets/image-map.ts`; update all consumers
2. **Hero animation** — `LandingHero.tsx`: Image 8 as `next/image` background, `AnimatedLines` framer overlay on top
3. **i18n fix** — Update `lib/i18n/translations.ts` with distinct ES/EN values for every label; wire all consumers
4. **Topbar** — Logo: remove underscores, pink + bold; avatar → admin modal; nav items consume i18n labels
5. **Paso UX** — `app/page.tsx` GuideStep: inline flex row, `text-4xl font-black` number, `text-2xl font-medium` instruction
6. **Modals** — Verify `LogDetailModal`, `ModelDetailModal`, `PhaseDetailModal`; fix pagination if broken; confirm API routes respond
7. **Persistence** — `useOptimizerPersistence`: fix SSR hydration edge case with `useState(null)` + `useEffect` load pattern
8. **Profiles** — `app/profiles/page.tsx` form; `localStorage` keys `sdd-profiles-*`; Topbar + Sidebar navigation
9. **Admin** — `AdminModal.tsx` triggered by Topbar avatar; calls `/api/admin/[action]`; confirmation dialogs
10. **Social links** — `lib/constants/social-links.ts` with real URLs; inject in Landing and Shell footer
11. **Hygiene** — Audit `public/`, `components/`, `lib/` for stale/unused files; remove

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `public/images/` | New files | Images 1–15 migrated here |
| `lib/assets/image-map.ts` | New | Centralized image path constants |
| `lib/i18n/translations.ts` | Modified | Distinct ES/EN values for all labels |
| `lib/constants/social-links.ts` | New | Real social URL constants |
| `components/landing/LandingHero.tsx` | Modified | Image 8 bg + AnimatedLines overlay |
| `components/landing/AuthorSection.tsx` | Modified | Remove `"$ _"` underscore; swap image |
| `components/layout/Topbar.tsx` | Modified | Logo fix, avatar → admin modal, i18n nav |
| `components/layout/Sidebar.tsx` | Modified | Image swap, `/profiles` link |
| `components/layout/Shell.tsx` | Modified | Social links wired |
| `components/ui/AdminModal.tsx` | New | Admin actions modal with confirmation |
| `app/page.tsx` | Modified | Paso UX, image swaps, social links |
| `app/profiles/page.tsx` | Modified | Hydration fix; full preferences form |
| `app/docs/page.tsx` | Verified | Confirm sidebar-linked, renders correctly |
| `app/optimizer/page.tsx` | Modified | Persistence hydration fix |
| `app/api/history/[id]/route.ts` | Verified | Confirm route responds correctly |
| `app/api/models/[id]/route.ts` | Verified | Confirm route responds correctly |
| `app/api/phases/[phase]/route.ts` | Verified | Confirm route responds correctly |
| `app/api/admin/[action]/route.ts` | Verified | Confirm route responds correctly |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hydration mismatch in profiles/optimizer with SSR | Low | `useState(null)` + `useEffect`-only localStorage reads |
| Local images missing or wrong path breaks `next/image` | Low | Use `unoptimized` or `fill` with explicit `width`/`height` |
| Admin actions mutate DB in dev without safeguard | Med | Confirmation dialog required before any POST |
| i18n context re-render cascades | Low | Memoize context value; apply at label leaf only |

## Rollback Plan

All new components are additive. Image migration: revert `src` paths to Picsum URLs if real images are not provided by user. i18n: revert `translations.ts` to prior file. AdminModal: remove trigger from Topbar; component is standalone and tree-shakable. Profiles/docs pages are standalone routes — safe to remove individually. `git revert` per file is sufficient for all file-level changes.

## Dependencies

- No new npm packages required
- Real image files (Images 1–15) must be provided by user and placed at agreed paths
- Existing: `motion/react`, `next/image`, Prisma client, `lucide-react`, React Context

## Success Criteria

- [ ] "SDD OPTIMIZER" logo renders in pink, bold, no underscores
- [ ] No text cutoffs visible in cards, modals, or headings
- [ ] Images 1–15 served from `public/images/`; no 404 image errors
- [ ] Image 8 renders as animated translucent background in hero with moving lines
- [ ] "Paso" label and number appear inline; numbers are `4xl font-black`; instructions are `2xl font-medium`
- [ ] Clicking a History row opens a modal with full job detail and paginated ModelSelections
- [ ] Clicking a Model card opens a modal with all model fields
- [ ] Clicking a Phase label opens a modal listing assigned models
- [ ] Optimizer results persist across full navigation cycle with no hydration errors
- [ ] ES/EN toggle changes ALL main labels to distinct translated values
- [ ] `/profiles` page loads; preferences persist in localStorage across navigation
- [ ] `/docs` page loads from sidebar link; renders all README sections
- [ ] YouTube, GitHub, and social links navigate to real non-`#` URLs
- [ ] Topbar avatar click opens Admin Panel modal with confirmation dialogs
- [ ] No underscore characters visible in any UI label, heading, or terminal mock
- [ ] Unused/redundant directories audited and removed
- [ ] `tsc --noEmit` passes with 0 errors after all changes
