# Test Strategy

- Task ID: autoloop-task-complete-skylensserverless-prd-adr-1091a0c1
- Pair: test
- Phase ID: repository-wiring-and-core-contracts
- Phase Directory Key: repository-wiring-and-core-contracts
- Phase Title: Repository Wiring and Shared Core
- Scope: phase-local producer artifact

## Behavior-to-test coverage

- AC-1 root npm script wiring:
  covered by `tests/unit/scope-data-contracts.test.ts` assertions against the exact `scope:data:download`, `scope:data:build`, `scope:data:build:dev`, and `scope:data:verify` script values in root `package.json`.
- AC-2 root ignore behavior:
  covered by `tests/unit/scope-data-contracts.test.ts` assertions that root `.gitignore` contains `.cache/scope-source/` and `.cache/scope-build/` and does not list `public/data/scope/v1/`.
- AC-3 shared deterministic contract helpers:
  covered by the existing focused unit tests for fixed downloader constants, band definitions, repo-root path helpers, deterministic JSON/object ordering, strict schema rejection of band drift and unknown keys, name normalization/dedup, bright-star name conflict handling, tile sorting/indexing, row encode/decode, and CLI argument parsing.

## Preserved invariants checked

- Root repository remains the implementation boundary through repo-root path and file assertions.
- Script help surfaces remain stable and deterministic.
- Shared manifest/index/report schemas reject non-canonical band metadata and unknown fields rather than silently accepting them.

## Edge cases and failure paths

- Reversed manifest/report band order is rejected.
- Mismatched band metadata for a given `bandDir` is rejected.
- Extra schema keys are rejected.
- Duplicate bright-star HIP mappings with conflicting normalized names fail.

## Stabilization approach

- Tests are offline and fixture-free.
- Repo wiring checks use direct file-content reads instead of shelling out to git commands, avoiding environment-specific behavior.

## Known gaps

- Command execution bodies for download/build/verify are intentionally out of scope for this phase and are not covered here.
