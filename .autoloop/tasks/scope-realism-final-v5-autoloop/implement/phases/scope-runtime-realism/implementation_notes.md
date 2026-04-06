# Implementation Notes

- Task ID: scope-realism-final-v5-autoloop
- Pair: implement
- Phase ID: scope-runtime-realism
- Phase Directory Key: scope-runtime-realism
- Phase Title: Scope runtime rendering realism
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/viewer/scope-star-canvas.tsx`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/scope-star-canvas.test.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`

## Symbols touched
- `ScopeStarCanvas`
- `getScopeMarkerSizePx`
- `getScopeMarkerOpacity`
- `getScopeLensDiameterPx`
- `getScopeDeepStarDisplayIntensity`
- `getScopeExtendedObjectSizePx`
- `getScopeExtendedObjectOpacity`
- `getScopeExtendedObjectBaselineAngularDiameterDeg`

## Checklist mapping
- Plan Phase 2: completed core-only deep-star drawing, display-only aperture dimming, height-derived lens sizing, and local extended-object scope size/opacity helpers.
- Plan Phase 3: completed targeted updates in `scope-star-canvas.test.tsx`, `viewer-shell-scope-runtime.test.tsx`, and the affected `viewer-shell.test.ts` lens-width assertion.
- Deferred: none inside phase scope.

## Assumptions
- The nested `SkyLensServerless/` tree remains the authoritative implementation surface for this task.
- Planet baseline angular diameters are rendering fallbacks, not physical transport data, because celestial metadata is intentionally unchanged for this phase.

## Preserved invariants
- Deep-star inclusion order stays daylight gate -> horizon gate -> limiting magnitude -> render-profile compute.
- `haloPx` remains in deep-star payloads and parsed `scopeRender` metadata for compatibility.
- Scope projection, tile selection, and center-lock continue using the final clamped square lens diameter.
- Wide-view marker sizing/opacity behavior is unchanged.

## Intended behavior changes
- Deep stars now render as one compact core-only fill pass with deterministic radius/alpha clamps.
- Smaller aperture dims deep-star display only after `computeScopeRenderProfile`, without altering gating.
- Scope lens diameter now derives from persisted `% of height` input, clamps to viewport-safe bounds, and stays monotonic across the supported range even on tall portrait layouts that would otherwise collapse every supported value to one size.
- Sun, Moon, and planet scope markers now size from one local baseline angular-size table and use deterministic opacity rules tied to aperture and magnification.

## Known non-changes
- No deep-star catalog/data-pipeline changes.
- No `SkyObject` metadata expansion for angular-size transport.
- No wide-view marker behavior changes.
- No `.bin` artifacts added.

## Expected side effects
- Tall portrait layouts still stay inside viewport-safe bounds, but the supported `50..90` slider range now remaps into that safe envelope so the control remains visibly responsive instead of saturating immediately.
- Planet disks are intentionally more visible than physical angular diameters alone would allow so magnification changes remain perceptible under the clamped scope FOV.

## Validation performed
- Passed required command:
  `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/settings-sheet.test.tsx`
- Passed broader scoped run:
  `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/scope-optics.test.ts tests/unit/scope-runtime.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/settings-sheet.test.tsx tests/unit/scope-lens-overlay.test.tsx`

## Deduplication / centralization
- Kept all extended-object scope size inputs in one `viewer-shell.tsx` table instead of reintroducing per-object scattered constants.
- Reused `normalizeScopeLensDiameterPct` for runtime clamp math so persisted and live values stay aligned.
