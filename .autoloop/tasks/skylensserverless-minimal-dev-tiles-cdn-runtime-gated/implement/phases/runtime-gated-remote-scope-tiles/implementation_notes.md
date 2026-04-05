# Implementation Notes

- Task ID: skylensserverless-minimal-dev-tiles-cdn-runtime-gated
- Pair: implement
- Phase ID: runtime-gated-remote-scope-tiles
- Phase Directory Key: runtime-gated-remote-scope-tiles
- Phase Title: Runtime-Gated Remote Scope Tiles With Minimal Local Fallback
- Scope: phase-local producer artifact

## Files changed

- `SkyLensServerless/lib/config.ts`
- `SkyLensServerless/lib/scope/catalog.ts`
- `SkyLensServerless/scripts/scope/build-core.mjs`
- `SkyLensServerless/scripts/scope/constants.mjs`
- `SkyLensServerless/scripts/scope/shared.mjs`
- `SkyLensServerless/tests/unit/config-contract.test.ts`
- `SkyLensServerless/tests/unit/scope-runtime.test.ts`
- `SkyLensServerless/tests/unit/scope-data-dev-fallback.test.ts`
- `SkyLensServerless/tests/unit/scope-data-build.integration.test.ts`
- `SkyLensServerless/PARITY.md`
- `SkyLensServerless/public/data/scope/v1/**`
- `SkyLensServerless/out/data/scope/v1/**`

## Symbols touched

- `getPublicConfig`
- `LOCAL_SCOPE_DATA_BASE_PATH`
- `resolveScopeCatalogSources`
- `loadScopeManifest`
- `loadScopeNamesTable`
- `loadScopeBandIndex`
- `loadScopeTileRows`
- `buildDevSyntheticStars`
- `buildScopeDataset`
- `DEV_FALLBACK_SEED_IDS`
- `DEV_FALLBACK_SEED_COUNT`
- `DEV_FALLBACK_TILE_FILE_CAP`
- `OUT_SCOPE_ROOT`

## Checklist mapping

- Plan 1 public runtime config: completed via `lib/config.ts` and `tests/unit/config-contract.test.ts`
- Plan 2 remote-first runtime loader: completed via `lib/scope/catalog.ts` and `tests/unit/scope-runtime.test.ts`
- Plan 3 minimal committed dev dataset: completed via scope build constants/builder changes and regenerated `public/` + `out/` assets
- Validation updates: completed via config/runtime/dev-fallback/build integration coverage and focused Vitest run

## Assumptions

- Remote scope hosting mirrors the existing `/scope/v1/...` relative layout exactly, so fallback can stay path-relative without schema branching.
- Public runtime env for remote scope delivery should require an absolute base URL and should stay inactive when the URL is blank or invalid.

## Preserved invariants

- Local `/data/scope/v1` remains the default and fallback path.
- Scope manifest, names, index, and binary tile schemas are unchanged.
- Dev fallback rows remain deterministic, six synthetic rows per seed, with zero proper motion and zero `bMinusV`.
- Viewer graceful degradation stays unchanged: failed deep-scope loads collapse to empty scope data instead of crashing the shell.

## Intended behavior changes

- Remote scope mode is now dark by default and activates only when `NEXT_PUBLIC_SKYLENS_SCOPE_REMOTE_ENABLED=true` and `NEXT_PUBLIC_SKYLENS_SCOPE_REMOTE_BASE_URL` are both set validly.
- Scope asset loading now tries remote first per asset and falls back to local per asset on remote failure.
- Session caches are partitioned by source root so remote and local responses do not poison each other.
- The committed dev fallback dataset is now fixed to a 12-seed allowlist with exact manifest totals `12/24/48/72` and a 45-file `.bin` cap across all bands.
- Default dataset builds now refresh the tracked `out/data/scope/v1` mirror from the rebuilt `public/data/scope/v1` output.

## Known non-changes

- No scope schema changes.
- No service worker, proxy, or backend fetch layer was added.
- No viewer UX or settings changes beyond the new public runtime config surface.
- Non-scope data paths such as aircraft, satellites, constellations, and stars were not changed.

## Expected side effects

- Rebuilding the dev dataset removes many previously tracked fallback tile files from both `public/data/scope/v1` and `out/data/scope/v1`.
- Local test/runtime behavior remains offline-safe with no env changes.

## Validation performed

- `node scripts/build-scope-dataset.mjs --dev`
- `npx vitest run tests/unit/config-contract.test.ts tests/unit/scope-runtime.test.ts tests/unit/scope-data-dev-fallback.test.ts tests/unit/scope-data-build.integration.test.ts tests/unit/scope-data-verify.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`
- Verified regenerated manifest totals are `12/24/48/72`
- Verified both committed roots now contain 45 `.bin` tile files

## Deduplication / centralization decisions

- Kept the remote/local source ordering centralized in `lib/scope/catalog.ts` instead of branching in viewer effects.
- Kept the fixed dev seed allowlist in existing scope constants/build code rather than introducing a separate config/data layer.
