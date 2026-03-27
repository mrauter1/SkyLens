# Implementation Notes

- Task ID: below-is-a-standalone-implementation-plan-for-a-805e97f7
- Pair: implement
- Phase ID: viewer-startup-and-camera
- Phase Directory Key: viewer-startup-and-camera
- Phase Title: Viewer Startup, Camera, And Observer Flow
- Scope: phase-local producer artifact

## Files changed

- `components/landing/landing-screen.tsx`
- `components/settings/settings-sheet.tsx`
- `components/viewer/viewer-shell.tsx`
- `lib/permissions/coordinator.ts`
- `lib/projection/camera.ts`
- `lib/sensors/location.ts`
- `lib/viewer/contracts.ts`
- `lib/viewer/settings.ts`
- `tests/e2e/landing.spec.ts`
- `tests/e2e/permissions.spec.ts`
- `tests/unit/location-foundation.test.ts`
- `tests/unit/permission-coordinator.test.ts`
- `tests/unit/settings-sheet.test.tsx`
- `tests/unit/viewer-settings.test.tsx`
- `tests/unit/viewer-shell.test.ts`

## Symbols touched

- `LandingScreen`
- `SettingsSheet`
- `ViewerShell`
- `resolveStartupState()`
- `ManualObserverPanel()`
- `runStartFlow()`
- `describeViewerExperience()`
- `getRearCameraConstraintCandidates()`
- `requestRearCameraStream()`
- `listAvailableVideoInputDevices()`
- `getStreamVideoDeviceId()`
- `requestLocationPermission()`
- `requestStartupObserverState()`
- `ViewerSettings`
- `ManualObserverSettings`
- `ObserverSource`
- `StartupState`

## Checklist mapping

- Plan item 7: moved live startup ownership into the viewer with in-view `Start AR`, secure-context gating, and startup-state handling.
- Plan item 8: added persisted camera selection, enumerate-devices picker plumbing, live frame-layout capture, and auto/manual observer fallback wiring.
- Active phase AC-1: startup order is motion/orientation, then camera, then location/manual observer fallback from the viewer-owned path.
- Active phase AC-2: camera denial keeps non-camera rendering active; motion denial keeps manual-pan mode active with camera when available.
- Active phase AC-3: geolocation denial/timeout falls back to manual observer entry and retry instead of blocking forever.
- Active phase AC-4: stored camera IDs retry safely, and camera picker changes now reopen the live stream when switching back to auto rear-camera mode.

## Assumptions

- Existing heading/pitch trim controls remain as temporary compatibility controls until the later calibration-control phase replaces them.
- Manual observer persistence can remain in `viewer-settings` for this phase.

## Preserved invariants

- Demo mode remains route-driven and bypasses live startup.
- Rear camera requests stay `audio: false`.
- Manual pan and existing astronomy/layer pipelines stay intact.
- Camera streams and observer tracking remain viewer-owned and clean up on mode changes/unmount.

## Intended behavior changes

- Landing no longer preflights permissions; it routes to `/view`, where startup is initiated inline.
- Live viewer startup no longer blocks on geolocation denial or timeout.
- Live projection now reads live source-frame dimensions when the rear camera is active.
- Changing the camera picker back to auto rear-camera mode now reopens the live stream immediately instead of waiting for reload.

## Known non-changes

- Calibration reticle polish, align/reset fine-adjust UX, and zoom-capability UI remain out of scope for this phase.
- Old heading/pitch sliders remain in settings as compatibility controls until the later calibration-control phase removes them.

## Expected side effects

- Reloading a live route with denied geolocation can bootstrap immediately from a saved manual observer.
- Camera status/routing may downgrade to non-camera fallback if the stored device cannot be reopened and all fallback camera constraints fail.

## Validation performed

- Code-path review of startup flow, observer fallback, camera restart logic, and persisted camera selection.
- Added unit coverage for the camera-picker transition from a concrete device back to auto rear-camera mode.
- `pnpm -s exec tsc --noEmit` could not run to completion in this workspace because `node_modules` is absent.
- `pnpm -s exec vitest ...` could not run in this workspace for the same reason.

## Deduplication / centralization

- Startup-state derivation and manual-observer parsing remain centralized in `ViewerShell`.
- Camera retry order and device enumeration remain centralized in `lib/projection/camera.ts`.
