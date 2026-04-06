# Scope Realism v2 Plan

## Scope
- Implement `AUTOLOOP_TASK_SCOPE_REALISM_V2.md` in `/workspace/SkyLens/SkyLensServerless` exactly as the active PRD/ARD for runtime scope optics, deep-star rendering, and control-state semantics.
- In scope: `lib/viewer/scope-optics.ts`, `lib/viewer/settings.ts`, `lib/scope/depth.ts`, `components/viewer/viewer-shell.tsx`, `components/viewer/scope-star-canvas.tsx`, `components/settings/settings-sheet.tsx`, and the existing unit/runtime test suites covering scope optics, viewer settings, scope runtime, and scope UI state.
- Out of scope: server/runtime API changes, new skyglow or moonlight models, eyepiece catalog simulation, unrelated viewer refactors, or broad redesign of the existing scope overlay.

## Current Baseline
- `lib/viewer/scope-optics.ts` already owns deterministic optics normalization, limiting magnitude, and compact render-profile helpers, but it does not yet expose magnification-to-FOV conversion or the inverse migration path needed to make `magnificationX` canonical.
- `components/viewer/viewer-shell.tsx` still builds the scope projection profile, tile-selection radius, scope band choice, marker sizing, and status text from persisted `scope.verticalFovDeg`; deep stars are projected directly from loaded tiles without an optics limiting-magnitude gate and without profile-driven canvas payloads.
- `components/viewer/scope-star-canvas.tsx` renders deep stars from static magnitude buckets (`vMag` only), so deep-star intensity/core/halo do not currently react to aperture, magnification, transparency, or altitude.
- `lib/viewer/settings.ts` persists both `scopeModeEnabled` and `scope.verticalFovDeg` plus canonical `scopeOptics`, and it reads legacy `scope.enabled`, but it does not yet derive magnification from legacy stored scope FOV when `scopeOptics.magnificationX` is absent.
- `components/settings/settings-sheet.tsx` still exposes a user-facing `Scope field of view` slider even though the PRD locks `magnificationX` as the zoom source of truth; quick controls already expose aperture and magnification when scope mode is on.

## Delivery Strategy
1. Make magnification the canonical scope zoom input in shared optics/settings helpers first, including deterministic FOV conversion, compatibility migration from legacy stored FOV, and removal of the user-facing settings-sheet FOV control.
2. Thread the derived effective scope FOV through all scope runtime consumers so projection, tile selection, depth-band selection, marker sizing, and scope status all use the same optics-derived value.
3. Apply optics gating and optics photometry to the deep-star path, then extend tests around monotonic behavior, unchanged daylight suppression, UI state sync, and legacy settings compatibility.

## Milestones

### M1. Canonical scope optics state and compatibility
- Add `magnificationToScopeVerticalFovDeg(magnificationX, apparentFieldDeg?)` to `lib/viewer/scope-optics.ts` with deterministic defaults, clamping, and finite-output guarantees aligned with existing optics normalization.
- Add the inverse conversion helper if needed for migration so legacy `scope.verticalFovDeg` payloads can seed `scopeOptics.magnificationX` safely when magnification is absent.
- Keep `scopeOptics` as the canonical persisted optics state; treat `scope.verticalFovDeg` as a derived compatibility field rather than the zoom source of truth.
- Preserve the existing storage key and read path, preferring persisted `scopeOptics.magnificationX` when present and only consulting legacy stored FOV for migration/defaulting.
- Remove the settings-sheet scope FOV slider from the planned user-facing controls while keeping scope toggle behavior, transparency, and marker-scale placement aligned with the PRD.

### M2. Runtime scope FOV unification
- In `components/viewer/viewer-shell.tsx`, compute one effective scope vertical FOV from `viewerSettings.scopeOptics.magnificationX` and reuse it for:
  - `createProjectionProfile(...)`
  - scope lens visual scaling / status text
  - `selectScopeBand(...)`
  - `getScopeTileSelectionRadiusDeg(...)`
  - scope marker sizing paths that currently receive `viewerSettings.scope.verticalFovDeg`
- In `lib/scope/depth.ts`, keep the current band thresholds/alignment guardrails but ensure inputs come from the same magnification-derived effective FOV rather than persisted legacy FOV state.
- Do not change the existing likely-visible/daylight suppression order or thresholds while rewiring FOV sources.

### M3. Deep-star optics gating and profile-driven rendering
- In the deep-star mapping path inside `components/viewer/viewer-shell.tsx`, preserve existing upstream gates, then for each tile row:
  - convert to horizontal coordinates
  - reject below-horizon stars
  - when scope mode is enabled, apply `passesScopeLimitingMagnitude(...)`
  - compute `computeScopeRenderProfile(...)` for passing stars
  - pass the resulting `intensity`, `corePx`, and `haloPx` into the scope canvas point payload
- Update `ScopeStarCanvasPoint` and `components/viewer/scope-star-canvas.tsx` to render from profile-driven intensity/core/halo data instead of static magnitude buckets, while preserving current compact-star intent and existing `bMinusV` color mapping.
- Keep bright-star scope metadata semantics compatible with deep-star render metadata (`scopeRender`) so marker sizing/opacity logic remains coherent across both pipelines.

## Interfaces And Contracts
- `lib/viewer/scope-optics.ts`
  - add deterministic magnification-to-FOV helper
  - add inverse helper only if needed for settings migration
  - keep shared clamp/range handling in one place; do not duplicate normalization in the viewer
- `lib/viewer/settings.ts`
  - continue exposing `scopeModeEnabled`, `scope`, and `scopeOptics`
  - normalize persisted legacy `scope.verticalFovDeg` into canonical `scopeOptics.magnificationX` when magnification is missing
  - keep writing a normalized/derived `scope.verticalFovDeg` for backward compatibility until all callers no longer need the field
- `components/settings/settings-sheet.tsx`
  - keep scope mode toggle
  - keep transparency and marker-scale controls in settings
  - remove the user-facing scope FOV slider from the planned interface
- `components/viewer/scope-star-canvas.tsx`
  - extend `ScopeStarCanvasPoint` to include `intensity`, `corePx`, and `haloPx`
  - deep-star rendering must consume those values directly
- Expected tests to update:
  - `tests/unit/scope-optics.test.ts`
  - `tests/unit/scope-runtime.test.ts`
  - `tests/unit/viewer-shell-scope-runtime.test.tsx`
  - `tests/unit/viewer-settings.test.tsx`
  - `tests/unit/viewer-shell.test.ts`
  - `tests/unit/settings-sheet.test.tsx`

## Compatibility Notes
- No server, API, route, or dataset format changes are planned.
- Persisted settings remain on the current storage key and must continue loading older payloads that only contain `scope.enabled` and/or `scope.verticalFovDeg`.
- If both canonical `scopeOptics.magnificationX` and legacy `scope.verticalFovDeg` are present, canonical magnification wins; legacy FOV exists only as compatibility input/output.
- The apparent-field default used for magnification-to-FOV conversion must be deterministic and shared by forward and inverse conversion so migration does not drift across reloads.
- Existing likely-visible/daylight suppression remains unchanged and must still run before scope optics filtering for deep stars.

## Validation Plan
- Add monotonic unit coverage for magnification-to-FOV conversion and retain malformed-input finite-output assertions in `tests/unit/scope-optics.test.ts`.
- Extend `tests/unit/scope-runtime.test.ts` so scope depth/band selection remains deterministic when fed magnification-derived FOV values.
- Extend `tests/unit/viewer-shell-scope-runtime.test.tsx` for:
  - deep-star limiting-magnitude filtering
  - deep-star intensity/core/halo response to optics changes
  - magnification-driven spacing/projection behavior
  - unchanged canvas-only center-lock behavior for named deep stars
- Extend `tests/unit/viewer-settings.test.tsx`, `tests/unit/viewer-shell.test.ts`, and `tests/unit/settings-sheet.test.tsx` for:
  - legacy FOV-only payload migration
  - canonical magnification precedence
  - quick controls plus settings sync after removing the settings FOV slider
  - unchanged transparency/marker-scale ownership and scope toggle sync
- Verification commands:
  - `npm test -- tests/unit/scope-optics.test.ts tests/unit/scope-runtime.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/settings-sheet.test.tsx`
  - `npm test`

## Regression Prevention
- Keep all optics math in `lib/viewer/scope-optics.ts`; do not duplicate magnification-to-FOV logic inside viewer components.
- Preserve the current likely-visible/daylight gating order and thresholds exactly; scope optics are an additional post-gate filter, not a replacement policy.
- Keep star sizing compact by using clamped profile-driven core/halo values; do not introduce linear diameter scaling with magnification.
- Prefer small, local updates to existing viewer-shell wiring rather than a new scope runtime abstraction layer.
- Preserve persistence compatibility by reading legacy FOV, writing normalized state, and avoiding a storage-key change.

## Risk Register
- R1: Replacing stored-FOV semantics with magnification-derived FOV could break previous installs if legacy payloads are not migrated consistently.
  - Control: use one shared forward/inverse conversion pair and test canonical-over-legacy precedence plus FOV-only legacy payloads.
- R2: Rewiring deep-star selection and projection could accidentally change daylight or likely-visible suppression ordering.
  - Control: keep existing daylight gates untouched and add regression tests that assert the same suppression behavior remains.
- R3: Profile-driven canvas rendering could make stars unrealistically large under high magnification.
  - Control: keep compact clamped `corePx`/`haloPx` ranges and explicitly test that spacing changes without 1:1 diameter blow-up.
- R4: Removing the settings-sheet FOV slider could desynchronize quick controls, settings state, or persistence if the canonical state handoff is incomplete.
  - Control: keep scope toggle/transparency/marker-scale ownership explicit and extend UI-state integration tests around desktop/mobile parity.

## Rollout And Rollback
- Rollout: land the optics helper changes, settings migration, viewer-shell FOV rewiring, deep-star render contract update, and test coverage together so runtime behavior, persistence, and UI controls remain coherent in one slice.
- Rollback: revert the canonical magnification/FOV migration separately from deep-star photometry if needed, but preserve the prior settings storage key and current daylight policy throughout.
