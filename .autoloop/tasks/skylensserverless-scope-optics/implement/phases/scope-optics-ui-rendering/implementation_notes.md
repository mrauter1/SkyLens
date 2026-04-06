# Implementation Notes

- Task ID: skylensserverless-scope-optics
- Pair: implement
- Phase ID: scope-optics-ui-rendering
- Phase Directory Key: scope-optics-ui-rendering
- Phase Title: Controls and Rendering Integration
- Scope: phase-local producer artifact

## Files changed

- `components/viewer/viewer-shell.tsx`
- `components/settings/settings-sheet.tsx`
- `tests/unit/viewer-shell.test.ts`
- `tests/unit/viewer-shell-celestial.test.ts`
- `tests/unit/settings-sheet.test.tsx`
- `tests/unit/viewer-settings.test.tsx`

## Symbols touched

- `ViewerShell`
- `SettingsSheet`
- `getScopeRenderMetadata`
- mobile quick-action scope controls
- settings-sheet scope and marker-scale callbacks/tests

## Checklist mapping

- Plan Milestone 2: added quick-control scope toggle plus aperture/magnification gating in `viewer-shell`.
- Plan Milestone 2: moved marker-scale control into `settings-sheet`; added mirrored scope toggle and transparency control there.
- Plan Milestone 2: consumed `metadata.scopeRender` in star marker rendering while preserving the legacy branch when absent.
- Validation: added/updated viewer, settings-sheet, and settings persistence tests for control placement, synchronization, compact scope rendering, and persistence.

## Assumptions

- Existing mobile quick actions are the intended quick-controls surface for this phase.
- Applying marker-scale after scope photometry sizing is acceptable because the product defines marker-scale as a display-only control, not an optical input.

## Preserved invariants

- `viewerSettings.scopeModeEnabled` remains the canonical synchronized toggle state across quick controls and Settings.
- Aperture and magnification remain quick-controls-only knobs.
- Transparency and marker-scale remain Settings controls.
- Stars without `scopeRender` still use the previous marker sizing/render path.
- No changes were made to likely-visible/daylight gating semantics.

## Intended behavior changes

- Mobile quick controls now expose `scopeModeEnabled` and reveal aperture/magnification only while enabled.
- Settings now exposes the mirrored scope toggle, transparency slider, and marker-scale slider.
- Scope-rendered stars draw from photometric `corePx`/`haloPx` metadata instead of legacy magnitude sizing.

## Known non-changes

- No storage key migration or new persisted storage key.
- No changes to constellation construction ordering or likely-visible logic.
- No unrelated overlay/alignment redesign work.

## Expected side effects

- Persisted marker-scale edits now originate from Settings instead of the mobile quick strip.
- Scoped stars can render smaller than legacy bright-star markers because the renderer now respects compact photometric metadata directly.

## Validation performed

- `pnpm test -- --run tests/unit/settings-sheet.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/celestial-layer.test.ts tests/unit/scope-optics.test.ts`
- `pnpm eslint components/viewer/viewer-shell.tsx components/settings/settings-sheet.tsx tests/unit/settings-sheet.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts`
  - Result: no lint errors; existing pre-phase warnings remain in `components/viewer/viewer-shell.tsx` for hook dependency arrays and an unused `FallbackBanner`.

## Deduplication / centralization decisions

- Reused the existing canonical `viewerSettings` state and `SettingsSheet` prop flow instead of introducing a separate scope-controls state.
- Kept scope marker rendering localized in `ViewerShell` with a small `getScopeRenderMetadata` guard rather than spreading photometry parsing across the astronomy pipeline and UI.
