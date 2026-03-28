# Implementation Notes

- Task ID: improve-orientation-motion-serverless
- Pair: implement
- Phase ID: viewer-integration-and-verification
- Phase Directory Key: viewer-integration-and-verification
- Phase Title: Wire Viewer Readiness, Diagnostics, And Tests
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/lib/sensors/orientation.ts`
- `SkyLensServerless/app/embed-validation/page.tsx`
- `SkyLensServerless/next.config.ts`
- `SkyLensServerless/public/_headers`
- `SkyLensServerless/tests/unit/orientation.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `SkyLensServerless/tests/unit/next-config.test.ts`
- `SkyLensServerless/tests/e2e/embed.spec.ts`

## Symbols touched
- `ViewerShell`
- `normalizeOrientationPromptStatus`
- `getMotionBadgeValue`
- `getSensorStatusValue`
- `describeRuntimeExperience`
- `resolveStartupState`
- `DevelopmentOrientationDiagnostics`
- `getBrowserFamily`
- `subscribeToOrientationPose`

## Checklist mapping
- Plan 2: separated prompt result from readiness in `ViewerShell`; route stays `unknown` until first usable sample, then flips to `granted`; no-provider timeout resolves to `denied` vs `unavailable`.
- Plan 2: added browser-family recovery copy and development-only orientation diagnostics tied to the selected provider state.
- Plan 3: aligned `Permissions-Policy`/iframe `allow` surfaces to the sensor-only contract and updated affected tests.
- Plan 3: expanded orientation/viewer tests for Safari, Chrome/Samsung-style sensor fallback, Firefox event-only startup, viewer readiness, and diagnostics.
- Plan 1 (dependency follow-up): fixed Safari compass validated upgrade/downgrade handling in `lib/sensors/orientation.ts` because the required orientation runtime coverage stayed red without it.
- Cycle 2 reviewer follow-up: motion-only retry now preserves the same prompt-vs-ready contract as full startup, and the coordinator no longer tears all providers down after an empty 500 ms arbitration window.

## Assumptions
- Viewer no-provider startup should resolve after a short client-side timeout because `subscribeToOrientationPose()` does not surface an explicit failure callback.
- Browser-family detection is copy-only and must not affect provider selection.

## Preserved invariants
- No `devicemotion` pose fallback was added.
- Provider choice remains sample/capability driven, not UA driven.
- Manual-pan and alignment flows remain intact outside the readiness/status changes.
- The 500 ms arbitration window still prefers higher-priority startup candidates when multiple providers emit promptly; the change only affects the no-sample case.

## Intended behavior changes
- `Start AR` permission success no longer marks orientation ready by itself.
- Motion-only recovery permission success also no longer marks orientation ready by itself.
- Motion/status badges now distinguish absolute sensor, relative sensor, absolute event, relative event, and pending/manual states.
- Development builds surface provider diagnostics for the selected orientation source.
- Shipped embed/config guidance now advertises only `accelerometer`, `gyroscope`, and `magnetometer`.
- A first usable orientation sample that arrives after the initial 500 ms arbitration grace window can still satisfy startup instead of being dropped by a premature provider teardown.

## Known non-changes
- The broader `viewer-shell` suite still has long-running behavior as a whole in this environment; verification was done with targeted test groups covering the changed cases instead of claiming a clean full-file run.
- No deployment/runtime files outside `SkyLensServerless/` were modified.

## Expected side effects
- When a live startup is waiting on the first sample, recovery CTAs stay hidden until startup either succeeds or times out.
- Provider diagnostics persist across benign resubscribe cleanup so development overlays keep the latest selected-provider state visible.

## Validation performed
- `npx vitest run tests/unit/orientation.test.ts tests/unit/next-config.test.ts tests/unit/serve-export.test.ts`
- `npx vitest run tests/unit/viewer-shell.test.ts -t "keeps route orientation unknown until the first usable sample arrives|renders development diagnostics from the selected provider state"`
- `timeout 25 npx vitest run tests/unit/viewer-shell.test.ts -t "times out unknown startup to denied when orientation APIs exist but no provider emits|times out unknown startup to unavailable when no orientation APIs exist|switches motion recovery help copy by browser family without changing the provider flow"`
- Attempted targeted reruns for the cycle-2 fixes with `SkyLensServerless/node_modules/.bin/vitest`, but this environment still fails to resolve `vitest/config` from the repo-root `vitest.config.ts`, so no green rerun could be recorded here.

## Deduplication / centralization
- Viewer readiness/failure routing stays in `viewer-shell.tsx`; provider arbitration/validated Safari event handling stays centralized in `lib/sensors/orientation.ts`.
