# Proposal: Fix Model Name Truncation

## Intent
Improve UX for model names in DataMatrix and models page. Currently, long names like "Gemini 2.5 Flash P..." are truncated and unreadable. We need a way for users to view full names and a more flexible UI system.

## Scope

### In Scope
- Add CSS fixes to allow word wrapping/breaking for long model names (short term).
- Implement ViewModeSelector (Grid, List, Table, Compact) (medium term).
- Persist view mode in localStorage.

### Out of Scope
- Major architectural redesign of the optimizer page.

## Capabilities

### New Capabilities
- iew-mode-management: Capability to switch and persist UI view modes across optimizer and models page.

### Modified Capabilities
- model-display: Requirement to display full model names without truncation.

## Approach
1. Short-term: Update CSS classes in DataMatrix and models/page to use reak-words and leading-tight.
2. Medium-term: Develop ViewModeSelector component and integrate it into optimizer and models pages. Use session-scoped keys in localStorage for persistence.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| components/optimizer/DataMatrix.tsx | Modified | Update CSS for model name rendering |
| pp/models/page.tsx | Modified | Update CSS for model name rendering |
| components/shared/ViewModeSelector.tsx | New | UI component for view switching |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CSS layout breakage | Medium | Thorough visual testing in different view modes |

## Rollback Plan
Revert CSS changes and remove ViewModeSelector component usage.

## Dependencies
None.

## Success Criteria
- [x] Model names are fully readable in all views (List/Table/etc).
- [x] View mode preference is persisted per session.

---

**Status**: ✅ Completed  
**Implementation**: Commit 8650c28  
**Verified**: 2026-04-15 02:12
