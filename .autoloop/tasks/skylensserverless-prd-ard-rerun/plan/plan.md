# SkyLensServerless Scope Realism Plan

## Outcome
Implement the scope-realism slice only in `SkyLensServerless/` by adding optics-aware persisted settings, shared optics/range helpers, a scope-only star filtering/render-metadata path, and desktop/mobile quick-control parity for scope toggle plus aperture/magnification while keeping `markerScale` in Settings only.

## Milestones
1. Settings and shared optics contract
   - Add canonical persisted `scopeModeEnabled: boolean` as the runtime source of truth for the existing scope-mode toggle.
   - Add persisted `scopeOptics: { apertureMm, magnificationX, transparencyPct }`.
   - Introduce `lib/viewer/scope-optics.ts` for shared `SCOPE_OPTICS_RANGES`, numeric sanitization, limiting-magnitude math, and photometric/render helper exports.
   - Update `lib/viewer/settings.ts` to normalize malformed values without producing `NaN`/`Infinity`, reuse shared range constants, prefer top-level `scopeModeEnabled` when present, and fall back to legacy `scope.enabled` only when reading older payloads.
2. Star pipeline and renderer integration
   - Extend `lib/astronomy/stars.ts` so existing gates stay first, then scope optics filtering runs only when `scopeModeEnabled` is true.
   - Attach scope render metadata only for scope-mode stars that survive the limiting-magnitude filter.
   - Keep the current non-scope star behavior unchanged.
   - Update `components/viewer/viewer-shell.tsx` to consume scope render metadata from existing `SkyObject.metadata` with defensive fallback to existing marker sizing/rendering when metadata is missing or malformed.
3. Control-surface updates
   - Update desktop quick controls in `viewer-shell.tsx` to keep the scope toggle, expose aperture/magnification controls when scope mode is on, and source those controls from shared optics ranges.
   - Update mobile quick controls in `viewer-shell.tsx` to match desktop scope controls and remove `markerScale` from mobile quick actions.
   - Update `components/settings/settings-sheet.tsx` so Settings owns transparency and marker scale, and scope toggle mirroring remains optional without becoming the canonical editing surface.
   - Preserve existing scope vertical-FOV controls and current behavior unchanged in this task; if implementation uncovers a genuine conflict, stop and ask for explicit confirmation instead of changing that behavior by plan assumption.
4. Validation
   - Extend the existing `viewer-settings`, `settings-sheet`, `viewer-shell`, and scope runtime/celestial unit suites for normalization robustness, shared range reuse, desktop/mobile scope-control parity, marker-scale placement, and scope photometric fallback behavior instead of creating parallel one-off harnesses.

## Interfaces
### `lib/viewer/scope-optics.ts`
- Export `SCOPE_OPTICS_RANGES` with min/max/step entries for `apertureMm`, `magnificationX`, and `transparencyPct`.
- Export normalization helpers that accept `unknown` or nullable numeric input and always return finite clamped numbers.
- Export a limiting-magnitude helper implementing:
  - `base = 2.2 + 2.0*log10(A) + 0.30*log10(M)`
  - `transparencyAdj = 1.3*(T - 0.7)`
  - `z = clamp(90-h, 0, 80)`
  - `airmass = 1/cos(z)`
  - `altPenalty = 0.22*(airmass - 1)`
  - `effectiveLimit = clamp(base + transparencyAdj - altPenalty, 3.0, 15.5)`
- Export photometric/render helpers that compute relative flux, bounded transmission/gain, and compact bounded pixel sizes for star core/halo display.

### `lib/viewer/settings.ts`
- Extend `ViewerSettings` with `scopeModeEnabled` and `scopeOptics`.
- Keep legacy `scope.verticalFovDeg` support intact for current lens/deep-star behavior.
- Normalize old persisted payloads by preferring `scopeModeEnabled` when present and otherwise falling back to legacy `scope.enabled`.
- Write canonical persisted output with `scopeModeEnabled` plus `scopeOptics`; do not depend on writing legacy `scope.enabled` back out.
- Reuse `SCOPE_OPTICS_RANGES` instead of duplicating slider bounds in normalization logic.

### `lib/astronomy/stars.ts`
- Extend the star pipeline input with scope-mode and optics context derived from `ViewerSettings`.
- Keep current `enabledLayers`, daylight, and altitude-above-horizon gates unchanged.
- Add scope-only filtering after those gates and attach metadata such as effective limit, relative brightness, and bounded render sizes only when scope mode is enabled.

### UI ownership
- `viewer-shell.tsx` owns quick-action layout, scope toggle state wiring, and any temporary bridging from legacy `scope.enabled` reads to canonical `scopeModeEnabled`.
- `settings-sheet.tsx` remains presentation/delegation only; it should not own optics math.
- Add explicit `SettingsSheet` props for `scopeModeEnabled`, `transparencyPct`, `markerScale`, `onScopeModeEnabledChange`, `onTransparencyChange`, and `onMarkerScaleChange` so Settings placement stays declarative and implementation does not invent alternate ownership.
- Keep scope render metadata on `SkyObject.metadata` unless implementation proves a shared contract change is necessary; avoid widening `lib/viewer/contracts.ts` just for this slice.
- Shared slider labels/ranges should come from one source so desktop and mobile cannot drift.

## Compatibility And Regression Controls
- Persisted settings compatibility: older payloads with only `scope.enabled` and no optics object must still read successfully.
- Behavioral invariants:
  - Existing likely-visible logic remains unchanged.
  - Existing scope vertical-FOV control and behavior remain unchanged in this task.
  - The scope toggle used by quick actions and any mirrored Settings control resolves to canonical `scopeModeEnabled` after normalization.
  - Non-scope star rendering remains unchanged.
  - Scope render metadata is absent when scope mode is off.
  - Malformed optics values never escape helpers as `NaN` or `Infinity`.
  - `markerScale` is adjustable in Settings only, not in mobile quick actions.
- Avoid scope creep into the repo-root app or unrelated scope catalog behavior.

## Risk Register
- Settings migration risk: dual support for `scope.enabled` and `scopeModeEnabled` can drift.
  Mitigation: normalize through one read path, make `scopeModeEnabled` the only runtime boolean source after normalization, and test both legacy and new payloads.
- UI parity risk: desktop and mobile quick controls can diverge.
  Mitigation: drive both from shared ranges/labels and assert parity in tests.
- Rendering regression risk: malformed optics metadata could break marker sizing.
  Mitigation: keep viewer-shell fallback on existing marker sizing path and test bad metadata explicitly.
- Contract-sprawl risk: adding a dedicated star-render type in shared viewer contracts could broaden the change surface unnecessarily.
  Mitigation: keep scope render data inside `SkyObject.metadata` with local type guards in the viewer unless a later implementation blocker proves otherwise.
- Product-behavior risk: moving the wrong control could violate acceptance criteria.
  Mitigation: remove `markerScale` only from quick actions, keep it in Settings, and keep existing scope vertical-FOV behavior unchanged unless a later explicitly confirmed request changes that contract.

## Validation And Rollback
- Run SkyLensServerless unit coverage for:
  - settings normalization and storage migration
  - scope optics helper finiteness/clamping
  - settings-sheet control placement
  - viewer-shell desktop/mobile parity and marker-scale placement
  - stars/renderer photometric behavior and malformed-metadata fallback
- Rollback path:
  - revert new scope optics metadata consumption in `viewer-shell.tsx`
  - keep legacy non-scope star sizing path authoritative
  - retain backward-compatible settings reads so persisted payloads remain recoverable
