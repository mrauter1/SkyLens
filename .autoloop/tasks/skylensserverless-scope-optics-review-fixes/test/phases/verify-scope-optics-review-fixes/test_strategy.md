# Test Strategy

- Task ID: skylensserverless-scope-optics-review-fixes
- Pair: test
- Phase ID: verify-scope-optics-review-fixes
- Phase Directory Key: verify-scope-optics-review-fixes
- Phase Title: Verify touched scope optics and viewer behavior
- Scope: phase-local producer artifact

## Behavior-to-Test Coverage Map
- Invalid optics normalization in exported helpers:
  `tests/unit/scope-optics.test.ts`
  Covers malformed aperture/magnification/transparency input, equality with normalized settings, and finite limiting-magnitude/photometry outputs.
- Shared scope optics range reuse:
  `tests/unit/viewer-settings.test.tsx`
  Covers persisted scope-optics clamping and direct `normalizeScopeOpticsSettings` reuse of `SCOPE_OPTICS_RANGES`.
- Settings-only transparency and marker scale behavior:
  `tests/unit/settings-sheet.test.tsx`
  Covers transparency slider min/max/step wiring from `SCOPE_OPTICS_RANGES` and confirms aperture/magnification stay out of Settings.
- Mobile and desktop quick-controls parity:
  `tests/unit/viewer-shell.test.ts`
  Covers mobile quick-actions scope toggle synchronization plus aperture/magnification sliders, and desktop primary-action-row aperture/magnification controls when scope mode is enabled.
- Scope marker refactor parity and malformed metadata fallback:
  `tests/unit/viewer-shell.test.ts`
  Covers `ScopeStarMarker` sizing/focus behavior and `getScopeRenderMetadata` fallback to the standard marker on malformed metadata.

## Preserved Invariants Checked
- Scope optics remains an additional render/filter stage.
- Transparency and marker scale remain Settings-only.
- Persisted viewer settings remain backward compatible through normalization.
- No schema-based `scopeRender` parse was introduced.

## Edge Cases / Failure Paths
- Non-finite and out-of-range scope-optics inputs.
- Partial persisted scope-optics payloads.
- Scope mode toggled off after quick-control interaction.
- Malformed `scopeRender` metadata with `NaN` values.

## Execution Evidence
- `pnpm test -- tests/unit/scope-optics.test.ts tests/unit/viewer-settings.test.tsx tests/unit/settings-sheet.test.tsx tests/unit/viewer-shell.test.ts`
  Result: passed, 30 test files and 270 tests.
- `pnpm test`
  Result: passed, 30 test files and 270 tests.

## Flake / Environment Notes
- Running the targeted and full Vitest commands in parallel caused a transient `.cache/scope-build/...` `ENOENT` failure in `tests/unit/scope-data-build.integration.test.ts`.
- Re-running `pnpm test` in isolation passed cleanly, so the stabilized phase result uses serial execution only and does not classify the transient cache-contention failure as a product regression.

## Known Gaps
- No additional schema-validation tests were added because the accepted plan explicitly retained the existing finite-number guard instead of adding Zod at the `scopeRender` boundary.
