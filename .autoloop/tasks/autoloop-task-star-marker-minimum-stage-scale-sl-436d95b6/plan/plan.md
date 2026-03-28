# Star Marker Minimum + Stage Scale Slider

## Goal
- Ship one coherent slice that adds a persisted `markerScale` viewer setting, lowers the star-only marker floor to `1px` at scale `1`, exposes a live stage slider above the bottom quick-action buttons, and covers the behavior with focused unit tests.

## Milestone
- Single phase: update viewer settings, marker size math, stage quick-action UI, and tests together so persistence and live rendering ship in one pass.

## Implementation
1. Viewer settings
- Extend `lib/viewer/settings.ts` with `markerScale` in `ViewerSettings`, schema parsing, defaults, and normalization.
- Keep the value in the existing viewer-settings local-storage path with default `1` and clamped persisted range `1..4`.
- Route updates through the existing `setViewerSettings` / `writeViewerSettings` flow; do not add a separate storage key or detached React state.

2. Marker size math
- Keep the shared marker-size helper in `components/viewer/viewer-shell.tsx` responsible for applying FOV scaling, per-type minimums, and the new `markerScale`.
- Preserve current base-size formulas for sun, moon, planets, satellites, aircraft, and constellations.
- Use per-type minimums at scale `1`: stars `1px`, all other marker types `6px`.
- Apply the scale multiplier after the scale-`1` floor is resolved, then round to rendered pixels so a `1px` star at scale `4` becomes `4px`.
- Maintain live stage updates by deriving rendered marker sizes directly from current `viewerSettings`.

3. Stage control
- Add a compact range input to the bottom mobile stage quick-action dock (`mobile-viewer-quick-actions`) above the existing action buttons.
- Label the control `Marker scale`, show the current decimal value, and use `min=1`, `max=4`, `step=0.1`.
- Keep the styling aligned with existing viewer controls and avoid a broader settings-sheet redesign unless implementation uncovers a hard dependency.

4. Validation
- Cover defaulting and clamp behavior for legacy persisted settings that do not include `markerScale`.
- Cover decimal persistence for saved values such as `2.4`.
- Cover marker-size math for star minimums and non-star floor preservation at scale `1` and for proportional growth at scale `4`.
- Cover the quick-action slider wiring so stage changes persist immediately and reflect in live marker rendering without reload.

## Interfaces
- `lib/viewer/settings.ts`
  - `ViewerSettings.markerScale: number`
  - schema/default/normalization support
  - legacy payload compatibility via default `1`
- `components/viewer/viewer-shell.tsx`
  - marker-size helper accepts `markerScale`
  - quick-action slider writes `markerScale` through `setViewerSettings`
- Tests
  - `tests/unit/viewer-settings.test.tsx` for persistence and normalization
  - `tests/unit/viewer-shell.test.ts` for slider placement and live persistence
  - `tests/unit/viewer-shell-celestial.test.ts` for rendered size math

## Compatibility
- Existing saved settings without `markerScale` must continue loading without migration and default to `1`.
- No intentional behavior change is planned for label display modes, center-lock logic, object selection, or non-star base-size formulas.
- The new stage control is scoped to the bottom mobile quick-action area; desktop layout changes are out of scope unless needed for regression prevention.

## Regression Controls
- Verify non-star markers still resolve to the current `6px` floor at scale `1`.
- Verify the mobile quick-action dock still preserves its existing button order and overlay behavior after the slider is inserted above the button row.
- Verify viewer-settings hydration still tolerates partial legacy payloads so onboarding/manual-observer settings do not regress.

## Rollback
- Remove the `markerScale` setting and stage slider together if quick-action layout or settings persistence regress.
- Restore the prior shared minimum-floor behavior only if the star-specific `1px` exception causes confirmed rendering failures; otherwise keep the requested star exception intact.
