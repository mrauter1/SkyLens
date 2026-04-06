# SkyLens Scope Realism Plan

## Scope

- Implement the change in the repo-root Next.js app only. The sibling `SkyLensServerless/` tree is excluded by the active root `tsconfig.json` and is out of scope for this task.
- Preserve the existing `likelyVisibleOnly` daylight contract exactly. Scope optics is an additional star-only filter/rendering layer, not a replacement for current visibility gating.
- Keep persistence backward compatible by extending the existing `skylens.viewer-settings.v1` payload shape instead of introducing a new storage key.

## Current Baseline

- [lib/viewer/settings.ts](/workspace/SkyLens/lib/viewer/settings.ts) owns the persisted viewer settings schema, defaults, normalization, and legacy payload compatibility. It currently has `markerScale` but no scope-mode or optics state.
- [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) is the canonical owner of `viewerSettings`, mobile quick controls, and star marker sizing. Mobile quick controls currently expose `markerScale`; settings-sheet state flows through local prop callbacks.
- [components/settings/settings-sheet.tsx](/workspace/SkyLens/components/settings/settings-sheet.tsx) is the settings surface and currently has no scope optics controls.
- [lib/astronomy/stars.ts](/workspace/SkyLens/lib/astronomy/stars.ts) currently applies only enabled-layer, likely-visible/daylight, and horizon gating before returning visible stars. Star rendering in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) still uses legacy magnitude-based marker sizing with no photometric metadata.

## Milestones

### 1. Settings and optics foundation

- Extend `ViewerSettings` with:
  - `scopeModeEnabled: boolean`
  - `scopeOptics: { apertureMm: number; magnificationX: number; transparencyPct: number }`
- Add defaults and normalization clamps in [lib/viewer/settings.ts](/workspace/SkyLens/lib/viewer/settings.ts):
  - aperture `50..400`
  - magnification `10..400`
  - transparency `40..100`
  - defaults `false / 100 / 40 / 80`
- Create [lib/viewer/scope-optics.ts](/workspace/SkyLens/lib/viewer/scope-optics.ts) with pure deterministic helpers:
  - `computeLimitingMagnitude(optics, altitudeDeg)`
  - `isStarVisibleWithScopeOptics(starMagnitude, optics, altitudeDeg)`
  - `computeStarPhotometry(starMagnitude, optics, altitudeDeg)`
- Implement the locked formulas exactly, with shared internal airmass/clamp helpers kept local to the module rather than spreading optics math across the viewer.
- Extend the star pipeline in [lib/astronomy/stars.ts](/workspace/SkyLens/lib/astronomy/stars.ts) so the existing gates stay first, then scope filtering runs only when `scopeModeEnabled` is true, and passing stars carry optional render metadata for the viewer.
- Keep the filter/render payload star-specific and optional:
  - add `metadata.scopeRender = { displayIntensity, corePx, haloPx }` only for stars when scope mode is enabled
  - keep non-star `SkyObject` shapes and behavior unchanged

### 2. Viewer controls and rendering integration

- Update [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) so:
  - quick controls expose `scopeModeEnabled`
  - quick controls expose `apertureMm` and `magnificationX` only while scope mode is on
  - `markerScale` is removed from quick controls
  - the settings-sheet callback set includes mirrored scope-mode and transparency controls, all backed by the same `viewerSettings` state
- Update [components/settings/settings-sheet.tsx](/workspace/SkyLens/components/settings/settings-sheet.tsx) props and layout so Settings contains:
  - mirrored scope-mode toggle
  - transparency control
  - marker-scale control
  - no quick-control-only optics knobs other than the mirrored toggle
- Update star marker rendering in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) to consume `metadata.scopeRender` directly when present, while preserving legacy rendering when scope mode is off.
- Keep stars compact by using `corePx`/`haloPx` from scope photometry instead of scaling star diameter from magnification. Marker-scale remains a separate user display multiplier in Settings and must not become a proxy for optical magnification.
- Continue feeding filtered `visibleStars` into constellation construction so scope mode cannot show constellation overlays for stars the optics filter already hid.

## Interfaces

- `ViewerSettings`
  - add `scopeModeEnabled: boolean`
  - add `scopeOptics: ScopeOpticsSettings`
- `ScopeOpticsSettings`
  - `apertureMm: number`
  - `magnificationX: number`
  - `transparencyPct: number`
- `SkyObject.metadata.scopeRender?`
  - `displayIntensity: number`
  - `corePx: number`
  - `haloPx: number`
- `normalizeVisibleStars(...)`
  - extend the input with the scope settings needed to apply the new filter and attach render metadata
  - preserve the existing daylight and horizon semantics before scope-mode logic executes

## Validation

- Add [tests/unit/scope-optics.test.ts](/workspace/SkyLens/tests/unit/scope-optics.test.ts) for deterministic formula checks and monotonic changes across aperture, magnification, transparency, and altitude.
- Extend [tests/unit/viewer-settings.test.tsx](/workspace/SkyLens/tests/unit/viewer-settings.test.tsx) for defaults, clamps, persisted legacy payload compatibility, and round-tripping the new nested optics state.
- Extend [tests/unit/settings-sheet.test.tsx](/workspace/SkyLens/tests/unit/settings-sheet.test.tsx) for Settings control placement, mirrored scope toggle behavior, transparency control, and marker-scale relocation.
- Extend [tests/unit/viewer-shell.test.ts](/workspace/SkyLens/tests/unit/viewer-shell.test.ts) and [tests/unit/viewer-shell-celestial.test.ts](/workspace/SkyLens/tests/unit/viewer-shell-celestial.test.ts) for quick-control visibility, toggle sync, marker-scale removal from quick controls, scope-only star filtering, and compact photometric rendering behavior.
- Extend [tests/unit/celestial-layer.test.ts](/workspace/SkyLens/tests/unit/celestial-layer.test.ts) with non-regression checks that likely-visible/daylight behavior is unchanged when scope mode is off and remains upstream when scope mode is on.

## Compatibility, Rollout, Rollback

- Compatibility:
  - keep the existing local-storage key
  - load older payloads by defaulting absent scope fields
  - preserve current non-star rendering and current likely-visible logic
- Rollout:
  - scope realism remains dark by default because `scopeModeEnabled` defaults to `false`
  - new optics controls become active only after the user enables scope mode
- Rollback:
  - revert the optics module, settings-schema extension, and viewer/settings UI changes together so persisted payload handling and rendering do not drift apart

## Regression Risks and Controls

- Risk: scope optics accidentally changes daylight or horizon behavior.
  Control: keep current star gating order intact and test explicitly against existing likely-visible expectations.
- Risk: magnification leaks into marker-scale behavior and inflates stars unrealistically.
  Control: render from photometric `corePx`/`haloPx` and treat marker-scale as a separate Settings-only multiplier.
- Risk: legacy settings payloads fail parsing due to the new nested object.
  Control: keep the schema partial-friendly, default missing nested optics state, and clamp malformed values during normalization.
- Risk: constellation overlays bypass the new star filter.
  Control: keep `buildVisibleConstellations` driven by the already filtered `visibleStars` output.
