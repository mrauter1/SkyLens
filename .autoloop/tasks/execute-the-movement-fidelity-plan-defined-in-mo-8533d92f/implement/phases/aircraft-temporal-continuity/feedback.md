# Implement ↔ Code Reviewer Feedback

- Task ID: execute-the-movement-fidelity-plan-defined-in-mo-8533d92f
- Pair: implement
- Phase ID: aircraft-temporal-continuity
- Phase Directory Key: aircraft-temporal-continuity
- Phase Title: Smooth aircraft motion between snapshots
- Scope: phase-local authoritative verifier artifact

- `IMP-001` `blocking` [lib/aircraft/client.ts] `resolveAircraftRenderState` marks fresh current-only aircraft as `stale` whenever they are in the entry fade and `headingDeg` / `velocityMps` are unavailable. In the current-only branch, `motionOpacity < 1 && !deadReckoned.didDeadReckon` collapses both “newly entering” and “actually stale” into the same stale state. Concrete failure: an aircraft that has just appeared in the latest snapshot, but lacks motion fields from the backend, will immediately render with the stale badge/sublabel even though the data is fresh. Minimal fix: separate entry-fade state from stale decay and only emit `stale` when snapshot age has crossed the stale threshold or when rendering previous-only fade-out records.
- `IMP-002` `non-blocking` [lib/aircraft/client.ts, lib/aircraft/opensky.ts] The implementation duplicates substantial aircraft geodesic helpers (`getSurfaceDistanceMeters`, `getBearingDeg`, angle/rounding helpers, and forward projection math) instead of sharing one local source of truth. That raises drift risk ahead of the planned phase-3 motion centralization because the same aircraft geometry rules now live in two modules. Minimal fix: extract the shared aircraft geo helpers into a local utility or make the later motion module explicitly own and replace both copies.

Re-review note, verifier cycle 2:
- `IMP-001` was rechecked after the producer patch and is resolved. The current-only branch now keys `stale` off snapshot-age decay instead of entry fade, and `tests/unit/aircraft-layer.test.ts` now covers the fresh-without-motion-fields case directly.
