# Test Strategy

- Task ID: skylens-alignment-ux-mobile-camera-hardening-tas-ebd05595
- Pair: test
- Phase ID: regression-coverage-validation
- Phase Directory Key: regression-coverage-validation
- Phase Title: Update regression coverage and verify the new alignment contract
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- Explicit-open / close alignment panel:
  covered by `tests/unit/viewer-shell.test.ts` cases that open alignment only through the mobile Align action or delegated settings action, assert the panel starts closed, and verify the `Close` control restores the normal mobile Align affordance.
- Single next-action rendering in fast mode:
  covered by `tests/unit/viewer-shell.test.ts` and `tests/unit/viewer-shell-celestial.test.ts` assertions for the blocker/next-action copy and the absence of the legacy multi-step text.
- Repeat align without reset dependency:
  covered by `tests/unit/viewer-shell.test.ts` case that aligns once through the center crosshair, confirms the panel closes, then re-enters alignment directly from the restored Align action.
- Center-crosshair apply affordance:
  covered by `tests/unit/viewer-shell.test.ts` alignment-focus assertions for `alignment-crosshair-button` and focus prompt copy, plus celestial target-copy assertions in `tests/unit/viewer-shell-celestial.test.ts`.
- Live no-scroll overlay vs blocked/non-camera accessibility:
  covered by `tests/unit/viewer-shell.test.ts` cases that assert the live camera path uses the compact non-scrolling shell and locks document/body overflow, while blocked/non-camera overlay paths retain the scroll region and reachable actions.
- Shared settings fallout:
  covered by `tests/unit/settings-sheet.test.tsx` assertions that Alignment delegates to the viewer-owned opener, closes the sheet, and stays disabled when live alignment is unavailable.

## Preserved invariants checked
- Relative-sensor and poor-alignment notices remain visible without auto-opening the panel.
- Reset calibration remains available as a utility control but is not required for re-entry.
- The settings sheet does not become a second independent live alignment panel owner.

## Edge cases / failure paths
- Alignment focus opened before the first motion sample keeps the panel open, hides the quick Align action, and shows the motion-sample blocker copy.
- Preferred target fallback copy is asserted when the requested body is unavailable and SkyLens resolves a different calibration target.
- Blocked and secure-context failure states keep non-live recovery actions reachable.

## Flake risks and stabilization
- Orientation/camera state is stabilized with explicit mock pose payloads and deterministic timestamps.
- UI transitions are stabilized with `act(...)` and `flushEffects()` before assertions.
- Validation uses unit-only commands; no network or end-to-end timing dependencies are introduced.

## Validation performed
- `npm test -- tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/settings-sheet.test.tsx` -> 3 files, 81 tests passed.
- `npm test` -> 19 files, 185 tests passed.

## Known gaps
- No new end-to-end coverage was added; current confidence relies on deterministic unit tests, which is consistent with the active phase scope.
- No additional test-file edits were required because the existing coverage already matches the accepted alignment contract.
