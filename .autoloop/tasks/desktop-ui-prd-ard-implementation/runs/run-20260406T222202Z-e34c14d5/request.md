# Autoloop Task: SkyLensServerless Desktop UI Cleanup & Usability Overhaul (PRD+ARD Implementation)

Implement the approved PRD+ARD for desktop UI cleanup and usability overhaul in SkyLensServerless.

## Objective
Fix desktop UI breakage and deliver a significantly cleaner and more usable interface.

## Required outcomes
1. Desktop quick action row must only show: Open Viewer, Align, Enable AR, Scope.
2. Remove persistent clutter beside quick actions; move secondary/advanced content into Open Viewer.
3. Warning banners must be one-line high by default, with per-item expand and dismiss controls.
4. Clicking outside should close modal/sheet/overlay surfaces consistently; Escape should also close; focus should restore.
5. Desktop settings should no longer be clipped; implement desktop-optimized settings presentation with internal scroll.

## Constraints
- Use plan, implement, and test pairs.
- Do not set max iterations.
- Preserve existing core behavior for permission recovery and viewer operation.
- Maintain or improve accessibility semantics (dialog roles, aria-expanded, keyboard support).
- Update or add tests for changed behavior.

## Plan/Implement/Test Pairs

### Pair 1
- Plan: Simplify desktop quick action row and unify Enable AR intent.
- Implement: Replace split camera/motion entry points with a single Enable AR action resolver in desktop UI.
- Test: Verify action visibility/order and permission-state routing.

### Pair 2
- Plan: Move non-essential clutter into Open Viewer.
- Implement: Relocate advanced diagnostics/settings content to overlay sections.
- Test: Validate quick row cleanliness and overlay content availability.

### Pair 3
- Plan: Refactor warning rail to compact one-line rows with expand/dismiss.
- Implement: Add warning UI state model (collapsed/expanded/dismissed), with non-critical persistence for session if practical.
- Test: Add interaction and accessibility coverage for warning behavior.

### Pair 4
- Plan: Standardize outside-click and Escape-close behavior.
- Implement: Apply a consistent dismiss contract for overlay/sheet/dialog components; ensure inside-click containment and focus return.
- Test: Backdrop close, Escape close, and focus restoration tests.

### Pair 5
- Plan: Fix desktop settings clipping via desktop-specific layout.
- Implement: Provide desktop dialog variant (or equivalent responsive split), retaining mobile shell where appropriate.
- Test: Verify no clipping and full content reachability at desktop sizes.

## Completion criteria
- All five outcomes implemented.
- Relevant tests added/updated and passing.
- Changes committed in git.
