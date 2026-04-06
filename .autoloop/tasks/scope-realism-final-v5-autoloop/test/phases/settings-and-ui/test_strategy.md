# Test Strategy

- Task ID: scope-realism-final-v5-autoloop
- Pair: test
- Phase ID: settings-and-ui
- Phase Directory Key: settings-and-ui
- Phase Title: Settings migration and telescope diameter control
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- Persisted settings defaulting/clamp/writeback:
  `SkyLensServerless/tests/unit/viewer-settings.test.tsx`
  Covers missing `scopeLensDiameterPct`, oversized values, invalid stored values, and normalized persistence writes.
- Settings sheet UI exposure and delegation:
  `SkyLensServerless/tests/unit/settings-sheet.test.tsx`
  Covers hidden state when scope controls are unavailable, visible telescope diameter slider when available, slider range metadata, and callback delegation.
- Viewer-owned runtime wiring:
  `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  Covers `SettingsSheet` prop wiring, default diameter propagation, and clamped callback updates reaching persisted viewer state.

## Preserved invariants checked
- Storage key remains unchanged and older payloads still hydrate.
- `SettingsSheet` remains presentation-only and does not own normalization.
- Viewer-shell remains the owner of immediate settings-state updates.

## Edge cases
- Missing persisted field.
- Invalid persisted field type.
- Out-of-range UI callback input clamped at viewer-shell/settings normalization boundary.
- Scope controls absent when the viewer does not expose them.

## Failure paths
- Malformed or oversized `scopeLensDiameterPct` values normalize to safe bounds/defaults instead of breaking the rest of the settings payload.

## Flake risks / stabilization
- Viewer-shell settings wiring is covered with a mocked `SettingsSheet` to avoid dialog/focus timing noise.
- Existing jsdom canvas warnings are non-failing in `viewer-shell.test.ts`; assertions avoid relying on canvas rendering internals for this phase.

## Known gaps
- This phase does not test actual runtime lens-pixel geometry because the phase contract explicitly scoped that behavior out.
