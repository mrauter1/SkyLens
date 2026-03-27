# Test Strategy

- Task ID: implement-alignment-ui-requirements-md-keep-alig-0a608ab4
- Pair: test
- Phase ID: alignment-ui-updates
- Phase Directory Key: alignment-ui-updates
- Phase Title: Alignment UI updates
- Scope: phase-local producer artifact

## Behavior coverage map
- AC-1 live align visibility after success:
  Covered in `tests/unit/viewer-shell.test.ts` by asserting the mobile `Align` action still renders after a calibrated sensor state and can re-enter explicit alignment focus.
- AC-2 explicit calibration instructions:
  Covered in `tests/unit/viewer-shell.test.ts` for live relative-sensor warning copy and instruction text.
  Covered in `tests/unit/settings-sheet.test.tsx` and `tests/unit/viewer-settings.test.tsx` for the real settings calibration panel step list and target controls.
- AC-3 Sun/Moon target selection and fallback:
  Covered in `tests/unit/viewer-shell-celestial.test.ts` for Sun→Moon preference override, suppressed/unavailable fallback to Moon/planet/star, direct live on-screen target-button interaction, and settings-prop fallback metadata when the preferred body is unavailable.
  Covered in `tests/unit/settings-sheet.test.tsx` for disabled unavailable target UI and fallback copy.
- AC-4 focused regression coverage:
  Covered by preserving prior align/fine-adjust/reset expectations in `tests/unit/viewer-shell.test.ts` and `tests/unit/viewer-settings.test.tsx` while extending only alignment-relevant assertions.

## Preserved invariants checked
- Target preference remains session-scoped and does not touch persisted viewer settings.
- Unavailable Sun/Moon choices preserve the existing automatic fallback priority instead of blocking alignment.
- Calibration instructions do not remove fine-adjust, reset, FOV, or existing settings interactions.

## Edge cases
- Already-calibrated live sensor state still exposes `Align`.
- Relative-sensor startup shows instructions before alignment.
- Preferred Moon unavailable while Sun is available passes fallback metadata and keeps effective target on Sun.
- Live relative-sensor state lets the duplicated on-screen Moon button flip the active target from Sun to Moon without depending on the settings sheet.
- No Sun/Moon available in the real settings integration keeps both toggle buttons disabled.

## Failure paths
- Disabled target selection UI is asserted when the requested celestial body is unavailable.
- Environment validation remains limited because the workspace does not currently have installed `node_modules`; commands were not relied on for deterministic pass/fail in this phase artifact.

## Known gaps
- Runtime execution still could not be completed in this workspace because the local package dependencies are missing.
