# Implementation Notes

- Task ID: skylensserverless-prd-ard-rerun
- Pair: implement
- Phase ID: scope-realism-slice
- Phase Directory Key: scope-realism-slice
- Phase Title: Scope realism settings, optics, and star rendering
- Scope: phase-local producer artifact

## Files Changed
- `SkyLensServerless/lib/viewer/scope-optics.ts`
- `SkyLensServerless/lib/viewer/settings.ts`
- `SkyLensServerless/lib/astronomy/stars.ts`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/components/viewer/scope-lens-overlay.tsx`
- `SkyLensServerless/components/settings/settings-sheet.tsx`
- `SkyLensServerless/tests/unit/scope-optics.test.ts`
- `SkyLensServerless/tests/unit/viewer-settings.test.tsx`
- `SkyLensServerless/tests/unit/settings-sheet.test.tsx`
- `SkyLensServerless/tests/unit/celestial-layer.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`

## Symbols Touched
- `SCOPE_OPTICS_RANGES`
- `normalizeScopeOptics`, `normalizeScopeOpticsValue`
- `computeScopeLimitingMagnitude`, `computeScopeRenderProfile`, `passesScopeLimitingMagnitude`
- `ViewerSettings.scopeModeEnabled`
- `ViewerSettings.scopeOptics`
- `readViewerSettings`
- `getSettingsObject`, `readBooleanSetting`
- `normalizeVisibleStars`
- `SettingsSheet`
- `buildSceneSnapshot`
- `QuickRangeSlider`
- `getScopeMarkerSizePx`, `getScopeMarkerOpacity`

## Checklist Mapping
- Milestone 1: added canonical scope toggle/optics state and shared optics math/range helpers.
- Milestone 2: applied scope-only limiting-magnitude filtering and scope render metadata in the star pipeline, with viewer fallback on malformed metadata.
- Milestone 3: added desktop/mobile aperture+magnification quick controls, moved marker scale ownership to Settings, and made transparency explicit in Settings props.
- Milestone 4: added targeted optics/settings/viewer/star tests and reran the requested SkyLensServerless unit slice.

## Assumptions
- The new optics defaults are `120mm`, `50x`, and `85%` transparency as neutral starter values for persisted state and quick controls.

## Preserved Invariants
- Existing likely-visible gating still runs before any scope optics filtering.
- `scope.verticalFovDeg` remains the existing lens/deep-star control and was not repurposed.
- Non-scope marker sizing behavior stays unchanged.

## Intended Behavior Changes
- `scopeModeEnabled` is now the canonical runtime/persisted scope toggle, with legacy `scope.enabled` treated as read-only migration input.
- Malformed persisted scope toggle/optics payloads now sanitize field-by-field instead of resetting unrelated viewer settings to defaults.
- Scope mode now filters bundled stars by limiting magnitude and carries compact photometric render metadata for the scope lens.
- Desktop/mobile quick controls now show scope aperture and magnification when scope mode is enabled.

## Known Non-Changes
- No repo-root SkyLens app files were modified.
- Scope deep-star dataset selection and scope vertical-FOV behavior were left intact.

## Expected Side Effects
- Older persisted payloads that only store `scope.enabled` continue to load, but newly normalized settings serialize with `scopeModeEnabled` plus `scopeOptics`.
- Scope bright-star lens markers can dim/resize from `metadata.scopeRender`, but malformed metadata falls back to the legacy marker path.

## Validation Performed
- `cd /workspace/SkyLens/SkyLensServerless && npm ci`
- `cd /workspace/SkyLens/SkyLensServerless && npx vitest run tests/unit/viewer-settings.test.tsx`
- `cd /workspace/SkyLens/SkyLensServerless && npx vitest run tests/unit/scope-optics.test.ts tests/unit/viewer-settings.test.tsx tests/unit/settings-sheet.test.tsx tests/unit/celestial-layer.test.ts tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`

## Deduplication / Centralization
- Shared optics slider ranges and normalization live in `lib/viewer/scope-optics.ts` and are reused by settings normalization, quick controls, and Settings transparency UI.
