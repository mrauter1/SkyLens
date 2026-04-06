# Test Strategy

- Task ID: skylensserverless-scope-optics-review-fixes
- Pair: test
- Phase ID: apply-scope-optics-review-fixes
- Phase Directory Key: apply-scope-optics-review-fixes
- Phase Title: Apply scope optics hardening and viewer-shell parity fixes
- Scope: phase-local producer artifact

## Behavior-to-Test Coverage

- Exported scope optics helper hardening:
  Covered in `tests/unit/scope-optics.test.ts` with invalid optics inputs routed through `computeLimitingMagnitude` and `computeStarPhotometry`, asserting finite output parity with normalized inputs.
- Shared scope optics range reuse:
  Covered in `tests/unit/viewer-settings.test.tsx` via persisted-settings clamping and direct `normalizeScopeOpticsSettings` expectations against `SCOPE_OPTICS_RANGES`.
  Covered in `tests/unit/settings-sheet.test.tsx` via transparency slider `min`/`max`/`step` assertions.
  Covered in `tests/unit/viewer-shell.test.ts` via mobile and desktop quick-control slider `min`/`max`/`step` assertions.
- Desktop and mobile quick-controls parity:
  Covered in `tests/unit/viewer-shell.test.ts` by enabling scope mode, asserting aperture/magnification controls appear in both surfaces, updating values, and verifying persisted settings sync.
- Scope marker extraction parity:
  Covered in `tests/unit/viewer-shell.test.ts` through direct `ScopeStarMarker` render assertions for size math and focused ring behavior.
- Malformed `scopeRender` fallback guard:
  Covered in `tests/unit/viewer-shell.test.ts` through direct `getScopeRenderMetadata` expectations for malformed and valid metadata.

## Preserved Invariants Checked

- Valid default optics output remains stable.
- Transparency and marker scale remain Settings-only.
- Scope mode toggle synchronization with persisted settings remains intact.
- No Zod schema expectation was introduced for `scopeRender`.

## Edge Cases / Failure Paths

- Non-finite and out-of-range optics values.
- Persisted scope optics values above and below supported bounds.
- Malformed `scopeRender` metadata with `NaN` payloads.
- Desktop quick controls disappearing again when scope mode is turned off.

## Stability Notes

- Tests remain deterministic by using unit-level storage and DOM assertions instead of timing-sensitive live scene setup for scope marker parity.
- Quick-control tests use mocked `SettingsSheet` props and persisted settings reads to verify state propagation without device-dependent behavior.

## Known Gaps

- No additional end-to-end coverage was added because the touched behavior is already exercised deterministically in unit tests and the full Vitest suite passes.
