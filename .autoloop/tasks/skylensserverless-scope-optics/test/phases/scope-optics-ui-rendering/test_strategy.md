# Test Strategy

- Task ID: skylensserverless-scope-optics
- Pair: test
- Phase ID: scope-optics-ui-rendering
- Phase Directory Key: scope-optics-ui-rendering
- Phase Title: Controls and Rendering Integration
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- AC-1 quick controls:
  - `tests/unit/viewer-shell.test.ts`
  - Covers mobile quick-control scope toggle visibility, aperture/magnification visibility only when scope mode is enabled, quick-control persistence for aperture/magnification, and removal of marker-scale from quick controls.
- AC-1 Settings surface:
  - `tests/unit/settings-sheet.test.tsx`
  - Covers mirrored scope toggle, transparency slider, marker-scale slider, and confirms Settings does not expose aperture or magnification.
- AC-1 canonical sync / persistence:
  - `tests/unit/viewer-settings.test.tsx`
  - Covers persisted scope-mode/transparency/marker-scale round-trip through the real settings sheet.
  - `tests/unit/viewer-shell.test.ts`
  - Covers quick-control toggle sync back through mocked SettingsSheet props.

## Preserved invariants checked

- Scope mode remains backed by persisted `viewerSettings.scopeModeEnabled`.
- Marker-scale remains separate from optics inputs and stays Settings-only.
- Legacy rendering remains available when a star has no `scopeRender`.
- Existing scope-foundation coverage in `tests/unit/celestial-layer.test.ts` still protects upstream likely-visible/daylight behavior.

## Edge cases covered

- Scope controls hidden when scope mode is off, then revealed immediately when enabled.
- Aperture and magnification edits persist after enabling scope mode.
- Settings-only controls are present even when scope mode is disabled, with default transparency and marker-scale values.
- Scope-rendered stars use compact halo/core dimensions instead of the legacy large bright-star marker size.

## Failure paths / regression traps

- A regression that reintroduces marker-scale into mobile quick controls fails `viewer-shell.test.ts`.
- A regression that exposes aperture or magnification in Settings fails `settings-sheet.test.tsx`.
- A regression that stops persisting scope settings through the real SettingsSheet fails `viewer-settings.test.tsx`.
- A regression that ignores `scopeRender` metadata or falls back to the legacy star size for scoped stars fails `viewer-shell-celestial.test.ts`.

## Stabilization approach

- Tests use deterministic mocked viewer/settings props and DOM input events instead of timing-sensitive end-to-end flows.
- Existing async viewer tests reuse the repository’s `flushEffects` pattern to avoid microtask timing flakes.

## Known gaps

- The bundled star catalog still cannot naturally hit the limiting-magnitude cutoff envelope; that remains covered by the earlier mocked scope-foundation tests rather than fixture-driven UI scenes.
