# SkyLensServerless Scope Implementation Plan

## Scope
Implement the full scope-mode PRD/ARD in `SkyLensServerless/SkyLensServerless_PRD_and_ARD_v1_2.md`, plus the dataset build/download/verify pipeline described in `SkyLensServerless/SkyLensServerless_Scope_Dataset_PRD_and_ADR_v1_2_final.md`, while keeping `/view` as the only route, preserving static export hosting, and avoiding regressions in the current wide-view interaction model.

## Compatibility and invariants
- Preserve the existing wide-view projection, selection, labels, constellations, demo mode, fallback modes, and accessibility behavior outside the lens.
- Show scope controls only when the viewer is active and not in a blocked startup state; unsupported/blocked states must not render a dead scope toggle.
- Keep viewer settings backward-compatible: missing persisted scope fields must normalize to `enabled=false` and `verticalFovDeg=10`.
- Keep the runtime contract static-file only under `public/data/scope/v1/`; raw source files remain outside `public/`.
- Keep deep scope stars non-clickable and outside the existing button-marker flow.
- Hide the scope lens during explicit mobile alignment focus.
- Treat the provided R2 `names.json` as a production-only optional names-table input, not as a new row-matching precedence layer; `scope:data:build:dev` and offline `scope:data:verify` must remain deterministic and repo-local.
- Do not introduce hardware zoom, WebGL, WebGPU, or a second astronomy library.

## Milestones

### 1. Projection profile foundation
Touch points:
- `lib/projection/camera.ts`
- projection-related unit tests

Plan:
- Introduce a profile-based projection API that supports independent base and scope vertical FOVs.
- Preserve existing wide-view callers through compatibility wrappers so current marker placement and center-lock behavior remain unchanged while scope-specific code adopts the new profile path.
- Add explicit tests for horizontal/vertical FOV calculations and profile-driven projection parity with current wide behavior.

### 2. Scope settings and synchronized controls
Touch points:
- `lib/viewer/settings.ts`
- `components/settings/settings-sheet.tsx`
- `components/viewer/viewer-shell.tsx`
- viewer settings/unit integration tests

Plan:
- Extend `ViewerSettings` with a normalized `scope` object.
- Add settings-sheet controls for scope enabled and scope FOV only; keep business logic in `ViewerShell`.
- Add synchronized mobile quick action and desktop action entry points that toggle the same state as the settings sheet.
- Gate all scope entry points on viewer-active/non-blocked availability so blocked startup, secure-context unsupported, and pre-activation states render no scope toggle at all.
- Extend persistence and UI tests to cover backward compatibility, defaults, range clamping, and cross-surface synchronization.

### 3. Lens shell and bright-object scope pass
Touch points:
- `components/viewer/viewer-shell.tsx`
- new `components/viewer/scope-lens-overlay.tsx` or equivalent local component
- optional shared view helpers/CSS updates

Plan:
- Add fixed centered lens geometry, chrome, vignette, and clipped occlusion/interceptor layers.
- Reuse the existing camera/background stage inside the lens with scope-specific visual magnification derived from base-vs-scope FOV.
- Add a second projection pass for Sun, Moon, planets, and existing bright/named stars using the scope profile only.
- Block click-through inside the lens, keep descendants unfocusable, and suppress the lens during explicit alignment focus.
- Switch scope-on center-lock precedence to explicit selection -> scope bright object -> named deep scope star -> none.

### 4. Dataset pipeline and runtime catalog contracts
Touch points:
- new `lib/scope/*` modules for manifest, names, decode, band selection, and cache
- `scripts/download-scope-source.mjs`
- `scripts/build-scope-dataset.mjs`
- `scripts/verify-scope-dataset.mjs`
- `package.json`
- `.gitignore`
- `public/data/scope/v1/*`
- dataset unit tests

Plan:
- Implement the manifest, names-table, and 20-byte tile row contracts exactly as specified.
- Add downloader/build/verify npm scripts and keep production raw source in `.cache/scope-source/`.
- Generate and commit the deterministic development dataset under `public/data/scope/v1/`.
- Treat the user-provided R2 `names.json` as a production-only optional names-table input for the scope name-data path, not as a new augmentation-precedence layer: local builds still follow manual override -> built-in bright-star join -> unnamed, emitted repo-local `public/data/scope/v1/names.json` still contains emitted rows only, and `scope:data:build:dev` plus offline `scope:data:verify` ignore the remote input.
- Add offline unit coverage for manifest parsing, names-table parsing, decode, tile selection, dev dataset generation, and verify failures.

### 5. Dense scope canvas and deep-star runtime
Touch points:
- `components/viewer/viewer-shell.tsx`
- new `components/viewer/scope-star-canvas.tsx`
- new `lib/scope/depth.ts`, `lib/scope/catalog.ts`, `lib/scope/coordinates.ts`, or equivalent focused modules
- scope runtime/unit tests

Plan:
- Lazy-load the manifest on first scope enable, cache manifest and decoded tiles for the session, and ignore stale responses when scope state or pointing changes.
- Implement band selection from scope FOV and alignment-health rules exactly as specified.
- Render deep stars via Canvas 2D only from currently loaded tiles, with proper-motion adjustment, daylight gating, and frustum culling.
- Resolve `nameId` to `displayName` for named deep stars only, then feed named deep candidates into scope center-lock/detail precedence without making them clickable.

### 6. Validation and hardening
Touch points:
- `tests/unit/*`
- `tests/e2e/*`
- build/test scripts as needed

Plan:
- Extend viewer, settings, and celestial tests for scope persistence, scope behavior in demo/manual/non-camera modes, scope precedence, and lens suppression during alignment focus.
- Add scope-specific unit suites described by the ADR.
- Add/extend Playwright coverage for enabling scope, persistence across reload, fallback-mode behavior, and click shielding inside the lens.
- Run the relevant build/test commands and verify static export compatibility before handoff.

## Planned interfaces and ownership
- `lib/projection/camera.ts`
  - Add `ProjectionProfile` and profile-based projection helpers.
  - Keep existing wide-view wrapper signatures stable for the rest of the app.
- `lib/viewer/settings.ts`
  - Extend persisted settings schema with `scope.enabled` and `scope.verticalFovDeg`.
  - Keep normalization centralized here.
- `lib/scope/catalog.ts`
  - Own manifest loading, names loading, tile URL resolution, session cache, and stale-response protection.
- `lib/scope/depth.ts`
  - Own band selection and daylight/deep-star eligibility rules.
- `lib/scope/coordinates.ts`
  - Own tile-star J2000 -> horizontal conversion and proper-motion adjustment using `astronomy-engine`.
- `components/viewer/scope-lens-overlay.tsx`
  - Own fixed lens geometry, visual layers, clipping, and click shielding.
- `components/viewer/scope-star-canvas.tsx`
  - Own Canvas 2D drawing for deep stars only.
- `components/viewer/viewer-shell.tsx`
  - Remain the orchestration point for settings, quick actions, scope-derived state, center-lock precedence, and detail/readout integration.

## Regression controls
- Preserve the current wide marker DOM/buttons outside the lens; scope-only display content must not replace or mutate that path.
- Keep blocked/inactive viewer states free of scope controls; availability gating applies to settings, mobile quick actions, and desktop actions, not just the lens renderer.
- Keep deep stars out of `renderedMarkerObjects`, `selectedObjectId`, and direct pointer handlers.
- Preserve existing `getDetailRows` behavior for wide objects and extend it with a scope-only deep-star readout path rather than retrofitting deep stars into wide selection semantics.
- Guard all scope rendering behind viewer-active, non-blocked states and suppress it during explicit mobile alignment focus.
- Keep loader failures non-fatal: if manifest or tiles fail, the app must still render the magnified background and scope bright objects.
- Keep remote-name input out of the deterministic local contracts: dev dataset generation, offline verify, and emitted-name orphan checks must succeed without network and without depending on the R2 source.

## Validation plan
- `npm run lint`
- `npm run test`
- targeted new Vitest suites for projection, scope catalog/decode, depth policy, dev dataset generation, and lens overlay behavior
- `npm run scope:data:build:dev`
- `npm run scope:data:verify`
- `npm run build`
- targeted Playwright coverage for scope mode in demo and fallback flows, including no-toggle behavior during blocked startup states

## Rollback approach
- Keep the wide-view projection wrappers intact until scope-specific consumers are proven.
- Land the dataset pipeline and committed dev dataset before depending on dense deep-star runtime behavior.
- If dense-tile loading regresses rendering, fall back to bright-object-only lens behavior while keeping the scope settings/data contracts intact.

## Risk register
- Large `ViewerShell` integration surface: mitigate by extracting scope-specific loader/render helpers instead of expanding ad hoc inline state.
- Projection regressions in wide mode: mitigate with wrapper preservation and profile parity tests before lens integration.
- Dataset/schema drift between scripts and runtime: mitigate by centralizing manifest/row-format constants and verifying shipped artifacts offline.
- Performance churn from tile loads and canvas redraws: mitigate with session caches, tile-set diffing, stale-response ignoring, and rendering only loaded visible tiles.
- Deep-star naming drift: mitigate by treating emitted `names.json` as the only runtime name source, verifying no orphan/unresolved ids, and keeping the user-provided R2 names input behind the build-time contract.
