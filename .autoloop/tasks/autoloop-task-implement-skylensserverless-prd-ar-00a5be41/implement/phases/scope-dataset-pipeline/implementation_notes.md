# Implementation Notes

- Task ID: autoloop-task-implement-skylensserverless-prd-ar-00a5be41
- Pair: implement
- Phase ID: scope-dataset-pipeline
- Phase Directory Key: scope-dataset-pipeline
- Phase Title: Scope Dataset Pipeline
- Scope: phase-local producer artifact
- Files changed:
  `SkyLensServerless/.gitignore`
  `SkyLensServerless/package.json`
  `SkyLensServerless/lib/scope/contracts.ts`
  `SkyLensServerless/lib/scope/decode.ts`
  `SkyLensServerless/scripts/download-scope-source.mjs`
  `SkyLensServerless/scripts/build-scope-dataset.mjs`
  `SkyLensServerless/scripts/verify-scope-dataset.mjs`
  `SkyLensServerless/scripts/scope/constants.mjs`
  `SkyLensServerless/scripts/scope/shared.mjs`
  `SkyLensServerless/scripts/scope/download-core.mjs`
  `SkyLensServerless/scripts/scope/build-core.mjs`
  `SkyLensServerless/scripts/scope/verify-core.mjs`
  `SkyLensServerless/public/data/scope/v1/**`
  `SkyLensServerless/tests/unit/scope-data-parse.test.ts`
  `SkyLensServerless/tests/unit/scope-data-names.test.ts`
  `SkyLensServerless/tests/unit/scope-data-tiling.test.ts`
  `SkyLensServerless/tests/unit/scope-data-dev-fallback.test.ts`
  `SkyLensServerless/tests/unit/scope-data-download.test.ts`
  `SkyLensServerless/tests/unit/scope-data-verify.test.ts`
  `SkyLensServerless/tests/unit/scope-data-build.integration.test.ts`
- Reviewer follow-up fix:
  `SkyLensServerless/scripts/scope/build-core.mjs`
  `SkyLensServerless/tests/unit/scope-data-names.test.ts`
- Symbols touched:
  `SCOPE_DATASET_BANDS`, `SCOPE_ROW_FORMAT`, `decodeScopeTileRows`, `downloadScopeSource`, `buildScopeDataset`, `verifyScopeDataset`, `parseTycho2Line`, `derivePhotometry`, `assignDisplayNames`, `buildDevSyntheticStars`
- Checklist mapping:
  Phase 1 downloader: cache ignore rule, `download-scope-source.mjs`, base-url override parsing, restartable cache validation
  Phase 2 builder core: Tycho-2 parser contract, photometry derivation, banding/tiling, names table, manifest/index/report emission
  Phase 3 dev fallback: deterministic six-row synthetic dataset from `stars_200.json`, committed `public/data/scope/v1/`, matching runtime schema
  Phase 4 verifier: manifest/names/index/tile/orphan-name/dev-invariant validation plus CLI wrapper
  Phase 5 package/public integration: npm scripts, atomic staging swap, committed dev output, dataset unit/integration tests
  Reviewer `IMP-001`: mixed manual override conflict detection per source row before bright-star fallback
- Assumptions:
  The provided R2 `names.json` is a published names table, not a source-row join table, so it is cached and schema-validated only.
  Existing repo-wide lint/test failures outside scope data remain reviewer-owned unless traced to touched files.
- Preserved invariants:
  Raw production source stays under ignored `.cache/scope-source/`.
  Offline `scope:data:build:dev` and `scope:data:verify` do not require network.
  Emitted runtime names come only from emitted rows after manual override then bright-star HIP join precedence.
  Dev/prod runtime artifacts share the same manifest, band-index, names-table, and 20-byte tile row schema.
  Mixed `HIP` + `TYC` manual override matches now fail the build instead of silently choosing one.
- Intended behavior changes:
  Adds manifest-driven scope dataset build/download/verify tooling and ships the deterministic dev dataset under `public/data/scope/v1/`.
- Known non-changes:
  No viewer runtime wiring for dense scope tiles in this phase.
  No Tycho-2 supplement ingestion.
  No use of the optional R2 names table to rename emitted rows.
- Expected side effects:
  `npm run scope:data:build:dev` overwrites `public/data/scope/v1/` atomically and refreshes `.cache/scope-build/report.json`.
  `npm run scope:data:download` may also cache the optional published names table under `.cache/scope-source/published/names.json`.
- Validation performed:
  `npx vitest run tests/unit/scope-data-*.test.ts`
  `npm run scope:data:build:dev`
  `npm run scope:data:verify`
  `npm run build`
  `npx vitest run tests/unit/viewer-settings.test.tsx -t "reloads changed layer toggles and calibration values from persisted settings"`
  Reviewer-fix rerun:
  `npx vitest run tests/unit/scope-data-*.test.ts`
  `npm run scope:data:build:dev`
  `npm run scope:data:verify`
- Validation notes:
  `npm run lint` is still blocked by the pre-existing `lib/sensors/orientation.ts` `@typescript-eslint/no-empty-object-type` error plus existing warnings outside this phase.
  `npm run test` still fails in the pre-existing `tests/unit/viewer-shell-celestial.test.ts` suite; the new scope-data suite passes and the isolated `viewer-settings` rerun passed.
- Deduplication / centralization:
  Shared dataset constants live in `scripts/scope/constants.mjs`; runtime-facing contract/decoder helpers live in `lib/scope/*` to avoid re-embedding the row schema in later consumers.

## Resume Turn 2026-04-05T13:55:46Z

- Files changed:
  `.autoloop/tasks/autoloop-task-implement-skylensserverless-prd-ar-00a5be41/decisions.txt`
  `.autoloop/tasks/autoloop-task-implement-skylensserverless-prd-ar-00a5be41/implement/phases/scope-dataset-pipeline/implementation_notes.md`
- `SkyLensServerless` source changes this turn:
  None. The reviewed dataset-pipeline fix was already present.
- Symbols reviewed:
  `assignDisplayNames`, `buildScopeDataset`
- Checklist mapping:
  Reviewer `IMP-001` revalidation only; no new checklist items added or deferred.
- Assumptions:
  Phase feedback remains authoritative and no newer clarification superseded the clean re-review result.
- Preserved invariants:
  `scope:data:build:dev` stays repo-local and deterministic.
  Offline `scope:data:verify` stays independent of the optional cached R2 names table.
- Intended behavior changes:
  None this turn.
- Known non-changes:
  No runtime, script, schema, test, or dataset artifact edits were required in `SkyLensServerless/`.
- Expected side effects:
  Re-running `scope:data:build:dev` confirmed the committed `public/data/scope/v1/` dataset regenerates without working-tree drift.
- Validation performed:
  `npx vitest run tests/unit/scope-data-*.test.ts`
  `npm run scope:data:verify`
  `npm run scope:data:build:dev`
  `npm run scope:data:verify`
- Deduplication / centralization:
  No new centralization changes this turn.
