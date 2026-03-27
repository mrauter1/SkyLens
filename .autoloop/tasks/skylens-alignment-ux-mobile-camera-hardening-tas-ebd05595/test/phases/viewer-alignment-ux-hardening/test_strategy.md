# Test Strategy

- Task ID: skylens-alignment-ux-mobile-camera-hardening-tas-ebd05595
- Pair: test
- Phase ID: viewer-alignment-ux-hardening
- Phase Directory Key: viewer-alignment-ux-hardening
- Phase Title: Harden live alignment flow and mobile viewer interaction
- Scope: phase-local producer artifact

## Behavior-to-test map
- AC-1 explicit panel ownership:
  - `tests/unit/viewer-shell.test.ts` covers closed-by-default state, opening from Align/settings delegation, explicit close, and no auto-open from relative-sensor warning state.
- AC-2 non-scrolling live AR flow:
  - `tests/unit/viewer-shell.test.ts` covers document/body scroll locking, the live compact `mobile-viewer-overlay-shell`, and preserved `mobile-viewer-overlay-scroll-region` behavior for blocked overlays.
- AC-3 next-action and crosshair affordance:
  - `tests/unit/viewer-shell.test.ts` and `tests/unit/viewer-shell-celestial.test.ts` cover next-action copy, focus instruction, center-crosshair affordance, target switching, and no legacy multi-step list in fast alignment.
- AC-4 repeated direct re-entry:
  - `tests/unit/viewer-shell.test.ts` covers successful apply via crosshair and reopening Align without reset-first gating.
- Shared entrypoint wiring:
  - `tests/unit/settings-sheet.test.tsx` covers the settings-sheet Alignment button delegating to the viewer-owned flow and staying disabled when alignment cannot launch.
- Preserved settings behavior:
  - `tests/unit/viewer-settings.test.tsx` covers settings persistence after the alignment-sheet simplification.

## Preserved invariants checked
- Blocked/non-camera mobile overlays remain scrollable and retain startup/recovery actions.
- Manual fine-adjust and reset calibration remain wired through the live alignment panel.
- Existing settings controls and persistence still work after alignment-entrypoint consolidation.

## Edge cases / failure paths
- No motion sample yet: panel shows blocker notice plus focus instruction without enabling alignment.
- Relative sensors needing calibration: warning banner remains visible while the panel stays closed until explicitly opened.
- Preferred target fallback: live alignment panel keeps fallback notice and target-switch coverage.

## Stabilization approach
- Tests use mocked sensor/camera subscriptions and direct DOM event dispatch to avoid device/browser nondeterminism.
- Focus/overlay assertions avoid viewport-size dependence by checking compact-vs-scrollable overlay test IDs and text contracts instead of layout measurements.

## Known gaps
- No end-to-end mobile viewport measurement test verifies visual fit; unit coverage instead guards the compact live overlay branch and the absence of the prior long-form content on that path.
