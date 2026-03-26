# Review Feedback Plan

## Scope
- Address the three requested review items already identified in the repo-local fix note:
  - mobile overlay close behavior and iOS-safe sizing
  - motion enable guidance and retry UX
  - `likelyVisibleOnly` defaults and zero-label diagnostics
- Preserve the existing viewer route/state contract, desktop overlay composition, and viewer settings storage shape.
- Use repo-wide analysis only to confirm dependencies and regression surfaces; keep implementation local to the viewer shell, config/settings plumbing, and targeted tests.

## Current Baseline
- `components/viewer/viewer-shell.tsx` already owns the mobile overlay trigger/sheet, fallback banners, motion recovery panel, and zero-label diagnostics copy, so the requested fixes should stay concentrated there.
- `lib/config.ts` already exposes `likelyVisibleOnly: false`, and `lib/viewer/settings.ts` already derives fresh defaults from that public config while continuing to hydrate persisted settings.
- `tests/unit/viewer-shell.test.ts`, `tests/unit/viewer-settings.test.tsx`, `tests/unit/config-contract.test.ts`, and the mobile Playwright helper/specs already cover adjacent behavior and should be extended instead of replaced.

## Milestones
### 1. Mobile Overlay Close Behavior
- Keep the mobile informational UI collapsed behind the existing trigger by default.
- Ensure the expanded mobile sheet includes a full-screen backdrop that dismisses the sheet when tapped, while clicks/taps inside the panel do not dismiss it.
- Keep the expanded panel safe-area aware and `dvh`-bounded so the top controls remain reachable on iOS Safari.
- Preserve desktop viewer header/content composition and the mobile trigger test IDs/ARIA wiring.

### 2. Motion Enable UX
- In non-demo manual-pan fallback states, show actionable Safari/iOS guidance plus a dedicated `Enable motion` action that retries orientation permission from a direct user gesture.
- Reuse the existing orientation permission abstraction and local viewer state updates; do not introduce new permission enums, routes, or fallback modes.
- Keep the blocked preflight retry flow separate from the manual-pan motion retry flow.

### 3. `likelyVisibleOnly` Defaults And Diagnostics
- Keep the public bootstrap default and fresh viewer-setting default for `likelyVisibleOnly` at `false`.
- Preserve compatibility for persisted viewer settings so previously saved user choices still win over the new default.
- Keep the zero-label diagnostics copy contextual:
  - when `likelyVisibleOnly` is enabled, explain that daylight filtering can hide stars, constellations, and satellites
  - otherwise steer the user toward location accuracy, tilt/horizon, and layer toggles
- Do not change the underlying daylight-filtering rules beyond what is required to match the requested default and diagnostics behavior.

## Interfaces And Compatibility
- No public API, route, query-param, or storage-schema changes are planned.
- Stable selectors and IDs used by tests should remain available:
  - `mobile-viewer-overlay-trigger`
  - `mobile-viewer-overlay`
  - `mobile-viewer-overlay-backdrop`
- `requestOrientationPermission` remains the only motion-retry entry point; success/failure must continue to flow through existing viewer state updates and error messaging.
- Persisted `ViewerSettings` records remain backward compatible because the storage shape is unchanged and defaults are only applied when values are absent.

## Validation
- Focused unit coverage:
  - `tests/unit/viewer-shell.test.ts` for mobile backdrop dismissal, inner-panel click isolation, blocked-state reachability, and motion retry UX
  - `tests/unit/viewer-settings.test.tsx` and `tests/unit/config-contract.test.ts` for `likelyVisibleOnly` bootstrap/default behavior
  - any zero-label diagnostics assertions needed in viewer-shell tests
- Focused Playwright coverage:
  - existing mobile overlay helper/specs continue to open the overlay before asserting mobile-only content
  - permission-state specs should still prove blocked/manual-pan fallback actions remain reachable inside the mobile sheet
- Final verifier closeout:
  - run `npm run test`
  - run `npm run lint`
  - record PR-ready summary/test results if the workflow requires them

## Regression Prevention
- Preserve these invariants:
  - desktop overlay cards remain unchanged in composition and availability
  - the mobile overlay only dismisses from explicit close controls or the backdrop, not from inner-panel interaction
  - blocked-state retry/demo actions remain reachable on mobile when the overlay is expanded
  - the motion recovery panel appears only when orientation is not granted outside demo mode
  - persisted settings continue to override the fresh `likelyVisibleOnly` default
- Prefer existing viewer-shell state and helpers over new shared abstractions unless duplication becomes the direct cause of a bug.
- Use element-level assertions rather than broad text-only assertions where responsive hidden content could produce false positives.

## Risk Register
- R1: Responsive markup/class changes could unintentionally alter desktop behavior or make the mobile sheet impossible to dismiss.
  - Control: keep edits inside the current mobile overlay boundary and retain explicit unit assertions for both mobile and desktop surfaces.
- R2: Motion retry UX could regress the existing permission flow if it reuses the global pending/error state incorrectly.
  - Control: keep manual-pan retry scoped to the existing orientation-permission path and verify success/failure rendering.
- R3: The default change could drift between config, viewer settings, and tests.
  - Control: treat `lib/config.ts` and `lib/viewer/settings.ts` as the single default source chain and update contract/settings tests together.
- R4: Zero-label diagnostics can become misleading if they stop matching the actual daylight-filtering rules.
  - Control: keep copy keyed to the existing `likelyVisibleOnly` branch and avoid speculative heuristics.

## Rollback
- Roll back each slice independently if needed:
  - revert mobile overlay dismissal/sizing edits while leaving unrelated viewer logic intact
  - revert motion recovery UX changes if permission retry behavior regresses
  - revert `likelyVisibleOnly` default/diagnostics changes only if they cause compatibility or visibility regressions
- If verification fails late, prefer reverting only the failing slice rather than introducing a larger refactor during fix-up.
