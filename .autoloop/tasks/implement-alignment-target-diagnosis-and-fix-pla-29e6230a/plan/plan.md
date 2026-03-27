# Plan

## Scope
- Implement the behavior already specified in `ALIGNMENT_TARGET_DIAGNOSIS_AND_FIX_PLAN.md` without widening scope beyond alignment-target selection and its existing tests.
- Keep the actual calibration fallback chain intact: preferred Sun/Moon when available, otherwise the current auto-target fallback through visible Sun, Moon, planet, star, then north marker.
- Limit code changes to the current state owner and renderers that already participate in this flow: `components/viewer/viewer-shell.tsx`, `components/settings/settings-sheet.tsx`, and the affected unit suites.

## Current Baseline
- `ViewerShell` owns `alignmentTargetPreference` and currently hardcodes its initial value to `'sun'`.
- `resolveCalibrationTarget(...)` derives Sun/Moon availability from the currently visible celestial objects and already exposes both `availability` and the fallback target metadata used by the live panel and settings sheet.
- Both `AlignmentTargetButton` implementations disable the Sun/Moon buttons when availability is false, which blocks reselection even though the calibration flow can still fall back to another target.
- Existing unit tests in `tests/unit/viewer-shell-celestial.test.ts`, `tests/unit/settings-sheet.test.tsx`, and `tests/unit/viewer-settings.test.tsx` codify the current disabled-button behavior and the fixed default of Sun.

## Milestone
### Ship one focused alignment-target behavior fix
- Keep Sun and Moon target buttons clickable at all times in both the live alignment panel and the settings sheet; availability remains informational only.
- Add a local default-target resolver that uses the current scene snapshot and `sunAltitudeDeg`:
  - visible Sun only => Sun
  - visible Moon only => Moon
  - both visible => higher elevation wins
  - neither visible => Moon when `sunAltitudeDeg < 0`, otherwise Sun
- Auto-apply that heuristic only while the user has not explicitly chosen a target in the current viewer session.
- Preserve the current calibration execution fallback behavior when the preferred target is unavailable, including `alignmentTargetAvailability` and fallback-copy wiring.
- Update existing unit tests to cover always-enabled buttons, heuristic-based initial selection, and sticky manual override behavior across rerenders/scene changes.

## Interfaces And Invariants
- No route, storage-schema, public API, or settings prop shape changes are planned.
- `alignmentTargetPreference` remains the user-facing selected Sun/Moon toggle value; it should no longer be treated as a permanently hardcoded default.
- `alignmentTargetAvailability` continues to represent whether the preferred Sun or Moon currently exists in the visible calibration-target set, but it must not control button disabled state.
- The new default-target heuristic should stay co-located with the existing calibration-target resolution logic in `viewer-shell.tsx` unless implementation shows a single small helper clearly improves reuse there. Do not introduce a new shared module for this slice.
- Once the user manually selects Sun or Moon, later scene updates, visibility flips, and day/night transitions must not overwrite that preference during the same mounted viewer session.

## Validation
- Update `tests/unit/settings-sheet.test.tsx` to prove unavailable targets still render the fallback copy while remaining selectable.
- Update `tests/unit/viewer-settings.test.tsx` to reflect the non-disabled target controls in the settings-driven alignment panel.
- Extend `tests/unit/viewer-shell-celestial.test.ts` to cover:
  - initial default selection when only Sun is visible
  - initial default selection when only Moon is visible
  - tie-breaking by elevation when both are visible
  - day/night fallback when neither body is available
  - manual override staying sticky after subsequent rerenders or target-availability changes
- Final verification should run the targeted alignment-related unit suites and then `npm run test`.

## Compatibility Notes
- No migration is required.
- No intentional behavior break is planned outside the requested change from disabled target buttons and fixed-Sun defaulting to heuristic defaulting.
- Fallback messaging should remain unchanged in meaning: selecting an unavailable target is allowed, but calibration still uses the best currently available fallback target.

## Regression Prevention
- Keep the heuristic based on the same visible-scene inputs already used by `resolveCalibrationTarget(...)`; do not create a second, differently filtered notion of visibility.
- Keep button-rendering changes local to the two `AlignmentTargetButton` components; avoid incidental styling or copy changes beyond removing disabled affordances.
- Separate “default chosen by system” from “preference chosen by user” so rerenders do not oscillate the selected target or erase a manual selection.
- Preserve the current fallback resolution order for actual calibration targets so this task does not change planet/star/north-marker behavior.

## Risk Register
- R1: The heuristic could diverge from calibration availability if it uses a different filtered object set than `resolveCalibrationTarget(...)`.
  - Control: derive default-target inputs from the same visibility-filtered Sun/Moon candidates already used for calibration resolution.
- R2: An auto-selection effect could overwrite explicit user taps on later renders.
  - Control: track manual override explicitly and gate all heuristic writes behind that flag.
- R3: Removing `disabled` can accidentally suppress unavailable-state communication.
  - Control: retain availability/fallback props and assertions for the existing unavailable-target copy.
- R4: Test updates could miss the live panel path and only validate the settings sheet.
  - Control: keep at least one viewer-shell test that clicks the on-screen alignment buttons and verifies the selected target label changes.

## Rollback
- Revert only the heuristic/default-selection slice if it causes target oscillation or breaks manual override persistence, while keeping the existing fallback-resolution path unchanged.
- Revert the button interactivity change if it causes a broader UX regression, but retain any harmless test cleanup separately.
- If verification exposes conflicts between heuristic defaulting and fallback messaging, prefer restoring the prior fixed default temporarily rather than refactoring the entire calibration-resolution flow.
