# Test Strategy

- Task ID: autoloop-task-complete-skylensserverless-prd-adr-1091a0c1
- Pair: test
- Phase ID: builder
- Phase Directory Key: builder
- Phase Title: Dataset Builder
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- Production Tycho-2 parser contract:
  covered by `tests/unit/scope-data-parse.test.ts` for fixed-width extraction, exact 206-character enforcement, photometry derivation, PM zero fallback, and row-drop rules including missing/non-finite RA and Dec.
- Naming precedence and normalization:
  covered by `tests/unit/scope-data-names.test.ts` for override CSV parsing, normalization, override precedence over bright-star HIP joins, explicit unnamed overrides, duplicate-target failure, and deterministic name-id assignment.
- Banding, tiling, and deterministic ordering:
  covered by `tests/unit/scope-data-tiling.test.ts` for RA normalization, Dec clamping, cumulative band inclusion, tile index calculation, and tile-local sort order.
- Deterministic dev fallback synthesis:
  covered by `tests/unit/scope-data-dev-fallback.test.ts` for exact offsets, exact magnitudes, index-5-only naming, zero PM/color invariants, wrap/clamp behavior, and non-empty `mag6p5`.
- Runtime artifact verification and failure paths:
  covered by `tests/unit/scope-data-verify.test.ts` for valid dev dataset verification, unresolved `nameId`, orphan names, and invalid tile length failures.
- End-to-end build orchestration:
  covered by `tests/unit/scope-data-build.integration.test.ts` for repeated byte-identical dev builds and the current decision-driven `mode: 'prod'` fallback to the deterministic dev dataset when the expanded Tycho-2 cache is absent.

## Preserved invariants checked

- Shared manifest, names, band-index, and tile-row schema remain valid for dev output.
- Named-row coverage remains deep-only in the deterministic fallback path.
- Deterministic JSON/tile bytes are stable across repeated offline dev builds.
- Verification remains offline and fixture-driven; no live network dependencies were introduced.

## Edge cases and failure paths

- Blank or non-finite RA/Dec, blank BT/VT photometry, and `pflag = X` rows drop predictably.
- Manual override rows can force unnamed output without falling through to bright-star HIP names.
- Missing or corrupt tile/name relationships fail verification deterministically.
- Missing expanded production cache in prod mode is locked to the current shared decision via integration coverage.

## Flake-risk controls

- Temp-directory verifier fixtures clean up with `afterEach`.
- Integration coverage uses repo-local offline inputs only and compares bytes directly rather than timestamps or filesystem metadata.
- No network, timers, or nondeterministic ordering are part of the asserted behavior.

## Known gaps

- No full production end-to-end build fixture was added because the repository does not include a complete Tycho-2 expanded cache snapshot.
- Runtime tile loading remains out of phase and is intentionally not exercised here.
