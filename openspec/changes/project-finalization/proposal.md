# Proposal: Project Finalization

## Intent

The previous change (`advanced-refinements-polish`) delivered core persistence, docs, inline guide, and cleanup. Several items remain unresolved: all images referenced in code (`/bg-hero.png`, `/banner-v2.png`, `/author-yo.png`, `/author-v2.png`, `/avatar-admin.png`) are missing from `public/`, the ES/EN toggle is cosmetic-only, the User icon links to Settings instead of a dedicated `/profiles` page, and the Topbar nav is inconsistent across app pages.

## Scope

### In Scope
- **Image placeholders**: Replace broken `/bg-hero.png`, `/banner-v2.png`, `/author-yo.png`, `/author-v2.png`, `/avatar-admin.png` with seeded Picsum URLs or `next/image` `placeholder="blur"` fallbacks; no user-visible 404s
- **Language Context**: Lift `LanguageToggle` state into a `LanguageContext` (React Context); expose `useLang()` hook; apply translations to main UI labels (Topbar nav, Sidebar nav, Optimizer page headings)
- **Profiles page**: Create `/profiles` route — user preferences UI (name, avatar URL, preferred language, preferred tier); persist to `localStorage`; link from Topbar User icon and Sidebar avatar button
- **Navigation consistency**: Audit Topbar `!isLanding` nav links — add missing pages (Settings, Docs) to match Sidebar; ensure all 5 app pages (Optimizer, History, Models, Settings, Docs) are reachable from Topbar
- **Underscore audit**: Grep all UI-visible labels for `_`; remove/replace
- **Pending tasks from previous change**: Complete tasks 1.1, 1.2, 4.1, 4.2 from `advanced-refinements-polish/tasks.md` (logo typography, sidebar audit, build metadata in Settings, Shell footer wiring)

### Out of Scope
- Full i18n library (next-intl, react-i18next) — lightweight inline string map only
- Backend/DB user accounts
- Mobile redesign
- Dark/light theme toggle

## Capabilities

### New Capabilities
- `language-context`: App-wide ES/EN language state via React Context; `useLang()` hook; inline string map for main labels
- `user-profiles`: `/profiles` page with `localStorage`-backed user preferences (name, avatar URL, lang, tier); linked from layout icons

### Modified Capabilities
- `navigation-layout`: Topbar and Sidebar nav extended to cover all 5 app pages consistently; User icon re-routed to `/profiles`

## Approach

1. **Images** — Create `lib/utils/placeholder-image.ts` with a `picsum(seed, w, h)` helper; replace all broken `src="/xxx.png"` with seeded Picsum URLs as temporary stand-ins; add a `// TODO: replace with real asset` comment
2. **Language Context** — Create `lib/context/LanguageContext.tsx`: `createContext`, `LanguageProvider`, `useLang()`; minimal string map `LABELS: Record<'ES'|'EN', {...}>` for nav items and page headings; wrap app in `layout.tsx`; `LanguageToggle` dispatches to context instead of local state
3. **Profiles page** — `app/profiles/page.tsx` (Client Component): form with name, avatar URL, preferred language select, preferred tier select; `useEffect` loads/saves `localStorage` key `sdd-user-profile`; update `Topbar` User icon → `/profiles`; update `Sidebar` avatar `onClick` → `/profiles`
4. **Nav consistency** — Add Settings + Docs links to Topbar `!isLanding` nav; verify active-state highlighting matches Sidebar pattern
5. **Pending tasks** — Logo typography (Topbar), build version in Settings, Shell footer wire, sidebar audit

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `public/` | No files added | Images replaced with Picsum URLs in code (user adds real files later) |
| `components/landing/LandingHero.tsx` | Modified | `src="/bg-hero.png"` → Picsum URL |
| `app/page.tsx` | Modified | `src="/banner-v2.png"`, `src="/author-v2.png"` → Picsum URLs |
| `components/landing/AuthorSection.tsx` | Modified | `src="/author-yo.png"` → Picsum URL |
| `components/layout/Sidebar.tsx` | Modified | Avatar `onClick` → `/profiles`; `/profiles` nav item added |
| `components/layout/Topbar.tsx` | Modified | User icon → `/profiles`; nav extended; logo typography |
| `lib/context/LanguageContext.tsx` | New | App-wide language state and `useLang()` hook |
| `lib/utils/placeholder-image.ts` | New | Picsum seed helper utility |
| `components/landing/LanguageToggle.tsx` | Modified | Dispatches to context instead of local state |
| `app/profiles/page.tsx` | New | User preferences page |
| `app/layout.tsx` | Modified | Wrap with `<LanguageProvider>` |
| `app/settings/page.tsx` | Modified | Add build version from `package.json` |
| `components/layout/Shell.tsx` | Modified | Wire footer utility icons |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SSR hydration mismatch with `localStorage` in profiles page | Low | Read only in `useEffect`; default state to empty strings |
| Picsum URLs broken in offline/CI environments | Low | Use `unoptimized` prop on `next/image`; document as temporary |
| `LanguageContext` causing unnecessary re-renders | Low | Memoize context value; apply translations only at leaf label points |
| Topbar nav changes break active-state detection | Low | Reuse existing `pathname === href` pattern from Sidebar |

## Rollback Plan

All changes are additive or file-confined. Revert individual files via git. Picsum URLs are explicit — revert to original broken paths if user prefers to add real assets. The `/profiles` page is a standalone route — removing it is safe. The `LanguageContext` wrapper in `layout.tsx` can be stripped without affecting other functionality.

## Dependencies

- No new npm packages required (React Context is built-in; Picsum is a public CDN)
- `package.json` version field (already exists) for Settings build info

## Success Criteria

- [ ] No 404 errors for image `src` attributes in the running app
- [ ] ES/EN toggle updates nav label text across Topbar and Sidebar
- [ ] `/profiles` page loads; preferences persist across navigation
- [ ] User icon in Topbar and avatar in Sidebar navigate to `/profiles`
- [ ] Topbar `!isLanding` nav matches Sidebar nav coverage (Optimizer, History, Models, Settings, Docs)
- [ ] No underscore characters visible in any UI label or heading
- [ ] Settings page displays correct version from `package.json`
- [ ] `tsc --noEmit` passes with 0 errors after all changes
