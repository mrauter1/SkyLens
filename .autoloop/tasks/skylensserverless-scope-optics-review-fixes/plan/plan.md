# Scope Optics Review Fixes Plan

## Applicability
- Apply: harden `lib/viewer/scope-optics.ts` by normalizing optics inside exported helpers so direct callers cannot feed invalid values into `Math.log10`.
- Apply: centralize scope optics slider ranges in `lib/viewer/settings.ts` and reuse them in normalization plus both settings/quick-control UI.
- Apply: extract the inline scope star marker JSX in `components/viewer/viewer-shell.tsx` into a focused local component/helper with parity-preserving output.
- Apply: replace inline scope optics object shapes with shared `ScopeOpticsSettings` where viewer shell helpers accept scope optics.
- Apply: add aperture and magnification quick controls to the desktop/non-mobile quick-controls surface when scope mode is enabled, matching the existing mobile quick-actions semantics.
- Reject unless implementation uncovers a broader untyped boundary: introducing a Zod schema for `scopeRender` in `viewer-shell.tsx`. Current metadata is produced in-process by the star pipeline, and `getScopeRenderMetadata` already rejects malformed/non-finite values at the render boundary. A schema parse in the hot render path would add indirection without changing persistence or network compatibility.

## Milestones
### Milestone 1: Shared optics hardening and viewer-shell refactor
- Export `SCOPE_OPTICS_RANGES` from `lib/viewer/settings.ts` near `DEFAULT_SCOPE_OPTICS_SETTINGS` for `apertureMm`, `magnificationX`, and `transparencyPct`.
- Route `normalizeScopeOpticsSettings` through the shared range constants so persisted settings and runtime normalization stay aligned.
- Normalize scope optics at the top of `computeLimitingMagnitude`, `computeStarPhotometry`, and any public optics helper that relies on aperture/magnification/transparency math.
- Keep star-pipeline behavior unchanged: `lib/astronomy/stars.ts` may continue passing already-normalized optics; redundant normalization is acceptable because it hardens the exported optics API without altering valid inputs.
- Extract the large scope star marker JSX in `components/viewer/viewer-shell.tsx` into a dedicated local component/helper and keep rendered DOM/styling parity for focused and unfocused scope markers.
- Replace inline scope optics parameter types in viewer-shell helpers such as `buildSceneSnapshot` with `ScopeOpticsSettings`.
- Add a shared scope quick-controls renderer/component used by the existing mobile strip and the desktop primary action row so aperture and magnification are available in both quick-controls contexts when scope mode is on.

### Milestone 2: Validation and regression coverage
- Extend `tests/unit/scope-optics.test.ts` to cover invalid/partial/non-finite optics inputs and prove exported helpers clamp to safe defaults instead of returning `NaN`.
- Extend `tests/unit/viewer-settings.test.tsx` and, if needed, `tests/unit/settings-sheet.test.tsx` to cover shared range reuse through normalization and settings UI values.
- Extend `tests/unit/viewer-shell.test.ts` to cover desktop primary-action-row and mobile-strip availability of aperture/magnification quick controls, persistence/synchronization with settings state, and scope marker refactor parity for valid plus malformed `scopeRender` metadata.
- Run targeted tests first with `pnpm test -- tests/unit/scope-optics.test.ts tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts`.
- Run the broader regression suite with `pnpm test`.

## Interfaces / Touch Points
- `lib/viewer/settings.ts`
  Exports: `ScopeOpticsSettings`, `DEFAULT_SCOPE_OPTICS_SETTINGS`, new `SCOPE_OPTICS_RANGES`, `normalizeScopeOpticsSettings`.
- `lib/viewer/scope-optics.ts`
  Contract: exported optics helpers must be safe for direct callers, even when callers skip settings-domain normalization.
- `components/viewer/viewer-shell.tsx`
  UI contract: quick-controls context exposes scope mode toggle on mobile and desktop; aperture/magnification live in the mobile quick-action strip and desktop primary action row when scope mode is enabled; transparency and marker scale remain in `SettingsSheet`.
- `components/settings/settings-sheet.tsx`
  UI contract: retains scope mode, transparency, and marker scale controls only; it should consume shared range constants instead of duplicating optics literals.

## Compatibility / Invariants
- Persisted viewer settings remain backward compatible; old payloads still normalize through `readViewerSettings`.
- Scope optics remains an additional filtering/render stage and does not change non-scope marker behavior.
- Marker scale stays in Settings, not in quick controls.
- Transparency stays in Settings, not in quick controls.
- Visible scope-star output should remain visually equivalent after JSX extraction for the same `scopeRender` metadata and focus state.

## Regression Risks
- Double normalization could drift if range literals remain duplicated anywhere; all optics min/max values must come from the shared constants.
- Desktop quick-controls work must extend the desktop primary action row without regressing its existing actions or the mobile strip behavior already covered by `viewer-shell` tests.
- JSX extraction must not change button semantics, focus behavior, `data-testid` hooks, or marker sizing math.
- Rejecting Zod for `scopeRender` must still leave a clear malformed-metadata guard in place and covered by tests.

## Risk Register
- Risk: shared range constants are added but one UI path keeps hard-coded numbers.
  Mitigation: grep for optics slider literals during implementation and add assertions against rendered slider bounds where practical.
- Risk: desktop quick controls are added in the wrong surface and violate agreed placement semantics.
  Mitigation: add them to the existing desktop primary action row as the desktop quick-controls surface, while leaving the overlay and `SettingsSheet` responsibilities unchanged.
- Risk: scope marker extraction accidentally changes visual emphasis or fallback rendering.
  Mitigation: preserve the current computed styles, add parity-oriented viewer-shell tests, and keep malformed `scopeRender` falling back to the standard marker.
- Risk: broader `pnpm test` failures hide whether touched behavior regressed.
  Mitigation: run targeted optics/viewer tests first, then the full suite, and separate pre-existing failures from new regressions in the implementation/test artifacts.
