# Implement ↔ Code Reviewer Feedback

- Task ID: execute-the-movement-fidelity-plan-defined-in-mo-8533d92f
- Pair: implement
- Phase ID: motion-affordances-and-controls
- Phase Directory Key: motion-affordances-and-controls
- Phase Title: Add motion affordances and quality controls
- Scope: phase-local authoritative verifier artifact

- IMP-001 [blocking] [components/viewer/viewer-shell.tsx `renderObjectBadges`]: stale satellite treatment is not additive for the ISS. `getMovingObjectMotionBadge()` now returns the stale badge first, so any stale ISS object loses the existing `ISS` badge entirely. That contradicts the shared decision that new stale-state treatments must be additive only, and it regresses the prior ISS-specific affordance when the TLE cache is stale. Minimal fix: make `renderObjectBadges` compose multiple badges for satellites that are both stale and `isIss === true` instead of returning only the first matching badge, and add a UI test that covers stale ISS rendering.
- Re-review cycle 2: IMP-001 is resolved. `renderObjectBadges` now composes stale-state and ISS badges together, and viewer-layer regression coverage asserts both badge ids are present for a stale ISS detail card. No remaining findings.
