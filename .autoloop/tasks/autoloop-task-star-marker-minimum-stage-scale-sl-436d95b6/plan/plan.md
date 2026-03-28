# Star Marker Minimum + Stage Scale Slider

## Scope
- Update marker sizing in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) so stars can render at a 1 px minimum while other object types keep the current 6 px floor at scale `1`.
- Add a marker scale slider to the mobile stage quick-actions area in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx), positioned above the existing bottom action buttons.
- Reuse the existing persisted `ViewerSettings.markerScale` flow in [lib/viewer/settings.ts](/workspace/SkyLens/lib/viewer/settings.ts) instead of introducing new storage/schema work.
- Extend unit coverage in [tests/unit/viewer-shell-celestial.test.ts](/workspace/SkyLens/tests/unit/viewer-shell-celestial.test.ts), [tests/unit/viewer-shell.test.ts](/workspace/SkyLens/tests/unit/viewer-shell.test.ts), and [tests/unit/viewer-settings.test.tsx](/workspace/SkyLens/tests/unit/viewer-settings.test.tsx).

## Implementation Plan
1. Reuse existing marker scale state
- Keep `ViewerSettings.markerScale` as the single persisted source of truth.
- Do not change the storage key or payload shape beyond writing the already-supported field from `ViewerShell`.

2. Update marker sizing math
- Keep sizing logic local to `ViewerShell` unless extraction is needed only to make tests clearer.
- Change marker sizing so the scale-`1` size is computed first from the existing type/FOV rules, with a type-specific minimum of `1` for stars and `6` for all current non-star types.
- Apply `markerScale` to that scale-`1` result so live stage visuals scale proportionally and a star that resolves to `1px` at scale `1` resolves to `4px` at scale `4`.
- Preserve current FOV responsiveness and focused/selected marker styling.

3. Add stage slider UI
- Add a range input labeled `Marker scale` to the closed mobile quick-actions block (`data-testid="mobile-viewer-quick-actions"`), above the existing `Open viewer` / permission / `Align` buttons.
- Use `min=1`, `max=4`, `step=0.1`, and render the current value in fixed one-decimal form.
- Wire slider changes directly into `viewerSettings` state so stage markers resize immediately without reopening overlays or settings sheets.

4. Validate persistence and regressions
- Update celestial marker tests to cover star minimum `1px`, non-star floor preservation at scale `1`, and scale multiplier behavior including the `scale=4` case.
- Add viewer-stage integration coverage that the quick-actions slider renders, updates marker scale live, and persists through the existing `readViewerSettings` / `writeViewerSettings` effect cycle.
- Keep existing settings-sheet behavior unchanged unless a shared range-control reuse is clearly lower risk than duplicating minimal slider markup in `ViewerShell`.

## Interfaces / Invariants
- `ViewerSettings.markerScale: number` is the single persisted source of truth for stage marker scaling.
- `getMarkerSizePx(...)` or equivalent must satisfy:
  - scale `1`: same sizes as today except stars may shrink to `1px`.
  - scale `4`: final rendered size is 4x the scale-`1` size for every marker/icon.
  - non-star objects do not get a lower minimum than today at scale `1`.
- The new slider is stage-only UI and must not move existing settings-sheet controls unless implementation review shows an existing shared control is safer to reuse.

## Compatibility Notes
- Existing localStorage payloads remain valid because `markerScale` is already optional on read and normalized to `1`.
- No route, API, or public contract changes are required.

## Regression Risks
- Marker sizing order: applying the multiplier before the star/non-star minimum would break the required `1px -> 4px` behavior and may change non-star floors unexpectedly.
- Mobile action layout: the new control must not hide or crowd the existing quick-action buttons or block the overlay trigger.
- Persistence churn: viewer settings writes happen on state change already, so slider writes must keep using the existing normalized field and avoid bypassing the current clamp-on-write path.

## Validation
- Run targeted Vitest coverage for viewer settings and viewer shell marker behavior.
- Confirm live DOM sizing assertions for representative objects and slider-driven updates.

## Rollback
- Remove the mobile stage slider and stop reading `viewerSettings.markerScale` in marker sizing.
- Restore the prior global `Math.max(6, ...)` floor if the new star-specific minimum or multiplier causes regressions.
