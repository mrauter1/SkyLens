# Test Strategy

- Task ID: make-each-step-explicit-on-the-view-as-a-easy-to-f13dc748
- Pair: test
- Phase ID: explicit-alignment-tutorial-panel
- Phase Directory Key: explicit-alignment-tutorial-panel
- Phase Title: Explicit alignment tutorial and blockers
- Scope: phase-local producer artifact

## Behavior To Coverage Map
- AC-1 target-aware numbered tutorial copy:
  `tests/unit/viewer-shell.test.ts` checks live-panel step wording against the resolved target.
  `tests/unit/viewer-shell-celestial.test.ts` checks fallback-target live-panel wording for a planet target.
  `tests/unit/viewer-settings.test.tsx` checks settings-sheet wording for the north-marker fallback target.
- AC-2 explicit manual fine-adjust step:
  `tests/unit/settings-sheet.test.tsx` asserts manual-nudge tutorial wording in settings.
  `tests/unit/viewer-shell.test.ts` asserts on-view nudge controls are rendered and callable.
- AC-3 blocker/status/fallback messaging:
  `tests/unit/settings-sheet.test.tsx` covers unavailable-target fallback copy and disabled-align blocker copy.
  `tests/unit/settings-sheet.test.tsx` also covers the unavailable-in-current-mode blocker branch when `canFixAlignment` is false.
  `tests/unit/viewer-shell.test.ts` covers live-panel blocker copy when alignment focus opens before the first motion sample.
  `tests/unit/viewer-shell-celestial.test.ts` covers live-panel fallback messaging when a preferred Sun/Moon target resolves to Venus.
- AC-4 manual nudges and gated reset on the live panel:
  `tests/unit/viewer-shell.test.ts` covers visible nudge controls, initial reset gating, fine-adjust persistence, and reset wiring through the live panel.
- AC-5 preserved selection/fallback/persistence/mobile visibility:
  Existing `viewer-shell-celestial` coverage still checks target selection and fallback resolution.
  Existing `viewer-shell` coverage still checks mobile Align visibility and persistence after fine-adjust/reset.

## Preserved Invariants Checked
- Alignment target preference remains `sun | moon`.
- Manual nudges continue to write through the existing pose-calibration path.
- Reset uses the current availability gate and restores raw calibration state.
- Mobile quick-action Align remains visible in the live viewer flow.

## Edge Cases
- Preferred Moon selected while only a fallback target is available.
- Alignment focus opened before any live motion sample exists.
- North-marker fallback instructions in settings/demo flows.

## Failure Paths
- Disabled-align state before a live sample arrives.
- Live sensor alignment unavailable in the current mode.
- Fallback-target messaging when the preferred Sun/Moon body is unavailable.

## Flake Risks / Stabilization
- Viewer tests enter alignment focus through mocked settings callbacks instead of waiting on user-permission timing.
- Motion/orientation state is injected synchronously through mocked sensor subscriptions to avoid timing-dependent assertions.
- The live fallback-target viewer test forces `window.isSecureContext = true` so the alignment panel path is exercised instead of the secure-context gate.

## Known Gaps
- No browser-layout visual assertions beyond DOM text/button presence.

## Validation
- `pnpm test -- tests/unit/settings-sheet.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-settings.test.tsx`
- Result: 19 files passed, 184 tests passed.
