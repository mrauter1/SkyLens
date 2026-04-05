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
