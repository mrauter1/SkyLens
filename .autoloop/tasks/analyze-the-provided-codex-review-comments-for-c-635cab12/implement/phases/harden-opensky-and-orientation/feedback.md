# Implement ↔ Code Reviewer Feedback

- Task ID: analyze-the-provided-codex-review-comments-for-c-635cab12
- Pair: implement
- Phase ID: harden-opensky-and-orientation
- Phase Directory Key: harden-opensky-and-orientation
- Phase Title: Harden OpenSky bbox and orientation readiness
- Scope: phase-local authoritative verifier artifact

- `IMP-001` (`blocking`) `lib/sensors/orientation.ts:341` / `subscribeToOrientationPose()`: the new stream lock fixes mixed-history samples, but it still commits to `deviceorientation` on the first valid relative event and permanently ignores a later valid `deviceorientationabsolute` sample. On browsers that emit relative data first and absolute data moments later, this violates the accepted requirement to prefer the absolute stream when it becomes usable and only fall back to `deviceorientation` when absolute never becomes usable. Minimal fix: keep the non-mixing lock, but add a short bounded fallback window (or equivalent pending-selection state) so a valid absolute sample can win before the code locks to `deviceorientation`; add a unit test that emits valid relative data first and valid absolute data shortly afterward.
- Re-review cycle 2: `IMP-001` is addressed by the bounded relative fallback window plus the added late-absolute and relative-only tests; no additional findings.
