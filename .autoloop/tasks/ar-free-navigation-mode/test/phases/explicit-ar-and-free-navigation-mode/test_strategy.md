# Test Strategy

- Task ID: ar-free-navigation-mode
- Pair: test
- Phase ID: explicit-ar-and-free-navigation-mode
- Phase Directory Key: explicit-ar-and-free-navigation-mode
- Phase Title: Explicit free-navigation default and AR toggle flow
- Scope: phase-local producer artifact

## Behavior Coverage Map

- Free-navigation default on fresh live routes:
  `tests/unit/viewer-shell.test.ts`
  verifies no startup side effects before explicit `Enable AR`, mobile/desktop toggles stay visible, and granted live routes still show `Enable AR` until opt-in.
- Explicit AR startup ordering and blocker states:
  `tests/unit/viewer-shell.test.ts`
  verifies `Enable AR` requests motion -> camera -> location in order and preserves the pre-first-sample alignment blocker UI.
- Sticky disable and preserved manual navigation:
  `tests/unit/viewer-shell.test.ts`
  verifies disabling AR returns to free-navigation and keeps keyboard/manual viewer behavior active.
- AR-oriented celestial/runtime fixtures:
  `tests/unit/viewer-shell-celestial.test.ts`
  now opt into AR explicitly with `autoEnableAr` before asserting live alignment and live astronomy fallback behavior, instead of relying on granted route params alone.
- Mobile/desktop user-facing mode UX:
  `tests/e2e/permissions.spec.ts`
  covers bare `/view`, partial/denied live states, explicit enable/disable flow, and mobile alignment/overlay reachability.

## Preserved Invariants Checked

- Permission coordinator contract stays permission/result-only; interaction mode remains local to `viewer-shell`.
- Sticky disable still blocks passive AR re-entry while explicit retry actions remain valid recovery entry points.
- Alignment, scope, manual observer, and diagnostics surfaces remain reachable after the free-navigation default split.

## Edge Cases / Failure Paths

- Pre-sample AR startup keeps alignment unavailable and the start action disabled until a usable motion sample arrives.
- Camera-denied/relative-orientation celestial live fixtures explicitly opt into AR before checking fallback rendering so tests continue to exercise runtime behavior rather than fresh-load free-navigation.

## Stabilization Notes

- Three slower startup/transition tests in `viewer-shell.test.ts` now carry explicit `15_000` per-test timeouts instead of increasing the suite-wide timeout budget:
  `requests motion, then camera, then location when Enable AR is pressed in-view`,
  `surfaces live-panel blocker copy and a disabled start action before the first motion sample`,
  and `clears stale live sensor state when switching into demo mode`.
- AR-dependent fixtures use explicit helper opt-in (`autoEnableAr`) rather than hidden behavior in the base render helper.

## Known Gaps

- `tests/unit/viewer-shell-celestial.test.ts` still has an unrelated timeout in `includes non-bright scope objects in scope-mode top-list candidates`; once that test times out, its follow-on motion-affordance cases fail because their timer harness cleanup never runs. That remains separate from the explicit AR opt-in coverage updated in this turn.
