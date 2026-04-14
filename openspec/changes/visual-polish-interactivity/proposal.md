# Proposal: Visual Polish, Deep Interactivity & Social Integration

## Intent

The current UI has placeholder images, truncated text, static pages (History, Models, Settings) with no drill-down capability, and missing real social links. This change elevates the app from functional prototype to polished product: visual refinement across all pages, modal-based deep interactivity for Logs/Models/Phase Categories, wired social links (YouTube, GitHub, Alan's channels), and an enriched Settings page with Admin Panel actions — all backed by the existing PostgreSQL database.

## Scope

### In Scope
- **Visual Polish**: Remove underscores from display labels, fix text cutoffs, replace placeholder images/avatars with real assets or styled SVG fallbacks, update background with subtle pattern/noise effects
- **Landing Refinements**: Adjust "Paso" step labels (uppercase, larger), swap `picsum` images for real or deterministic branded images, increase step card font sizes
- **Deep Interactivity — Logs Modal**: Click any history row → modal with full `OptimizationJob` detail (input, results JSON, ModelSelection list, status, timestamps) + internal pagination for ModelSelections
- **Deep Interactivity — Models Modal**: Click any model card → modal with full `Model` detail (provider, tier, context window, cost, strengths, discoveredByAI flag)
- **Deep Interactivity — Phase Categories Modal**: Click any PhaseCard or phase label → modal listing all models assigned to that phase across tiers, paginated
- **Social Links**: Wire GitHub, YouTube, and Alan Bernal (Gentleman Programming) links with real URLs in Landing and Shell
- **Settings Enhancements**: Add Admin Panel section with actions (Trigger OpenRouter sync, Clear cache, Re-run seed) + display `AppSiteLink` and build info
- **DB backing**: New `GET /api/history/[id]` route for job detail; `GET /api/models/[id]` for model detail; `GET /api/phases/[phase]` for phase model list; `POST /api/admin/[action]` for admin actions

### Out of Scope
- Full OpenRouter sync implementation (already tracked as remaining task 4.1)
- New database schema migrations (reuse existing models)
- Authentication / access control for admin actions
- Dark/light theme toggle
- Mobile-specific redesign

## Capabilities

### New Capabilities
- `log-detail-modal`: Full OptimizationJob detail view with ModelSelection list, triggered from History page rows
- `model-detail-modal`: Full Model detail view triggered from Models page cards
- `phase-detail-modal`: Per-phase model roster modal triggered from Optimizer PhaseCards
- `admin-panel`: Settings page admin actions section (sync, clear cache, re-seed) with API routes
- `social-links`: Wired social link components with real URLs for GP and author channels

### Modified Capabilities
- None (no existing `openspec/specs/` to delta against — `openspec/specs/` is empty)

## Approach

1. **Polish pass first** — fix labels, text, backgrounds, images across all pages with no new dependencies
2. **Modal system** — single reusable `<Modal>` wrapper (Framer Motion `AnimatePresence`) + three data-fetching modal components
3. **API routes** — `[id]` dynamic segments reuse Prisma client; admin routes call existing lib functions
4. **Social links** — constants file with all URLs; injected into `LandingPage` and `Shell`
5. **Settings Admin Panel** — new section in `settings/page.tsx` calling `/api/admin/[action]`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/page.tsx` | Modified | Fix images, paso labels, social links wired |
| `app/history/page.tsx` | Modified | Row click → LogDetailModal |
| `app/models/page.tsx` | Modified | Card click → ModelDetailModal |
| `app/optimizer/page.tsx` | Modified | Phase label click → PhaseDetailModal |
| `app/settings/page.tsx` | Modified | Admin Panel section added |
| `app/api/history/[id]/route.ts` | New | GET single job detail |
| `app/api/models/[id]/route.ts` | New | GET single model detail |
| `app/api/phases/[phase]/route.ts` | New | GET phase model roster |
| `app/api/admin/[action]/route.ts` | New | POST admin actions |
| `components/ui/Modal.tsx` | New | Reusable modal wrapper |
| `components/history/LogDetailModal.tsx` | New | Job detail modal |
| `components/models/ModelDetailModal.tsx` | New | Model detail modal |
| `components/optimizer/PhaseDetailModal.tsx` | New | Phase roster modal |
| `components/landing/LandingHero.tsx` | Modified | Background effects |
| `components/layout/Shell.tsx` | Modified | Social links wired |
| `lib/constants/social-links.ts` | New | Centralized URL constants |
| `app/globals.css` | Modified | Background noise/pattern utility |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Admin actions mutate DB in dev without confirmation | Med | Add confirmation dialog before destructive actions |
| Real image URLs may be blocked by Next.js `domains` config | Low | Use `next.config.ts` `remotePatterns` or fallback to local SVG |
| Modal z-index conflicts with Topbar | Low | Use `z-50` portal pattern, test on all pages |

## Rollback Plan

All new API routes are additive. Modal components are opt-in via click handler. Admin Panel is display-only until user explicitly triggers an action. To rollback: remove the new `app/api/` directories and modal components; revert `app/page.tsx`, `history/page.tsx`, `models/page.tsx`, `optimizer/page.tsx`, and `settings/page.tsx` to prior versions via git.

## Dependencies

- Existing: `motion/react` (already installed), Prisma client, `lucide-react`
- No new npm packages required

## Success Criteria

- [x] No placeholder `picsum` URLs remain on Landing page
- [x] All "Paso" step labels render without underscores, at increased font size
- [ ] Clicking a History row opens a modal with full job details and ModelSelection list
- [ ] Clicking a Model card opens a modal with all model fields
- [ ] Clicking a PhaseCard opens a modal listing models assigned to that phase
- [x] GitHub and YouTube social links navigate to real URLs (not `#`)
- [ ] Settings page shows Admin Panel with at least 2 callable actions
- [x] `tsc --noEmit` passes with 0 errors after all changes
