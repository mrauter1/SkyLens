# Implementation Notes

- Task ID: autoloop-task-complete-skylensserverless-prd-adr-1091a0c1
- Pair: implement
- Phase ID: downloader
- Phase Directory Key: downloader
- Phase Title: Production Source Downloader
- Scope: phase-local producer artifact

## Files changed

- `lib/scope-data/download.mjs`
- `lib/scope-data/index.mjs`
- `scripts/download-scope-source.mjs`
- `tests/unit/scope-data-download.test.ts`

## Symbols touched

- `downloadScopeSource`
- `formatScopeSourceDownloadSummary`
- `ScopeSourceDownloadError`
- repo-root `download-scope-source.mjs` CLI entrypoint

## Checklist mapping

- M3 downloader:
  implemented restartable raw/expanded Tycho-2 acquisition, ordered candidate fallback, summary reporting, and offline unit coverage for skip-valid, force, expansion, and exhausted candidates.
- Deferred intentionally:
  production parser/build logic and dataset verification remain for later phases.

## Assumptions

- The latest shared decisions block keeps repo-root paths authoritative even though the nested `SkyLensServerless/` tree remains available for comparison.
- The downloader follows the already-wired CLI override contract from `lib/scope-data/cli.mjs`, where CLI or env base URL overrides replace the built-in default list.

## Preserved invariants

- Raw source files stay under repo-root `.cache/scope-source/tycho2/raw/`; no downloader writes occur under `public/`.
- The downloader remains restartable and offline-capable once valid raw files exist.
- No live-network tests were added.

## Intended behavior changes

- `node scripts/download-scope-source.mjs` now performs actual acquisition instead of failing with a pending-phase placeholder.
- Valid cached files are skipped unless `--force` is passed.
- When `--expand` is enabled, missing or stale expanded files are regenerated from valid cached gzip files before any network fetch is attempted.
- The command now prints per-file status plus the final candidate used and exits non-zero when any required file is still missing.

## Known non-changes

- The downloader does not build or verify `public/data/scope/v1/`.
- No build-phase parser, tiling, or artifact emission logic was added in this phase.

## Expected side effects

- Later build-phase code can rely on a stable repo-root Tycho-2 cache layout with optional pre-expanded text files.
- Operators can rerun downloads without redownloading already valid files, and can repair missing `expanded/` files from raw cache alone.

## Validation performed

- `npm test -- --run tests/unit/scope-data-download.test.ts tests/unit/scope-data-contracts.test.ts`
- `node scripts/download-scope-source.mjs --help`

## Deduplication / centralization

- Kept download orchestration, cache validation, expansion, and summary formatting centralized in `lib/scope-data/download.mjs`.
- Kept `scripts/download-scope-source.mjs` as a thin CLI wrapper over the shared downloader module.
