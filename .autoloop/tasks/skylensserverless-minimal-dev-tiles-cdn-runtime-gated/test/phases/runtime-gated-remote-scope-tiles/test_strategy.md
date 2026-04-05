# Test Strategy

- Task ID: skylensserverless-minimal-dev-tiles-cdn-runtime-gated
- Pair: test
- Phase ID: runtime-gated-remote-scope-tiles
- Phase Directory Key: runtime-gated-remote-scope-tiles
- Phase Title: Runtime-Gated Remote Scope Tiles With Minimal Local Fallback
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- AC-1 public config gate, dark-by-default local mode:
  - `tests/unit/config-contract.test.ts`
  - Covers default local-only config, valid remote enablement, and invalid/blank remote env fallback.
- AC-2 remote-first runtime loading with local fallback and source-partitioned caches:
  - `tests/unit/scope-runtime.test.ts`
  - Covers remote-enabled success, remote-disabled local behavior, remote fetch failure with per-asset fallback, session caching, and explicit local/remote cache partition after mode changes.
- AC-3 minimal deterministic committed fallback dataset:
  - `tests/unit/scope-data-dev-fallback.test.ts`
  - Covers fixed 12-seed fallback shape, deterministic six-row clusters, preserved Polaris/Sirius named rows, and preserved zero-PM/zero-`bMinusV` invariants.
  - `tests/unit/scope-data-build.integration.test.ts`
  - Covers deterministic rebuild hash stability, exact manifest totals `12/24/48/72`, and the fixed `.bin` tile cap of `45`.
  - `tests/unit/scope-data-verify.test.ts`
  - Covers schema-valid offline build plus failure modes for unresolved and orphaned names.
- Preserved graceful-degradation behavior in the viewer:
  - `tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Covers named deep-star rendering path and stale-response suppression after scope disable.

## Edge cases and failure paths

- Blank/invalid public remote env values keep runtime local-only.
- Remote manifest/names/index/tile failures fall back locally without changing schemas.
- Cache-partition regression guard prevents a prior local cache entry from satisfying a later remote-enabled request for the same asset type.
- Dataset verification still fails on malformed name references to protect committed artifact integrity.

## Reliability / stabilization

- All loader tests use deterministic in-memory fetch doubles with explicit URL matching.
- Dataset tests use fixed synthetic seeds, fixed totals, and deterministic tree hashing.
- Viewer regression coverage reuses existing stable helpers and stale-response controls instead of adding new timing-sensitive UI waits.

## Known gaps

- No end-to-end browser test exercises a real CDN/R2 deployment; coverage stays at config/runtime unit level plus committed artifact validation.
- The test slice does not add a separate assertion for `out/data/scope/v1` file contents beyond the implementation validation note that both roots were regenerated to the same 45-file cap.
