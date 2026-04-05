# SkyLensServerless Scope Dataset Plan

## Scope
- The implementation target is the active repository root `/workspace/SkyLens`; PRD/ADR-relative paths such as `public/`, `.cache/`, `scripts/`, `tests/`, and `data/scope-source/` stay rooted there unless a later clarification explicitly changes that contract.
- In scope: root-level dataset download/build/verify scripts, shared dataset helpers, committed root `public/data/scope/v1/` dev artifacts, root `package.json` script wiring, root tests, root ignore updates, and concise developer-usage notes for the new workflow.
- Out of scope: runtime scope rendering/loader integration and direct edits to the nested `SkyLensServerless/` tree except where it is consulted for regression analysis or prior-art comparison.

## Delivery strategy
1. Add the dataset pipeline as thin root-level CLIs in `scripts/` backed by a small shared `lib/scope-data/` module set for parsing, naming, tiling, serialization, and verification logic.
2. Keep all raw, staging, and report outputs under root `.cache/` and keep only runtime-consumable committed artifacts under root `public/data/scope/v1/`.
3. Implement the dev build path first to lock the runtime schema and deterministic output contract, then wire the production downloader/parser path against the same shared helpers.

## Milestones

### M1. Repository wiring and cache boundaries
- Update root `package.json` with the four required `scope:data:*` scripts.
- Update root `.gitignore` to ignore `.cache/scope-source/` and `.cache/scope-build/` while keeping `public/data/scope/v1/` committed.
- Add the root `scripts/` surface and ensure the dataset output tree is generated into root `public/data/scope/v1/`, not created manually.

### M2. Shared scope-data core
- Add a focused root `lib/scope-data/` surface for exact contracts and deterministic helpers:
  - bands, row format, manifest/index/report schema, path helpers
  - JSON serialization with fixed key order and trailing newline
  - name normalization, deduplication, and `nameId` assignment
  - tile indexing, row sorting, and 20-byte LE binary encoding/decoding
  - Tycho-2 parsing and dev synthetic-row generation
- Keep scripts as CLI/orchestration entrypoints; keep parser, naming, tiling, encoding, and verification logic pure enough for unit coverage.

### M3. Downloader
- Implement `scripts/download-scope-source.mjs` with the required CLI contract, ordered base URL resolution, restartable skip-valid behavior, optional expansion, and non-zero failure on incomplete acquisition.
- Cache production raw files in `.cache/scope-source/tycho2/raw/` and expanded text in `.cache/scope-source/tycho2/expanded/`.
- Cover downloader behavior with root `tests/unit/scope-data-download.test.ts` using offline fixtures/mocks rather than live network.

### M4. Builder
- Implement `scripts/build-scope-dataset.mjs` with `--mode prod|dev`.
- Production mode:
  - read only Tycho-2 main catalog files from root cache paths
  - enforce the exact 206-character parser contract and field ranges
  - derive photometry, apply drop rules, filter to `vMag <= 10.5`, and augment names in the required precedence order
- Development mode:
  - synthesize exactly 6 rows per root `public/data/stars_200.json` seed using the ADR offsets/magnitudes
  - preserve the exact production runtime schema and dev invariants
- Both modes:
  - compute cumulative bands and exact grid indices
  - emit deterministic `manifest.json`, `names.json`, per-band `index.json`, and non-empty `.bin` tiles under root `public/data/scope/v1/`
  - write the non-runtime report to root `.cache/scope-build/report.json`
  - stage to root `.cache/scope-build/staging-v1/`, verify, then atomically replace root `public/data/scope/v1/`

### M5. Verifier, docs touchpoint, and committed dev artifacts
- Implement `scripts/verify-scope-dataset.mjs` with `--dataset-root` and `--kind`.
- Validate schema, file presence, tile counts, row bounds, name resolution, orphan-name prevention, and dev-only invariants.
- Commit the generated deterministic dev dataset under root `public/data/scope/v1/`.
- Update root `AUTOLOOP_SERVERLESS_TASK.md` with the operator/developer workflow for `scope:data:download`, `scope:data:build`, `scope:data:build:dev`, and `scope:data:verify` unless an existing repo-root README becomes the clearer home during implementation.
- Add/extend unit and integration tests, then run the relevant root `vitest` suite plus the dev build/verify commands to prove deterministic offline behavior.

## Interfaces and contracts

### CLI contracts
- `node scripts/download-scope-source.mjs --base-url <url> --dest <path> --force --expand --timeout-ms <int>`
- `node scripts/build-scope-dataset.mjs --mode prod|dev`
- `node scripts/verify-scope-dataset.mjs --dataset-root <path> --kind auto|dev|prod`
- `npm` is the public interface via root `scope:data:download`, `scope:data:build`, `scope:data:build:dev`, and `scope:data:verify`.

### Internal module boundaries
- `lib/scope-data/contracts.*`: exact constants, path helpers, schema types, band definitions, row-size constant.
- `lib/scope-data/names.*`: normalization, CSV override parsing, bright-star HIP join, name table generation.
- `lib/scope-data/tycho2.*`: fixed-range parser, inclusion/drop accounting, normalized production rows.
- `lib/scope-data/dev-fallback.*`: deterministic synthetic rows from root `public/data/stars_200.json`.
- `lib/scope-data/tiles.*`: band membership, tile key/index logic, row sorting, binary encode/decode.
- `lib/scope-data/verify.*`: dataset-root verification shared by builder post-checks and CLI verifier.

## Compatibility and regression controls
- Existing runtime star/constellation features remain unchanged; the dataset pipeline is additive under a new root `public/data/scope/v1/` tree and new root npm scripts.
- No raw source catalog files may be written into `public/`, `out/`, or committed fixture paths.
- Dev and prod outputs must remain schema-identical so later runtime integration does not branch on source mode beyond manifest `kind` and `sourceCatalog`.
- Atomic replacement must leave the previously active root dataset intact on build or verify failure.
- Determinism must hold across identical inputs by fixing row sort order, JSON key order, name ordering, and omission of timestamps from shipped runtime artifacts.
- The nested `SkyLensServerless/` copy is a regression-analysis surface only; do not add a second divergent pipeline there because that would create duplicated ownership and future drift.

## Validation plan
- Add the ADR-named unit tests at root: download, parse, names, tiling, dev fallback, verify, plus one end-to-end dev build integration test.
- Reuse fixture-driven testing patterns already present in root `tests/unit/`.
- Verify:
  - `npm run scope:data:build:dev`
  - `npm run scope:data:verify`
  - repeated dev builds produce identical bytes
  - targeted unit tests for parser, downloader, naming, tiling, verifier
- Keep production-path tests offline by using fixture Tycho-2 snippets and mocked downloader I/O rather than live network.

## Risk register
- Duplicate-tree drift: the repo contains a nested `SkyLensServerless/` copy that could tempt parallel implementation. Mitigation: implement only at repo root and treat the nested tree as reference-only unless later clarified otherwise.
- Parser-contract defects: byte offsets or 206-char enforcement errors could silently corrupt production output. Mitigation: fixed-range unit tests with exact sample lines and drop-reason accounting.
- Determinism regressions: unordered maps or filesystem iteration could change bytes across builds. Mitigation: centralize ordering/serialization helpers and verify byte-for-byte repeatability in integration tests.
- Name-source conflicts: duplicate HIP seed names or conflicting overrides can create unstable `nameId` mappings. Mitigation: fail fast on conflicts and test precedence explicitly.
- Atomic replacement mistakes: partial dataset activation would break later runtime consumers. Mitigation: stage under root cache, verify before swap, and preserve the prior active dataset on failure.

## Rollout and rollback
- Rollout: land root scripts, root tests, root ignore updates, root workflow notes, and the committed deterministic root dev dataset together so CI and local developers have an immediately valid offline dataset.
- Rollback: revert the scope-data changeset and restore the last committed root `public/data/scope/v1/`; no persisted data migration is required because the dataset is static and versioned under `v1/`.
