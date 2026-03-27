# Test Strategy

- Task ID: below-is-a-standalone-implementation-plan-for-a-805e97f7
- Pair: test
- Phase ID: overlay-ui-and-render-loop
- Phase Directory Key: overlay-ui-and-render-loop
- Phase Title: Overlay UI And Render Loop Integration
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- AC-1 render cadence and frame-layout updates
  - `tests/unit/viewer-shell.test.ts`
  - Asserts `requestVideoFrameCallback()` metadata updates the live frame token and surfaced frame dimensions.
  - Asserts `requestAnimationFrame()` fallback still advances the render token when video-frame callbacks are unavailable.
- AC-2 runtime mode and failure-state UI
  - `tests/unit/viewer-shell.test.ts`
  - Asserts blocked startup before `Start AR`, secure-context failure copy, manual-pan fallback messaging, motion-recovery retry copy, relative-sensor warning/badges, and absolute-sensor status badges.
  - Preserves mobile/desktop overlay composition and blocked-state action reachability.
- AC-3 quaternion calibration controls and persistence
  - `tests/unit/viewer-shell.test.ts`
  - Asserts fine-adjust and reset actions propagate into persisted `poseCalibration` and the live orientation controller.
  - `tests/unit/settings-sheet.test.tsx`
  - Asserts Alignment panel wiring exposes align, fine-adjust, FOV, and label-mode controls.
  - `tests/unit/viewer-settings.test.tsx`
  - Asserts persisted settings keep `poseCalibration` as the alignment source of truth while older scalar offset fields remain parse-compatible.
- AC-4 calibration target priority and fallback
  - `tests/unit/viewer-shell-celestial.test.ts`
  - Asserts Sun, Moon, brightest visible planet, brightest visible star, then manual north-marker fallback.

## Preserved invariants checked

- Demo/manual fallback keeps the Alignment panel reachable so FOV and camera controls remain available without live sensors.
- Viewer-owned startup still keeps blocked-state actions reachable on both desktop and mobile overlay shells.
- Persisted legacy heading/pitch offsets can still be read without overriding quaternion calibration storage.

## Edge cases and failure paths

- Secure-context denial is covered with `window.isSecureContext = false` so the blocked viewer path is deterministic and does not depend on async startup failure timing.
- Relative sensor samples stay visibly marked as untrusted until calibration is applied.
- `requestVideoFrameCallback()` remains optional; the fallback test removes it and drives `requestAnimationFrame()` directly.
- North-marker fallback is asserted only when no celestial calibration target qualifies.

## Flake risks / stabilization

- Viewer-shell tests stub `requestVideoFrameCallback()` / `requestAnimationFrame()` directly and invoke callbacks manually to avoid timing flake.
- Orientation UI tests inject synchronous mocked sensor samples instead of depending on browser motion APIs.
- Celestial target tests keep astronomy inputs mocked so ordering stays deterministic.

## Known gaps

- No device-level browser coverage for actual camera playback, real permission prompts, or sensor drift; those remain manual QA.
- Unit tests validate viewer output/state transitions, not pixel-perfect overlay placement against a real camera feed.
