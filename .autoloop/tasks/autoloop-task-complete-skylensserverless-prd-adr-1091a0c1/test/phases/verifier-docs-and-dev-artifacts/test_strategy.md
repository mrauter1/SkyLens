# Test Strategy

- Task ID: autoloop-task-complete-skylensserverless-prd-adr-1091a0c1
- Pair: test
- Phase ID: verifier-docs-and-dev-artifacts
- Phase Directory Key: verifier-docs-and-dev-artifacts
- Phase Title: Verifier, Docs, and Committed Dev Dataset
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- Verifier happy path:
  - `tests/unit/scope-data-verify.test.ts` confirms a valid dev dataset returns aggregate counts and expected band totals.
- AC-1 failure coverage:
  - Manifest validation: invalid `rowFormat` and manifest band total mismatch both fail verification.
  - Names validation: non-normalized and non-ascending `names.json` entries fail verification.
  - Tile validation: unresolved `nameId`, invalid tile byte length, and tile count mismatch fail verification.
  - Aggregate validation: orphan `names.json` entries fail verification.
  - Dev-only invariants: non-zero PM in a dev tile fails verification.
- AC-2 repeatability/report coverage:
  - `tests/unit/scope-data-build.integration.test.ts` runs two dev builds, snapshots the runtime tree, and asserts byte-for-byte equality for every emitted runtime file.
  - The same integration test parses `.cache/scope-build/report.json` against `ScopeBuildReportSchema` and now asserts the raw report bytes are identical across repeated dev builds.
- Preserved fallback behavior:
  - `tests/unit/scope-data-build.integration.test.ts` keeps coverage for the agreed prod-mode fallback to the deterministic dev dataset when expanded Tycho-2 inputs are absent.
- AC-3 offline validation:
  - Command-level validation reruns `npm run scope:data:build:dev` and `npm run scope:data:verify` against the committed repo-root dataset path.

## Edge cases and failure paths
- Uses temporary dataset roots for verifier failure injection so corrupted fixtures do not affect committed artifacts.
- Exercises both schema-level failures and post-parse reconciliation failures to catch regressions on either side of the verifier boundary.

## Flake risks and stabilization
- No live network usage.
- No wall-clock assertions.
- Determinism is checked via sorted tree reads, raw file byte comparison, and schema parsing of committed cache/runtime outputs.

## Known gaps
- No dedicated CLI-argument parsing tests were added in this phase because the acceptance criteria center on verifier behavior and offline build/report determinism rather than argument handling.
