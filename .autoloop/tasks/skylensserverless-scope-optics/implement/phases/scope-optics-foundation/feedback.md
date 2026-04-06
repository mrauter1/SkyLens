# Implement ↔ Code Reviewer Feedback

- Task ID: skylensserverless-scope-optics
- Pair: implement
- Phase ID: scope-optics-foundation
- Phase Directory Key: scope-optics-foundation
- Phase Title: Settings and Optics Foundation
- Scope: phase-local authoritative verifier artifact

- IMP-001 | non-blocking | [components/viewer/viewer-shell.tsx] duplicates the `scopeOptics` object shape inline inside `buildSceneSnapshot` instead of reusing the shared `ScopeOpticsSettings` type. This is minor drift risk for the next phase, where more optics-related viewer wiring is expected. Minimal fix: import and reuse `ScopeOpticsSettings` for that function signature.
- IMP-002 | non-blocking | [lib/viewer/scope-optics.ts] assumes pre-normalized optics values for its public helpers. The current call path is safe because settings and the star pipeline normalize first, but a future direct caller could feed zero or negative aperture/magnification and get `NaN`/`-Infinity` from `Math.log10`. Minimal fix: either document the normalized-input precondition in the module or clamp/normalize at the helper boundary.
