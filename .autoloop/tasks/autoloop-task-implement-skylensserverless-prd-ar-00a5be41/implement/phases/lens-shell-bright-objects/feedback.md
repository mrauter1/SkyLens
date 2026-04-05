# Implement ↔ Code Reviewer Feedback

- Task ID: autoloop-task-implement-skylensserverless-prd-ar-00a5be41
- Pair: implement
- Phase ID: lens-shell-bright-objects
- Phase Directory Key: lens-shell-bright-objects
- Phase Title: Lens Shell And Bright Scope Pass
- Scope: phase-local authoritative verifier artifact

## Findings

- IMP-001 `blocking` — [ViewerShell] `SkyLensServerless/components/viewer/viewer-shell.tsx`: the new scope lock replaces `centerLockedObject` globally, and that same value is still fed into wide marker highlighting and label/top-list ranking (`markerObjects`, `layoutLabels`, `compareLabelCandidates`, `getMarkerVisualClassName`). In any case where a wide-only object would win the base scene but a bright scope object wins the lens pass, the wide scene outside the lens changes highlight/order state, which violates FR-4 and AC-2’s requirement that the wide markers/labels remain unchanged outside the lens. Minimal fix: keep `wideCenterLockedObject` for wide-stage rendering state and use a separate `scopeCenterLockedObject` only for scope chip/detail precedence.

- IMP-002 `blocking` — [ScopeLensOverlay] `SkyLensServerless/components/viewer/scope-lens-overlay.tsx`: the pointer shield is attached to a square HTML box with `rounded-full` + `overflow-hidden`. That clips visuals, but pointer hit-testing still uses the square box rather than the circular visible lens, so clicks can be blocked in the four corner regions outside the visible circle. This violates AC-2’s requirement that only the lens interior be pointer-shielded while outside behavior remains unchanged. Minimal fix: use a truly circular interactive region (`clip-path: circle(...)` or equivalent radial hit-testing) and keep the chrome layer separate if needed.

- IMP-003 `non-blocking` — Re-review of `IMP-001` and `IMP-002`: addressed. The updated `ViewerShell` keeps wide-scene highlight/ranking state on the original wide center-lock candidate while scope readouts use the scope bright-object candidate, and `ScopeLensOverlay` now uses a circular `clip-path` on the interactive layer so the pointer shield matches the visible lens. Focused validation passed with `tests/unit/scope-lens-overlay.test.tsx`, `tests/unit/viewer-shell.test.ts`, and the isolated scope center-lock case in `tests/unit/viewer-shell-celestial.test.ts`.

- IMP-004 `non-blocking` — Verifier rerun: no remaining blocking issues found in phase scope. The scoped product files show no further diffs this resume turn, the wide-scene/scope center-lock split still preserves outside-lens behavior, and the circular lens hit area still matches the visible occlusion region. Verifier-side regression checks passed with `npm test -- --run tests/unit/scope-lens-overlay.test.tsx tests/unit/viewer-shell.test.ts` and `npm test -- --run tests/unit/viewer-shell-celestial.test.ts -t "switches center-lock to scope bright objects when scope mode is enabled|renders the scope overlay after wide lines, markers, and labels for lens occlusion ordering"`.
