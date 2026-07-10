# Autoloop Task: Complete SkyLensServerless PRD/ADR Implementation

Implement **all requirements** defined in:
`SkyLensServerless/SkyLensServerless_Scope_Dataset_PRD_and_ADR_v1_2_final.md`

## Goal
Deliver a complete, production-ready implementation of the SkyLensServerless scope exactly as specified by the PRD/ADR document, including code, tests, and supporting documentation updates required by the spec.

## Mandatory execution behavior
- Use iterative Plan → Implement → Test cycles.
- Do not stop at partial completion.
- Continue until every requirement in the PRD/ADR is implemented and validated.
- If ambiguities exist, resolve them conservatively in favor of the PRD/ADR requirements and internal consistency.

## Acceptance criteria
- All functional requirements from the PRD/ADR are implemented.
- Non-functional/architectural constraints from the ADR are respected.
- Unit/integration/e2e tests are added or updated where appropriate.
- Existing relevant tests pass.
- Any required migrations/config/schema/data changes are included.
- Documentation/readme notes are updated for operator/developer clarity when needed.

## Scope guardrails
- Focus only on implementing the PRD/ADR scope for SkyLensServerless.
- Avoid unrelated refactors unless necessary to satisfy the requirements.
- Keep changes coherent, reviewable, and production-quality.

## Scope Dataset Workflow
- `npm run scope:data:download`
  - Fetches the Tycho-2 source catalog into repo-root `.cache/scope-source/tycho2/`.
  - Safe to rerun; cached valid files are reused unless `--force` is passed through to the script.
- `npm run scope:data:build`
  - Builds the production-shaped dataset from cached Tycho-2 inputs when they are present.
  - If the expanded Tycho-2 cache is missing, the builder emits the deterministic development dataset instead so offline CI and local runs still succeed.
- `npm run scope:data:build:dev`
  - Rebuilds the deterministic offline dataset from `public/data/stars_200.json`.
  - Writes runtime artifacts to `public/data/scope/v1/` and the non-runtime report to `.cache/scope-build/report.json`.
- `npm run scope:data:verify`
  - Validates `public/data/scope/v1/` offline in `auto` mode.
  - Checks manifest/schema integrity, tile/index reconciliation, `nameId` resolution, orphan-name prevention, and development invariants when the manifest kind is `dev`.

## Operator Notes
- The committed repository dataset under `public/data/scope/v1/` is the deterministic development build and is expected to stay byte-stable for identical inputs.
- Build output is staged under `.cache/scope-build/staging-v1/` and verified before replacing the active dataset tree, so a failed build or verify run should leave the previously active dataset intact.
