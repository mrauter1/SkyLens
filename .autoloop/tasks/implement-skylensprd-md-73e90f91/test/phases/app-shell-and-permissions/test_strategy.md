# Test Strategy

- Task ID: implement-skylensprd-md-73e90f91
- Pair: test
- Phase ID: app-shell-and-permissions
- Phase Directory Key: app-shell-and-permissions
- Phase Title: App shell and permissions
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- Landing shell and demo entry
  - `tests/e2e/landing.spec.ts`
  - Covers product name, one-sentence description, trust copy, Start button visibility, demo entry link contract, and demo viewer entry.
- Manifest / PWA shell contract
  - `tests/unit/manifest-contract.test.ts`
  - Covers the locked manifest metadata, standalone display mode, start URL, theme/background colors, and required icon paths.
- `/api/config` bootstrap contract
  - `tests/unit/config-contract.test.ts`
  - Covers locked response shape, defaults, satellite groups, and surfaced build version.
- Start-flow permission ordering
  - `tests/unit/permission-coordinator.test.ts`
  - Covers location -> camera -> orientation ordering and short-circuit on denied location.
- Blocking and fallback viewer states
  - `tests/unit/permission-coordinator.test.ts`
  - Covers bare `/view` preflight blocking, partial live-state blocking, non-camera fallback, and manual-pan fallback mode selection.
  - `tests/unit/viewer-shell.test.ts`
  - Covers blocked-live startup suppression, verified fallback startup gating, and viewer-shell privacy reassurance visibility during preflight blocking.
  - `tests/e2e/permissions.spec.ts`
  - Covers location-denied blocking shell, bare `/view` blocking shell, partial live-state blocking shell, camera-denied non-camera shell, and orientation-denied manual-pan shell.
- Preserved invariants checked
  - Live `/view` requires an explicit full permission payload.
- Demo mode remains query-driven and independent from Start permissions.
- Viewer trust copy remains visible on `/view`, including the blocking preflight shell.
- Location denial stays blocking.
- Camera denial keeps the viewer active in non-camera mode.
- Orientation denial keeps the viewer active in manual-pan mode.
- Unsupported orientation capability does not imply motion readiness.

## Edge cases and failure paths

- Missing live query params: blocked as preflight instead of assuming granted permissions.
- Partial live query params: blocked until camera and motion states are explicit.
- Denied location: camera and orientation are not requested further in the unit seam.
- Denied camera with granted motion: non-camera shell remains active.
- Denied orientation with granted camera: manual-pan shell remains active.

## Flake risks and stabilization

- Playwright coverage uses direct deterministic route-state URLs instead of browser permission prompts to avoid environment-specific prompt behavior.
- Demo entry E2E asserts the rendered `href` contract before navigation instead of relying on a potentially timing-sensitive client transition.

## Known gaps

- No browser-level permission prompt mocking yet; ordering is protected at the unit seam instead.
- No live camera stream, sensor subscription, or projection assertions yet because those remain out of phase for M1.
