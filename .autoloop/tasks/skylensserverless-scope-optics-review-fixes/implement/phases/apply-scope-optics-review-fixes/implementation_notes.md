# Implementation Notes

- Task ID: skylensserverless-scope-optics-review-fixes
- Pair: implement
- Phase ID: apply-scope-optics-review-fixes
- Phase Directory Key: apply-scope-optics-review-fixes
- Phase Title: Apply scope optics hardening and viewer-shell parity fixes
- Scope: phase-local producer artifact

## Files Changed
- `lib/viewer/settings.ts`
- `lib/viewer/scope-optics.ts`
- `components/settings/settings-sheet.tsx`
- `components/viewer/viewer-shell.tsx`
- `tests/unit/scope-optics.test.ts`
- `tests/unit/viewer-settings.test.tsx`
- `tests/unit/settings-sheet.test.tsx`
- `tests/unit/viewer-shell.test.ts`

## Symbols Touched
- `SCOPE_OPTICS_RANGES`
- `normalizeScopeOpticsSettings`
- `computeLimitingMagnitude`
- `computeStarPhotometry`
- `ScopeQuickControls`
- `ScopeStarMarker`
- `getScopeRenderMetadata`
- `buildSceneSnapshot`

## Checklist Mapping
- Shared optics hardening and viewer-shell refactor: completed.
- Shared optics range export and reuse in normalization/UI: completed.
- Exported optics helper normalization for direct callers: completed.
- Scope star marker extraction and parity-preserving render path: completed.
- Shared `ScopeOpticsSettings` usage in viewer-shell helper contracts: completed.
- Desktop quick-controls parity for aperture/magnification: completed.
- Scope-render Zod evaluation: rejected as non-beneficial; current finite guard retained and tested.
- Targeted and broader test execution: completed.

## Assumptions
- The existing desktop primary action row is the intended desktop quick-controls surface.
- `scopeRender` metadata remains an in-process handoff rather than an untrusted persistence/network boundary.

## Preserved Invariants
- Valid scope optics formulas and output remain unchanged for already-valid inputs.
- Scope optics stays an extra rendering/filter stage.
- Transparency and marker scale remain Settings-only.
- Persisted viewer settings stay backward compatible through normalization.

## Intended Behavior Changes
- Exported scope optics helpers now normalize invalid optics inputs before logarithmic math, preventing `NaN` for direct callers.
- Desktop quick-controls now expose aperture and magnification when scope mode is enabled.

## Known Non-Changes
- No Zod schema was added for `scopeRender`.
- Scope mode toggle placement was not expanded into the desktop primary row.
- Marker scale and transparency were not moved into quick controls.

## Expected Side Effects
- Shared optics bounds now drive persisted normalization plus the relevant settings and quick-control sliders, reducing drift risk.
- Scope star marker rendering is easier to inspect and test as an isolated component/helper.

## Deduplication / Centralization
- Centralized aperture, magnification, and transparency ranges in `SCOPE_OPTICS_RANGES`.
- Consolidated mobile and desktop scope quick controls into one local helper component.
- Reused `ScopeOpticsSettings` instead of the duplicated inline viewer-shell shape.

## Validation Performed
- `pnpm install --frozen-lockfile`
- `pnpm test -- tests/unit/scope-optics.test.ts tests/unit/viewer-settings.test.tsx tests/unit/settings-sheet.test.tsx tests/unit/viewer-shell.test.ts`
- `pnpm test`
