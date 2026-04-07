# Test Strategy

- Task ID: desktop-ui-prd-ard-implementation
- Pair: test
- Phase ID: shared-dismiss-contract
- Phase Directory Key: shared-dismiss-contract
- Phase Title: Standardize outside-click, Escape-close, and focus restore
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- `SettingsSheet` close contract:
  - Escape closes and restores focus to the settings trigger in `SkyLensServerless/tests/unit/settings-sheet.test.tsx`.
  - Backdrop click closes, inside control clicks do not dismiss, and focus restores to the trigger in `SkyLensServerless/tests/unit/settings-sheet.test.tsx`.
  - Alignment handoff closes the sheet without returning focus to the trigger, preserving the overlay-to-overlay transition contract in `SkyLensServerless/tests/unit/settings-sheet.test.tsx`.
- Mobile viewer overlay contract:
  - Backdrop click closes, inner settings-button clicks do not dismiss, and focus restores to `Open viewer` in `SkyLensServerless/tests/unit/viewer-shell.test.ts`.
  - Escape closes and restores focus to `Open viewer` in `SkyLensServerless/tests/unit/viewer-shell.test.ts`.
- Mobile alignment overlay contract:
  - Backdrop click closes and restores focus to mobile `Align` in `SkyLensServerless/tests/unit/viewer-shell.test.ts`.
  - Inside-panel clicks do not dismiss, and Escape closes with focus restoration to mobile `Align` in `SkyLensServerless/tests/unit/viewer-shell.test.ts`.

## Preserved invariants checked
- Focus restore still prefers the original opener when it remains visible and connected.
- Viewer-level scroll lock and other non-dismiss viewer behavior remain covered by the existing `viewer-shell` suite.
- Settings content interactions inside the panel remain functional while the sheet stays open.

## Edge cases and failure paths
- Hidden/removed focus targets are still covered by existing mobile alignment fallback tests in `SkyLensServerless/tests/unit/viewer-shell.test.ts`.
- The settings-to-alignment transition verifies the no-focus-bounce handoff instead of normalizing a premature trigger refocus.

## Stabilization notes
- The `viewer-shell` suite still emits jsdom canvas `getContext()` warnings; assertions remain deterministic because the dismiss/focus tests do not depend on canvas rendering output.
- Existing `flushEffects()` and macrotask waits remain the stabilization path for post-dismiss focus restoration.

## Known gaps
- Desktop dialog-shell behavior for settings remains out of scope until the later desktop-settings phase introduces that presentation path.
