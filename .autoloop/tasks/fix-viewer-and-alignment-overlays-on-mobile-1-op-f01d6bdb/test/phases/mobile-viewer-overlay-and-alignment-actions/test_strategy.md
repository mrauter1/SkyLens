# Test Strategy

- Task ID: fix-viewer-and-alignment-overlays-on-mobile-1-op-f01d6bdb
- Pair: test
- Phase ID: mobile-viewer-overlay-and-alignment-actions
- Phase Directory Key: mobile-viewer-overlay-and-alignment-actions
- Phase Title: Fix mobile viewer overlay scrolling and first-use alignment actions
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- AC-1 mobile overlay scroll contract:
  Covered by `tests/unit/viewer-shell.test.ts` assertions that the opened mobile overlay uses `mobile-viewer-overlay-scroll-region` with safe-area top/bottom padding and `overflow-y-auto`, while retaining backdrop close behavior and inner-panel click isolation.
- AC-2 explicit mobile alignment focus:
  Covered by tests that trigger alignment focus from the settings entry point and from the closed mobile `Align` CTA once calibration is actionable, then assert the overlay trigger and permission CTA are hidden while the align action remains available.
- AC-3 first-use mobile permission and align actions:
  Covered by tests for the blocked first-use state (`camera`/`orientation` unknown) and the granted-but-pre-sample state (`camera`/`orientation` granted with no live sample), both asserting that `Align` stays visible but disabled until calibration is actionable and that the permission CTA appears only when permissions are missing.
- AC-4 preserved desktop/startup contracts:
  Covered by the existing viewer-shell startup, desktop composition, secure-context, and ordered permission-request tests already in `tests/unit/viewer-shell.test.ts`.

## Preserved invariants checked

- Desktop header/content composition remains unchanged.
- Ordered startup still requests motion before camera before location.
- Settings-sheet-driven alignment focus still hides mobile chrome without redesigning the settings flow.

## Edge cases and failure paths

- Missing permissions plus incomplete calibration: verify both permission and align affordances remain visible in the closed mobile row.
- Permissions granted but no orientation sample yet: verify `Align` remains visible-but-disabled and does not replace viewer access.
- Actionable calibration sample present: verify the closed mobile `Align` CTA enters focus before calibration executes.

## Stabilization approach

- Reuse the existing mocked orientation subscription to deterministically control whether a live sample exists.
- Avoid timing-sensitive assertions by checking DOM state transitions and persisted calibration state instead of animation timing.

## Known gaps

- The tests assert the mobile scroll container contract structurally via classes rather than simulating real browser safe-area scrolling.
- Runtime execution remains unverified in this workspace because `vitest` is unavailable and `node_modules` is missing.

## Behavior-to-test map
- AC-1 mobile overlay scrolling and safe viewport containment:
  covered by `viewer-shell.test.ts` assertions for the safe-area scroll-region wrapper, open/close behavior, and retained mobile overlay content access.
- AC-2 explicit mobile alignment focus:
  covered by tests that invoke mobile alignment from settings and from the actionable closed-footer `Align` CTA, then assert the overlay chrome is hidden and only the mobile align action remains.
- AC-3 first-use mobile actions:
  covered by tests that assert the closed mobile footer shows `Open viewer`, the permission CTA, and a visible-but-disabled `Align` CTA before a live sample exists, plus a separate actionable-path test once calibration can run.
- AC-4 preserved desktop and startup behavior:
  covered by existing desktop composition, secure-context, motion recovery, and startup gating tests in `viewer-shell.test.ts`.

## Edge cases
- Pre-sample / missing-permission mobile first-use state keeps `Align` visible but disabled and does not enter focus.
- Calibratable live mobile state keeps `Align` enabled, enters focus first, and does not calibrate until the focused action is used.
- Explicit alignment focus hides `Open viewer` and permission actions so the reticle path is unobstructed.

## Failure paths
- Secure-context failure remains covered so the new mobile footer logic does not normalize live startup on unsupported origins.
- The actionable closed-footer align test asserts no calibration write occurs on the first tap, which catches regressions back to the old bypass behavior.

## Preserved invariants
- Desktop viewer header/content composition remains unchanged.
- Existing permission handlers and startup ordering stay on the current `ViewerShell` path.
- Mobile overlay backdrop/open/close semantics remain covered alongside the new action-row assertions.

## Flake risk / stabilization
- Orientation-dependent alignment tests use `mockSubscribeToOrientationPose` with inline deterministic samples instead of timers or real sensors.
- Assertions stay DOM-structure based and avoid viewport-dependent pixel measurements.

## Known gaps
- Test execution is still blocked in this workspace because `node_modules`/`vitest` are unavailable, so coverage is authored and statically reviewed but not locally run here.
