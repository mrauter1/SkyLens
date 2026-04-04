# Implementation Notes

- Task ID: autoloop-task-complete-skylensserverless-prd-adr-1091a0c1
- Pair: implement
- Phase ID: repository-wiring-and-core-contracts
- Phase Directory Key: repository-wiring-and-core-contracts
- Phase Title: Repository Wiring and Shared Core
- Scope: phase-local producer artifact

## Files changed

- `package.json`
- `.gitignore`
- `lib/scope-data/contracts.mjs`
- `lib/scope-data/paths.mjs`
- `lib/scope-data/json.mjs`
- `lib/scope-data/names.mjs`
- `lib/scope-data/tiles.mjs`
- `lib/scope-data/cli.mjs`
- `lib/scope-data/index.mjs`
- `scripts/download-scope-source.mjs`
- `scripts/build-scope-dataset.mjs`
- `scripts/verify-scope-dataset.mjs`
- `tests/unit/scope-data-contracts.test.ts`

## Symbols touched

- `SCOPE_*` contract/path constants
- `Scope*Schema` zod validators
- `createStrictObject`
- `createExactBandShape`
- `getScopeBandDefinitionByDir`
- `getScopeBandDefinitionForMagnitude`
- `serializeDeterministicJson`
- `createScopeManifestBand`
- `createScopeCatalogManifest`
- `createScopeBandIndex`
- `createScopeNameTable`
- `createScopeBuildReport`
- `normalizeScopeDisplayName`
- `buildScopeNameTable`
- `buildBrightStarHipNameMap`
- `normalizeRaDeg`
- `getTileIndices`
- `compareNormalizedScopeStars`
- `encodeScopeStarRow`
- `decodeScopeStarRow`
- `parseDownloadCommandArgs`
- `parseBuildCommandArgs`
- `parseVerifyCommandArgs`

## Checklist mapping

- M1 repository wiring and cache boundaries:
  updated root npm scripts, added root `scripts/` entrypoints, and ignored `.cache/scope-source/` plus `.cache/scope-build/` while leaving `public/data/scope/v1/` tracked.
- M2 shared scope-data core:
  added centralized contracts, paths, deterministic JSON helpers, name helpers, tile helpers, and CLI contract parsing under root `lib/scope-data/`.
  tightened schemas to strict objects plus canonical per-band tuples/unions so manifest/index/report helpers encode the exact ADR band mapping and reject unknown fields.
- Deferred intentionally:
  downloader/build/verifier execution logic, dataset emission, and runtime artifacts remain for later milestones/phases.

## Assumptions

- Root repository paths are authoritative per the latest shared decisions block.
- This phase only needs the shared contract surface and script wiring, not the full dataset pipeline behavior.

## Preserved invariants

- No edits were made under the nested `SkyLensServerless/` tree.
- `public/data/scope/v1/` is not ignored.
- Existing runtime app behavior is unchanged; this phase is additive at the repo root.

## Intended behavior changes

- Root `package.json` now exposes the four required `scope:data:*` npm scripts.
- Root CLI entrypoints now parse the ADR-defined arguments and expose `--help` usage text.
- Shared deterministic scope-data helpers now exist at one repo-root import surface for later phases.
- Manifest/index/report helpers now reject band drift, duplicate/reordered bands, and unknown keys at the shared schema layer.

## Known non-changes

- The downloader, builder, and verifier command bodies are not implemented in this phase.
- No dataset files, cache files, documentation workflow notes, or runtime integrations were added yet.

## Expected side effects

- Later phases can import exact constants/schemas/helpers from `lib/scope-data/` instead of duplicating contract values.
- Invoking the new scripts without `--help` currently fails fast with an explicit pending-phase error instead of pretending to perform partial work.

## Validation performed

- `npm ci`
- `npm test -- --run tests/unit/scope-data-contracts.test.ts`
- Added negative coverage in `tests/unit/scope-data-contracts.test.ts` for band-order mismatch, band metadata mismatch, and unknown-key rejection.
- `node scripts/download-scope-source.mjs --help`
- `node scripts/build-scope-dataset.mjs --help`
- `node scripts/verify-scope-dataset.mjs --help`
- Verified git ignore behavior with `git check-ignore -v` for `.cache/scope-source/`, `.cache/scope-build/`, and non-ignored `public/data/scope/v1/manifest.json`

## Deduplication / centralization

- Centralized exact PRD/ADR constants and schemas in `lib/scope-data/contracts.mjs`.
- Kept strict schema enforcement centralized in `lib/scope-data/contracts.mjs` so later verifier/build code inherits the same unknown-key rejection and canonical band ordering rules.
- Centralized deterministic JSON construction and serialization in `lib/scope-data/json.mjs`.
- Centralized name normalization and deterministic `nameId` prep in `lib/scope-data/names.mjs`.
- Centralized tile indexing and 20-byte row encode/decode logic in `lib/scope-data/tiles.mjs`.
