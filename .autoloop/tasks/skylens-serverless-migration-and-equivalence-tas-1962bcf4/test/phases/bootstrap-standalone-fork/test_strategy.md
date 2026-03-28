# Test Strategy

- Task ID: skylens-serverless-migration-and-equivalence-tas-1962bcf4
- Pair: test
- Phase ID: bootstrap-standalone-fork
- Phase Directory Key: bootstrap-standalone-fork
- Phase Title: Bootstrap standalone SkyLensServerless app
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- Fork-local package/build/test identity:
  - Covered by `SkyLensServerless/tests/unit/bootstrap-standalone-fork.test.ts`.
  - Asserts package name and required scripts remain fork-local.
- Fork-local runtime/test configuration isolation:
  - Covered by `SkyLensServerless/tests/unit/bootstrap-standalone-fork.test.ts`.
  - Asserts `turbopack.root`, Playwright base URL/web server port, and the fork-local viewer settings storage key.
- No root-app runtime import leakage:
  - Covered by `SkyLensServerless/tests/unit/bootstrap-standalone-fork.test.ts`.
  - Scans `app/`, `components/`, and `lib/` for absolute repo-path strings and relative imports that would resolve outside `SkyLensServerless/`.
- Preserved copied baseline behavior:
  - Covered by the copied fork unit suite (`npm test`).
  - Existing tests continue validating config, routes, viewer behavior, permissions, rendering, and settings behavior after the bootstrap copy.

## Preserved invariants checked
- The fork remains installable/testable/buildable from `SkyLensServerless/`.
- Fork-local config changes do not alter the copied baseline route/component contracts.
- The fork does not encode runtime imports back into the root app tree.

## Edge cases and failure paths
- Relative imports that climb above the fork root fail the containment test.
- Absolute `/workspace/SkyLens` path strings in fork runtime sources fail the containment test.
- Missing or drifted fork-local script/port/storage-key settings fail the bootstrap contract test.

## Reliability / stabilization
- Uses deterministic filesystem scans of the fork source tree; no network calls or timing-sensitive assertions.
- Uses fixed literal expectations for package/config values introduced in this phase.

## Known gaps
- This phase does not add new e2e assertions beyond validating Playwright test discovery.
- Serverless data-path substitutions, privacy-copy updates, and `/view` static-safety remain for later phases.
