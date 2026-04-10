# Plan ↔ Plan Verifier Feedback
- Planned the task as one coherent phase centered on `SkyLensServerless/components/viewer/viewer-shell.tsx`, because the reviewed regressions share the same stage-vs-lens ownership seam and splitting them would add handoff risk.
- Added explicit invariants for stage marker set, stage sizing baseline, highlight ownership, and projection-surface alignment so implement/test turns can close the review items without drifting scope.
- Recorded the root settings expectation as “keep the existing disabled-scope aperture clamp unless authoritative clarification says otherwise,” based on the current normalization code in `lib/viewer/settings.ts`.
- PLAN-001 non-blocking: No blocking findings. `plan.md` and `phase_plan.yaml` cover each requested regression seam, keep the change local to the viewer-shell/runtime and named tests, preserve selector compatibility, and include concrete invariants, validation, and rollback guidance.
