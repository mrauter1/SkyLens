# Test Strategy

- Task ID: autoloop-task-implement-skylensserverless-prd-ar-00a5be41
- Pair: test
- Phase ID: scope-dataset-pipeline
- Phase Directory Key: scope-dataset-pipeline
- Phase Title: Scope Dataset Pipeline
- Scope: phase-local producer artifact

## Behavior → coverage map

- Downloader contract:
  `tests/unit/scope-data-download.test.ts`
  Covers CLI override precedence over env/default base URLs.
- Tycho-2 parse and photometry contract:
  `tests/unit/scope-data-parse.test.ts`
  Covers 206-char line enforcement, PM zero fallback, `pflag = X`, and unusable photometry drops.
- Name handling and preserved precedence:
  `tests/unit/scope-data-names.test.ts`
  Covers normalization, manual override precedence over bright-star HIP join, bright-star fallback, mixed `HIP` + `TYC` override conflict failure, and the preserved rule that same-name duplicate matches still fail instead of deduplicating by normalized value.
- Banding / tile math invariants:
  `tests/unit/scope-data-tiling.test.ts`
  Covers RA wrapping and deterministic tile index calculation.
- Dev fallback dataset invariants:
  `tests/unit/scope-data-dev-fallback.test.ts`
  Covers six synthetic rows per seed star, exact dev magnitudes, zero PM/color, and named deep-row behavior on synthetic index `5`.
- Verify command offline failure paths:
  `tests/unit/scope-data-verify.test.ts`
  Covers successful offline dev verification, unresolved `nameId` failure, and orphaned `names.json` entry failure.
- End-to-end dev build determinism:
  `tests/unit/scope-data-build.integration.test.ts`
  Covers repeated dev builds producing identical output bytes and a deeper `mag10p5` dataset than `mag6p5`.

## Preserved invariants checked

- `scope:data:build:dev` remains deterministic and offline-capable.
- The committed dev dataset uses the production runtime schema.
- Emitted names remain row-derived only; verifier rejects unresolved and orphaned names.
- Manual override conflicts do not silently normalize to one winner.

## Edge cases and failure paths

- Invalid fixed-width Tycho row length.
- Missing usable photometry.
- `pflag = X` exclusion.
- Mixed `HIP` + `TYC` override collision on one source row.
- Mixed `HIP` + `TYC` override collision on one source row even when both override names normalize to the same string.
- Unresolved `nameId` references in tile rows.
- Orphaned `names.json` entries with no emitted row references.

## Stabilization notes

- Verifier tests build into `.cache/scope-test-verify/` instead of the committed `public/data/scope/v1/` tree to avoid fixture races and keep teardown deterministic.
- Scope-data suite should be run separately from concurrent `scope:data:build:dev` / `scope:data:verify` CLI invocations because those commands overwrite the same committed dataset root.

## Known gaps

- No networked downloader integration test is added here; the suite keeps source acquisition coverage deterministic by testing override resolution and the offline build/verify paths directly.
