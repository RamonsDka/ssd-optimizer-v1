# Proposal: Advanced Refinements, Persistence & UI Polish

## Intent

The app works functionally but has visual rough edges, broken UX flows, missing persistence across navigation, a non-existent `/docs` page, inconsistent sidebar routing, and dead UI elements (footer icons, Deploy Local buttons). This change transforms the product from "working prototype" to "polished, production-ready tool" — addressing typography, animated backgrounds, image swaps, optimizer UX ordering, result persistence, and full Settings/Footer functionality.

## Scope

### In Scope
- **Typography**: Custom font style applied to "SDD OPTIMIZER" logo text in the Topbar (pink, bold, styled distinct from body font)
- **Sidebar sync**: Add `/docs` route to sidebar nav across all pages; audit any missing routes
- **Docs page**: New `/docs` route dynamically rendering the project README as formatted HTML
- **Hero layout**: Remove the `Visual Asset` server-room `<Image>` block from `LandingHero`; shift hero text content upward
- **Animated background**: Image 8 (to be moved to `public/`) used as translucent, animated background behind hero text (CSS keyframe or Framer Motion)
- **Image swaps**: Replace picsum images — banner (Image 9→10), author quote avatar (Image 11→12), author profile (Image 13→14); all real images moved to `public/`
- **Optimizer UX**: Display Guide steps (from Landing `/guide` section) inside the Optimizer console **before** results arrive; hide them once results render
- **Result persistence**: Optimizer results survive page navigation via `localStorage` (load on mount, save on result); cleared on explicit reset
- **Cleanup**: Remove all non-functional "Deploy Local" buttons; add real model provider/context-window details where stubbed
- **Settings overhaul**: Recommendations section wired to real library links; system actions verified functional; display build metadata
- **Footer icons**: Wire utility icons in the footer (Image 26 reference) with real actions or links
- **Project hygiene**: Audit and remove unused directories/files (`_vite_old/`, stale assets, dead code)

### Out of Scope
- Auth/access-control for admin panel
- New DB schema migrations
- OpenRouter sync full implementation (tracked separately)
- Dark/light theme toggle
- Mobile-specific redesign

## Capabilities

### New Capabilities
- `docs-page`: Dynamic `/docs` route rendering README.md as structured, styled HTML page
- `optimizer-guide-inline`: Guide steps shown in Optimizer console pre-results, hidden post-results
- `optimizer-result-persistence`: LocalStorage-backed result state that survives navigation

### Modified Capabilities
- None (openspec/specs/ is empty — no existing delta specs)

## Approach

1. **Typography + Logo** — Add CSS class or inline style to Topbar logo; use `Space_Grotesk` variable with custom weight/color
2. **Sidebar** — Add `<NavItem href="/docs" ...>` to Sidebar nav; verify Shell routing is consistent
3. **Docs page** — `app/docs/page.tsx` (Server Component): read `README.md` via `fs.readFileSync`, parse with `marked` or `remark`, render as styled prose
4. **Hero** — Remove `<motion.div>` Visual Asset block from `LandingHero.tsx`; add negative `mt` or `pb` adjustment on hero text block
5. **Animated background** — In `LandingHero.tsx`, add a fixed-positioned `<Image>` with `opacity-10` + CSS `animate-float` or Framer Motion `y` loop behind all content
6. **Image swaps** — Copy Images 9–14 into `public/`; update `src` props in `app/page.tsx`; update `next.config.ts` if needed
7. **Optimizer guide** — In `optimizer/page.tsx`, render `<GuideSteps />` component above `<InputModule>`; wrap in `AnimatePresence` to exit on `recommendation` present
8. **Persistence** — Custom hook `useOptimizerPersistence` in `lib/hooks/`: save to `localStorage` on `handleResult`, load on mount, expose `clearResult`
9. **Cleanup** — `grep` for "Deploy Local" and remove; audit `_vite_old/` and delete
10. **Settings** — Add real library URLs to Recommendations; verify admin actions call correct API; add `version` from `package.json` to build info section
11. **Footer icons** — Wire icon buttons in Shell footer with real `href` or modal trigger

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/layout/Topbar.tsx` | Modified | Logo typography — pink, distinct font style |
| `components/layout/Sidebar.tsx` | Modified | Add `/docs` nav item |
| `app/docs/page.tsx` | New | README-driven documentation page |
| `components/landing/LandingHero.tsx` | Modified | Remove server image; add animated bg image |
| `app/page.tsx` | Modified | Swap picsum images 9/11/13 → real assets |
| `public/` | New files | Images 8, 10, 12, 14 copied here |
| `app/optimizer/page.tsx` | Modified | Guide steps shown pre-result, hidden after |
| `components/optimizer/GuideSteps.tsx` | New | Extracted Guide step component for Optimizer |
| `lib/hooks/useOptimizerPersistence.ts` | New | LocalStorage hook for result persistence |
| `app/settings/page.tsx` | Modified | Real lib links in Recommendations; build info |
| `components/layout/Shell.tsx` | Modified | Wire footer icon actions |
| `_vite_old/` | Removed | Delete entire directory (dead code) |
| `next.config.ts` | Modified | Ensure `public/` images are not remote-patterned |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `fs.readFileSync` fails in Edge runtime for `/docs` | Low | Force `export const runtime = 'nodejs'` in docs page |
| `localStorage` hydration mismatch (SSR vs client) | Low | Read only in `useEffect`; use `useState(null)` default |
| Removing `_vite_old/` breaks a stale import | Low | Run `tsc --noEmit` before and after deletion |
| Image 8 animated background causes layout shift | Low | Use `position: absolute`, `z-index: -1`, `pointer-events: none` |

## Rollback Plan

All changes are additive or confined to existing files. Git revert per file is safe. Deleting `_vite_old/` is the only irreversible step — confirm no imports reference it before removal. `localStorage` persistence is opt-in via hook; remove hook usage to revert to stateless behavior.

## Dependencies

- `marked` or `remark` (new npm pkg) for README parsing, OR use `dangerouslySetInnerHTML` with sanitized output via `dompurify` — evaluate at design phase
- Existing: `motion/react`, `next/image`, `lucide-react`, `localStorage` (browser native)

## Success Criteria

- [ ] "SDD OPTIMIZER" logo in Topbar renders in pink with distinct typography
- [ ] Sidebar nav includes `/docs` on all app pages
- [ ] `/docs` route loads and renders README content as styled HTML
- [ ] Hero section has no server-room image; text appears higher on screen
- [ ] Image 8 renders as animated translucent background in the hero
- [ ] Banner, quote avatar, and author profile images use real local assets (not picsum)
- [ ] Guide steps appear in Optimizer console before any result; disappear after results load
- [ ] Navigating away from Optimizer and back restores previous results
- [ ] No "Deploy Local" button exists anywhere in the UI
- [ ] Settings Recommendations include real, clickable library/tool links
- [ ] Footer utility icons perform a real action (link, modal, or copy)
- [ ] `_vite_old/` directory does not exist
- [ ] `tsc --noEmit` passes with 0 errors after all changes
