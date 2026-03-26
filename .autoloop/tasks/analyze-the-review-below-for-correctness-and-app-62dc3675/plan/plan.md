# Review Applicability Plan

## Scope
- Analyze the two review comments against the current viewer-shell implementation and apply only the fixes that are both correct and local to this task.
- Keep scope limited to `components/viewer/viewer-shell.tsx` plus the smallest necessary test updates around existing viewer-shell behavior.
- Preserve the current viewer route contract, permission state shape, mobile overlay structure, and fallback-mode semantics.

## Findings
- The review note about duplicate `sm:hidden` usage is applicable: the expanded mobile overlay wrapper is rendered inside a parent container that already applies `sm:hidden`, so repeating `sm:hidden` on the inner fixed wrapper is redundant.
- The review note about `handleRetryMotionPermission` is applicable: the handler updates local `state.orientation` after `requestOrientationPermission()` resolves, but it does not call `router.replace(buildViewerHref(...))`, so the `/view` query string can stay stale relative to the active permission state.
- No broader permission-coordinator or route-schema change is needed; the existing `buildViewerHref(ViewerRouteState)` contract already supports the required sync.

## Milestone
### 1. Finalize viewer-shell review fixes
- Remove only the redundant inner `sm:hidden` class from the expanded mobile overlay wrapper, leaving the outer mobile-only container unchanged.
- Update the motion retry path so a live-state orientation retry computes the next `ViewerRouteState`, commits it to local state, and replaces the current `/view` route with `buildViewerHref(nextState)`.
- Keep demo-mode behavior untouched and keep non-granted retry outcomes using the existing motion retry error copy.
- Extend the existing viewer-shell unit test that already exercises motion retry so it also verifies URL replacement stays in sync with the new orientation state.

## Interface And Compatibility Notes
- Route/query contract remains unchanged:
  - `/view?entry=...&location=...&camera=...&orientation=...`
- `handleRetryMotionPermission` should keep using `requestOrientationPermission()` and `buildViewerHref()`; no new helper or permission enum is warranted.
- Desktop/mobile composition remains compatible because only a redundant responsive utility class is removed; the controlling outer mobile wrapper still hides the overlay tree at `sm` and above.

## Validation
- Update `tests/unit/viewer-shell.test.ts` to assert that a successful motion retry calls `router.replace()` with an href whose `orientation` query matches the resolved permission state.
- Keep the existing motion recovery assertions that verify the panel disappears after a granted retry.
- Run the focused unit suite covering viewer shell behavior before broader validation in later phases.

## Regression Prevention
- Preserve these invariants:
  - the mobile overlay remains hidden on `sm` and larger screens through the existing outer wrapper
  - retrying motion permission only mutates live viewer state and does not alter demo routing
  - local viewer state and `/view` query params stay aligned after motion retry outcomes
- Prefer a single derived `nextState` object for both `setState` and `router.replace()` so state and URL cannot drift.

## Risk Register
- R1: Recomputing route state inside the retry handler could accidentally touch demo mode or other permission fields.
  - Control: gate the URL/state update to `current.entry === 'live'` and carry forward unchanged fields.
- R2: Test coverage could miss the route-sync regression if it only checks rendered copy.
  - Control: assert directly on the mocked `router.replace()` call and the expected `orientation` query value.
- R3: Removing the wrong responsive class could expose the mobile overlay on desktop.
  - Control: remove only the inner duplicate class and leave the outer mobile-only wrapper intact.

## Rollback
- Revert the `handleRetryMotionPermission` route-sync change independently if it produces unexpected navigation behavior.
- Revert only the inner overlay class cleanup if responsive behavior changes unexpectedly.
