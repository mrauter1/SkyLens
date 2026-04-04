# Implementation Notes

- Task ID: autoloop-task-complete-skylensserverless-prd-adr-1091a0c1
- Pair: implement
- Phase ID: builder
- Phase Directory Key: builder
- Phase Title: Dataset Builder
- Scope: phase-local producer artifact

## Files changed

- `lib/scope-data/build.mjs`
- `lib/scope-data/dev-fallback.mjs`
- `lib/scope-data/index.mjs`
- `lib/scope-data/names.mjs`
- `lib/scope-data/tycho2.mjs`
- `lib/scope-data/verify.mjs`
- `scripts/build-scope-dataset.mjs`
- `scripts/verify-scope-dataset.mjs`
- `public/data/scope/v1/**`
- `tests/unit/scope-data-build.integration.test.ts`
- `tests/unit/scope-data-dev-fallback.test.ts`
- `tests/unit/scope-data-names.test.ts`
- `tests/unit/scope-data-parse.test.ts`
- `tests/unit/scope-data-tiling.test.ts`
- `tests/unit/scope-data-verify.test.ts`

## Symbols touched

- `buildScopeDataset`
- `buildDevSyntheticRows`
- `getDevFallbackBandCoverage`
- `parseScopeNameOverridesCsv`
- `resolveScopeDisplayName`
- `extractTycho2MainFields`
- `deriveTycho2Photometry`
- `normalizeTycho2MainRecord`
- `parseTycho2ExpandedCatalog`
- `verifyScopeDataset`
- repo-root `build-scope-dataset.mjs` and `verify-scope-dataset.mjs` CLI entrypoints

## Checklist mapping

- M4 builder:
  implemented production Tycho-2 parsing, layered naming, deterministic dev synthesis, cumulative banding/tiling, 20-byte LE tile emission, staging, verification, atomic replacement, and `.cache/scope-build/report.json`.
- M5 partial out-of-phase support:
  implemented the shared verifier and repo-root `scope:data:verify` CLI now because builder post-verification and artifact validation depend on the same logic.
- Deferred intentionally:
  operator/developer workflow docs were not updated in this phase.

## Assumptions

- The latest shared decisions block keeps repo-root paths authoritative.
- `public/data/stars_200.json` remains the only committed dev seed input and built-in bright-star HIP naming source.
- Production mode should honor the PRD fallback rule and emit the deterministic dev dataset when the expanded Tycho-2 main-catalog set is unavailable.

## Preserved invariants

- Runtime artifacts stay limited to repo-root `public/data/scope/v1/`; raw source, staging, and report files remain under ignored repo-root `.cache/`.
- Both dev and prod paths emit the same manifest, names, per-band index, and 20-byte LE tile schema.
- Active dataset replacement happens only after staged verification passes; failed builds leave the prior dataset untouched.
- `names.json` is built only from emitted rows and never contains orphan ids.

## Intended behavior changes

- `node scripts/build-scope-dataset.mjs --mode dev` now builds, stages, verifies, reports, and atomically activates the deterministic dev dataset.
- `node scripts/build-scope-dataset.mjs --mode prod` now parses expanded Tycho-2 main-catalog files when present, but falls back to the dev dataset when the production source cache is incomplete.
- Manual name overrides now support both `HIP` and `TYC` matches with strict CSV validation and precedence over the built-in bright-star HIP join.
- `node scripts/verify-scope-dataset.mjs` now performs full offline dataset validation, including dev-only invariants.

## Known non-changes

- No Tycho-2 supplement ingestion was added.
- No runtime tile loader or UI/runtime integration was changed.
- No docs/readme workflow update was added in this phase.

## Expected side effects

- Repo-root `public/data/scope/v1/` now contains the committed deterministic dev artifact set.
- Repo-root `.cache/scope-build/report.json` records the latest build summary, and `.cache/scope-build/staging-v1/` remains the staging location during builds.
- Future prod rebuilds can reuse the same naming, tiling, encoding, and verifier logic without branching on a separate schema.

## Validation performed

- `npm test -- --run tests/unit/scope-data-contracts.test.ts tests/unit/scope-data-download.test.ts tests/unit/scope-data-parse.test.ts tests/unit/scope-data-names.test.ts tests/unit/scope-data-tiling.test.ts tests/unit/scope-data-dev-fallback.test.ts tests/unit/scope-data-verify.test.ts tests/unit/scope-data-build.integration.test.ts`
- `npm run scope:data:build:dev`
- `npm run scope:data:verify`
- `npm run scope:data:build`

## Deduplication / centralization

- Kept parser, dev fallback, build orchestration, and verification in shared `lib/scope-data/` modules so both CLIs and tests use one contract surface.
- Reused the shared schema/json helpers for manifest, band index, name table, and build report emission instead of duplicating serialization logic in scripts.
