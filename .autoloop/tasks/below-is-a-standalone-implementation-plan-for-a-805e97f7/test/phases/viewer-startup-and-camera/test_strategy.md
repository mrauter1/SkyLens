# Test Strategy

- Task ID: below-is-a-standalone-implementation-plan-for-a-805e97f7
- Pair: test
- Phase ID: viewer-startup-and-camera
- Phase Directory Key: viewer-startup-and-camera
- Phase Title: Viewer Startup, Camera, And Observer Flow
- Scope: phase-local producer artifact

## Coverage map

- Viewer-owned startup gating:
  `tests/unit/viewer-shell.test.ts`
  verifies that bare `/view` does not fire startup side effects before `Start AR`, and that verified live/manual/non-camera states still bootstrap the expected runtime flows.
- Startup ordering and route-state compatibility:
  `tests/unit/permission-coordinator.test.ts`
  verifies orientation -> camera -> location ordering, blocked partial states, demo route handling, and verified live-state parsing.
- Manual observer fallback and persisted bootstrap:
  `tests/unit/viewer-shell.test.ts`
  verifies denied-location deep links with persisted manual observer data hydrate immediately without re-requesting geolocation or starting geo tracking.
- Camera picker persistence and restart behavior:
  `tests/unit/viewer-shell.test.ts`
  verifies switching from a concrete camera back to auto rear-camera mode reopens the live stream instead of leaving the old exact-device stream attached.
- Viewer settings persistence:
  `tests/unit/viewer-settings.test.tsx`
  verifies persisted layer/calibration settings still reload correctly after the startup-flow refactor.
- Manual observer/location contract:
  `tests/unit/location-foundation.test.ts`
  verifies startup geolocation options and tracking thresholds remain deterministic.
- Settings-sheet UI contract:
  `tests/unit/settings-sheet.test.tsx`
  verifies the real sheet still exposes camera/calibration controls, focus trapping, and viewer-control interactions.

## Preserved invariants checked

- Demo mode remains routable and independent from live startup.
- Non-camera fallback keeps the viewer active when camera permission is denied.
- Manual-pan fallback keeps the viewer active when motion/orientation permission is denied.
- Privacy reassurance and blocking copy stay visible before live startup begins.

## Failure paths and edge cases

- Location denied while camera and orientation are granted.
- Persisted manual observer reused on denied deep links without a fresh geolocation request.
- Camera preference transitions from specific `deviceId` back to auto rear-camera mode.
- Partial live route payloads remain blocked until explicit camera and motion results are present.

## Validation performed

- `npx vitest run tests/unit/viewer-shell.test.ts tests/unit/viewer-settings.test.tsx tests/unit/permission-coordinator.test.ts tests/unit/location-foundation.test.ts tests/unit/settings-sheet.test.tsx`
- `npx tsc --noEmit`

## Known gaps

- No browser-level e2e was added for the camera picker because this phase’s camera restart assertions are covered deterministically in unit tests with mocked stream/runtime behavior.
