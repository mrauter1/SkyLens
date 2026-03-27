# Alignment Tutorial Plan

## Objective
Make the live alignment UI read like an explicit tutorial, surface blocker messages inside the alignment flow when action is blocked or degraded, and expose the existing manual fine-adjust nudges on the on-view alignment panel without changing the underlying calibration model.

## Relevant Code
- `components/viewer/viewer-shell.tsx`
- `components/settings/settings-sheet.tsx`
- `tests/unit/viewer-shell.test.ts`
- `tests/unit/viewer-shell-celestial.test.ts`
- `tests/unit/settings-sheet.test.tsx`
- `tests/unit/viewer-settings.test.tsx`

## Current State And Gaps
- The viewer already renders an `AlignmentInstructionsPanel` with numbered steps and Sun/Moon target buttons.
- The settings sheet already exposes fine-adjust nudges and reset, but those manual controls are not available from the live on-view panel.
- Tutorial copy is partly generic. It still says “Choose the Sun or Moon target” even when the resolved calibration target is a fallback such as a planet or north marker.
- Blocker/status messaging is split across fallback banners and settings status text, so the alignment panel does not consistently explain why Align is disabled or what the user should do next.

## Implementation Plan

### Milestone 1: Unify alignment tutorial/state derivation
- Derive one alignment-panel view model in `viewer-shell.tsx` from existing runtime state:
  - resolved calibration target and fallback state
  - selected target preference
  - `startupState`
  - `cameraPose.mode`
  - `canAlignCalibration`
  - reset availability and fine-adjust availability
- Replace generic tutorial copy with target-aware steps so the panel explains the actual next action for Sun, Moon, fallback targets, or manual-only situations.
- Make the numbered sequence explicit as: choose Sun or Moon, center the resolved target, align when available, use manual nudges if labels still drift, then reset/retry if needed.
- Keep the alignment target contract as `sun | moon`; “manual” remains the fine-adjust/reset controls, not a third target value.

### Milestone 2: Expand the on-view alignment panel
- Extend `AlignmentInstructionsPanel` to render:
  - explicit numbered steps
  - inline blocker/status copy when the user cannot complete the next step yet
  - manual nudge controls (`left`, `right`, `up`, `down`) using the existing fine-adjust callback
  - reset control when reset is currently allowed
  - align CTA state/copy that matches current availability
- Preserve existing Sun/Moon toggle behavior and fallback messaging.
- Keep desktop, mobile overlay, and compact mobile alignment-focus layouts usable without hiding the persistent Align action.

### Milestone 3: Keep settings-sheet parity and lock regressions
- Reuse the same target-aware tutorial and blocker derivation for the settings-sheet alignment panel where it avoids copy drift.
- Preserve current calibration persistence, target preference persistence, and fallback resolution behavior.
- Add/update tests covering:
  - target-aware step copy for Sun, Moon, and fallback targets
  - blocker messaging when alignment cannot run yet
  - live-panel manual nudge callbacks
  - mobile alignment-focus rendering with the updated panel

## Interface Notes
- `AlignmentInstructionsPanel` will likely need additional props for:
  - tutorial steps
  - status/blocker messages
  - align/reset availability
  - fine-adjust callbacks
  - optional CTA labels for compact/mobile rendering
- No route, storage schema, or public API changes are expected.
- Existing pose calibration persistence in viewer settings remains authoritative.

## Compatibility And Regression Notes
- Do not replace the existing fallback resolution order (`preferred Sun/Moon -> auto target -> planet/star/north marker`).
- Do not introduce a new persisted “manual” alignment target; that would change behavior beyond the request.
- Do not make fine-adjust mutate unrelated viewer settings or bypass the existing pose-calibration update path.
- Keep the mobile quick-action Align button visible as current tests require.

## Validation
- Run the alignment-related unit suites:
  - `tests/unit/viewer-shell.test.ts`
  - `tests/unit/viewer-shell-celestial.test.ts`
  - `tests/unit/settings-sheet.test.tsx`
  - `tests/unit/viewer-settings.test.tsx`
- Confirm target switching, align/reset/nudge callbacks, and blocker copy in both desktop and mobile alignment flows.

## Risk Register
- Risk: Tutorial copy drifts again between the live panel and settings sheet.
  - Control: derive shared step/blocker content from one helper or one caller-owned view model.
- Risk: Compact mobile alignment panel becomes too dense and crowds the Align action.
  - Control: keep layout compact-aware and preserve existing quick-action visibility assertions.
- Risk: Nudge controls become active in unsupported/manual states and imply live alignment is available when it is not.
  - Control: gate CTA and blocker messaging off existing `canAlignCalibration`, `cameraPose.mode`, and reset/fine-adjust availability.
- Risk: Fallback targets produce contradictory copy.
  - Control: base all step text on the resolved `calibrationTarget`, not only on the preferred Sun/Moon selection.

## Rollback
- Revert the alignment-panel prop expansion and rendering changes in `viewer-shell.tsx`.
- Revert any settings-sheet parity changes if they introduce copy or layout regressions.
- Restore the previous alignment-related unit expectations if the new tutorial panel needs to be backed out.
