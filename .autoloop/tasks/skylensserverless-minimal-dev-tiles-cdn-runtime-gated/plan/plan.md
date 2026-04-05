# SkyLensServerless Scope Tiles CDN Runtime Gate Plan

## Scope

Adjust `SkyLensServerless` scope data delivery so the app can prefer a remote CDN/R2 dataset at runtime while keeping a minimal deterministic in-repo development dataset as the offline fallback. Keep the existing manifest/index/tile binary contracts and graceful-degradation behavior.

## Current Baseline

- Client scope loading is hard-wired in [lib/scope/catalog.ts](/workspace/SkyLens/SkyLensServerless/lib/scope/catalog.ts) to `/data/scope/v1/...` and caches manifest, names, indexes, and tiles globally with no source awareness.
- Viewer runtime in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx) already tolerates scope load failures by clearing deep-scope state instead of crashing.
- Public config in [lib/config.ts](/workspace/SkyLens/SkyLensServerless/lib/config.ts) is the existing browser-safe env/config contract surface.
- The committed dataset under [public/data/scope/v1](/workspace/SkyLens/SkyLensServerless/public/data/scope/v1) and tracked export mirror under [out/data/scope/v1](/workspace/SkyLens/SkyLensServerless/out/data/scope/v1) are larger than needed for deterministic dev/test fallback.
- Dev dataset build/verify tests already assert determinism and validity via [tests/unit/scope-data-build.integration.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/scope-data-build.integration.test.ts), [tests/unit/scope-data-dev-fallback.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/scope-data-dev-fallback.test.ts), and [tests/unit/scope-data-verify.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/scope-data-verify.test.ts).

## Implementation Slice

### 1. Public runtime config and compatibility contract

- Extend [lib/config.ts](/workspace/SkyLens/SkyLensServerless/lib/config.ts) and its tests to expose a browser-safe `scopeData` config block with:
  - `remoteEnabled: boolean`
  - `remoteBaseUrl: string | null`
  - `localBasePath: '/data/scope/v1'`
- Gate remote mode so it is active only when the enable flag is true and the base URL is present/valid after trimming.
- Keep default behavior local-only, so local development, CI, and deterministic tests remain offline-safe without env changes.
- Document the new env vars and defaults in the serverless docs/config references that currently describe scope assets as local-only.

### 2. Runtime loader prefers remote but falls back locally

- Refactor [lib/scope/catalog.ts](/workspace/SkyLens/SkyLensServerless/lib/scope/catalog.ts) to resolve scope asset URLs from an ordered source list:
  - remote CDN/R2 first when `scopeData.remoteEnabled` and `scopeData.remoteBaseUrl` are both active
  - local `/data/scope/v1` second as the always-available fallback path
- Keep request granularity local to the existing loader surfaces (`manifest`, `names`, `band index`, `tile rows`) instead of changing manifest/index schemas.
- Make caches source-aware so remote and local responses never share the same manifest/index/tile cache entries or promises.
- Preserve existing graceful degradation in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx): if both remote and local fail, scope deep-star data clears cleanly and the rest of the viewer continues to run.
- Prefer small local edits over a new abstraction layer: add only the minimal source-order helper(s) needed to keep the loader traceable and testable.

### 3. Minimal committed dev dataset

- Replace the current all-`stars_200` dev fallback build in [scripts/scope/build-core.mjs](/workspace/SkyLens/SkyLensServerless/scripts/scope/build-core.mjs) with a fixed committed allowlist of **12 named `stars_200` seed ids** chosen to:
  - cover all four RA quadrants
  - include both northern and southern declinations
  - preserve at least one named deep-star path near the default `tokyo-iss` demo sky for deterministic manual verification
- Keep the allowlist definition local to the existing scope build code or constants, not in a new generic data-loading layer.
- Keep the exact runtime artifact schema unchanged:
  - `manifest.json`
  - `names.json`
  - per-band `index.json`
  - fixed-width `.bin` tiles
- Use the existing six synthetic rows per seed recipe unchanged, which makes the committed manifest totals explicit and testable:
  - `mag6p5.totalRows = 12`
  - `mag8p0.totalRows = 24`
  - `mag9p5.totalRows = 48`
  - `mag10p5.totalRows = 72`
- Preserve the existing ADR safety invariants on top of those exact totals:
  - at least one named deep row when source names exist
  - deterministic offline build from committed inputs
  - zero PM and zero `bMinusV` in dev fallback rows
- Add a slim-dataset regression assertion in the build/verify test suite that checks:
  - the fixed seed-count contract
  - the exact per-band `totalRows` values above
  - a fixed upper bound on emitted `.bin` tile files, captured from the chosen 12-seed layout, so git footprint cannot silently regrow
- Regenerate the tracked export mirror under [out/data/scope/v1](/workspace/SkyLens/SkyLensServerless/out/data/scope/v1) in the same change as [public/data/scope/v1](/workspace/SkyLens/SkyLensServerless/public/data/scope/v1); the repo currently tracks both roots and the plan does not allow them to drift.

## Interfaces

- `getPublicConfig()` remains the public browser config entry point; its schema expands but existing fields stay unchanged.
- Scope dataset relative paths remain versioned under `/scope/v1/...`; remote hosting must mirror the same relative manifest/index/names/tile layout so the runtime contract does not branch by environment.
- The local fallback root remains `/data/scope/v1`, preserving current static export hosting and offline behavior.

## Validation

- Update/add unit coverage in [tests/unit/config-contract.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/config-contract.test.ts) for remote env parsing, defaults, and invalid/blank handling.
- Update/add loader tests in [tests/unit/scope-runtime.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/scope-runtime.test.ts) to cover:
  - remote-enabled success path
  - remote-disabled local path
  - remote failure followed by local fallback
- Update/add viewer/runtime regression coverage in [tests/unit/viewer-shell-scope-runtime.test.tsx](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx) only where needed to prove the client path still ignores stale responses and survives fallback/failure.
- Tighten dataset tests so the committed dev dataset remains deterministic, valid, and measurably slim after regeneration, including the explicit 12-seed and `12/24/48/72` manifest-total contract plus the captured tile-file cap.

## Compatibility, Rollout, Rollback

- Compatibility: no manifest/index/tile schema change; no new server API; no viewer setting migration.
- Rollout: remote behavior is dark by default and activates only through explicit public env/config.
- Rollback: disable the remote flag to force local-only behavior; if needed, restore the previous committed fallback dataset/export mirror together without changing runtime interfaces.

## Risk Register

- Cache contamination across remote/local sources could return mismatched manifests, indexes, or tiles. Control: scope cache keys by source root and reset test helpers accordingly.
- Shrinking the committed dataset too aggressively could break deterministic tests or manual local verification. Control: use the fixed 12-seed spread requirement, preserve one demo-sky named path, and assert the exact per-band totals plus a tile-count cap in tests.
- Remote partial failures could cause blank deep-scope content if fallback is not attempted at the same loader layer that failed. Control: apply ordered source fallback independently for manifest, names, index, and tile fetches.
- Tracked export artifacts could drift from `public/` assets. Control: refresh both committed roots together in the same implementation slice.
