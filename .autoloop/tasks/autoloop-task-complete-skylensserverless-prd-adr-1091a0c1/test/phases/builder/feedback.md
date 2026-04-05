# Test Author ↔ Test Auditor Feedback

- Task ID: autoloop-task-complete-skylensserverless-prd-adr-1091a0c1
- Pair: test
- Phase ID: builder
- Phase Directory Key: builder
- Phase Title: Dataset Builder
- Scope: phase-local authoritative verifier artifact

## Test additions

- Added/confirmed builder-phase unit coverage for Tycho-2 parsing, naming precedence, tiling/sort behavior, deterministic dev fallback synthesis, and verifier failure paths.
- Extended `tests/unit/scope-data-build.integration.test.ts` to lock the current shared decision that `mode: 'prod'` falls back to the deterministic dev dataset when the expanded Tycho-2 cache is absent.
- Validation run: `npm test -- --run tests/unit/scope-data-build.integration.test.ts tests/unit/scope-data-parse.test.ts tests/unit/scope-data-names.test.ts tests/unit/scope-data-tiling.test.ts tests/unit/scope-data-dev-fallback.test.ts tests/unit/scope-data-verify.test.ts`

## Audit findings

- `TST-001` | `blocking` | `tests/unit/scope-data-parse.test.ts` still does not cover the `missingRa` and `missingDec` drop rules from the Tycho-2 parser contract, even though AC-3 and `test_strategy.md` treat parser row-drop behavior as covered. A regression that stops dropping blank/invalid RA or Dec values would currently pass the suite. Minimal fix: add explicit parser assertions for blank or non-finite RA and Dec inputs returning `dropReason: 'missingRa'` and `dropReason: 'missingDec'`.

## Remediation

- Added explicit parser assertions for blank and non-finite RA/Dec values returning `dropReason: 'missingRa'` and `dropReason: 'missingDec'` in `tests/unit/scope-data-parse.test.ts`.
- Validation run: `npm test -- --run tests/unit/scope-data-parse.test.ts tests/unit/scope-data-build.integration.test.ts tests/unit/scope-data-verify.test.ts`

## Audit resolution

- `TST-001` | `non-blocking` | Re-audited after remediation. The parser suite now explicitly covers blank and non-finite RA/Dec coordinate drops, and the targeted rerun passed, so no blocking test-audit findings remain for the builder phase.
