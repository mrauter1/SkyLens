# Implement ↔ Code Reviewer Feedback

- Task ID: autoloop-task-complete-skylensserverless-prd-adr-1091a0c1
- Pair: implement
- Phase ID: repository-wiring-and-core-contracts
- Phase Directory Key: repository-wiring-and-core-contracts
- Phase Title: Repository Wiring and Shared Core
- Scope: phase-local authoritative verifier artifact

- IMP-001 (`blocking`) `lib/scope-data/contracts.mjs`, `createScopeCatalogManifest`, `createScopeBandIndex`, `createScopeBuildReport`: the new shared schemas do not encode the exact ADR band contract. A caller can currently build `mag6p5` metadata with `maxMagnitude: 8.0`, mismatched RA/Dec steps, duplicate bands, or a non-canonical manifest band order and still pass the shared core. That misses AC-3’s requirement that the root helpers encode the exact downloader/builder/verifier contract and creates a concrete future failure mode where later phases emit or accept out-of-spec artifacts through the “source of truth” helpers. Fix by deriving per-band literal schemas from `SCOPE_BAND_DEFINITIONS` and asserting canonical band membership/order inside the manifest/index/report constructors.

- IMP-002 (`blocking`) `lib/scope-data/contracts.mjs` `ScopeCatalogManifestSchema`, `ScopeBandIndexSchema`, `ScopeBuildReportSchema`, and nested object schemas: the zod objects are not strict, so verifier-side validation built on these schemas would silently strip unexpected keys instead of rejecting out-of-spec JSON. That undermines the phase goal of exact schema contracts for build/verify/tests and would let malformed runtime artifacts pass “validation” with extra fields still present on disk. Fix by switching the shared object schemas to `.strict()` and keeping strict validation centralized in `lib/scope-data/contracts.mjs` so later verifier code rejects unknown fields by default.

- Review update (cycle 2): IMP-001 and IMP-002 are resolved. The shared contract layer now locks canonical band metadata/order and rejects unknown keys, and the focused validation passed with `npm test -- --run tests/unit/scope-data-contracts.test.ts` plus the three script `--help` checks.
