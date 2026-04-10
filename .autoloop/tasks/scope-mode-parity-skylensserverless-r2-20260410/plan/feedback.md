# Plan ↔ Plan Verifier Feedback
- Replaced empty planning artifacts with a single coherent phase because marker parity, scope projection ownership, and label candidate parity are one coupled viewer-shell slice.
- Grounded the plan in the current `SkyLensServerless/components/viewer/viewer-shell.tsx` pipeline and identified the main regression surface as scope-mode stage marker sourcing/sizing versus scope optics.
- Added explicit acceptance criteria, invariants, validation, and rollback steps to prevent regressions in center-lock, label composition, and normal-view behavior.
- PLAN-001 [non-blocking]: Verified intent fidelity and safety coverage. The plan explicitly covers all three required outcomes (class parity, scope-optics distinction, and scope label/top-list parity) and keeps normal-view compatibility as a preserved invariant.
- PLAN-002 [non-blocking]: `phase_plan.yaml` is structurally valid and implementation-ready as a single coherent phase; runtime-owned metadata (`version`, `task_id`, `request_snapshot_ref`) is preserved, dependency ordering is valid, and acceptance criteria/deliverables align with the narrative plan.
- PLAN-003 [non-blocking]: Shared decisions alignment is intact. The plan follows the decision ledger direction to keep eligibility gating centralized in `resolveMarkerEligibleProjectedObjects(...)` and avoids introducing extra filtering abstractions.
