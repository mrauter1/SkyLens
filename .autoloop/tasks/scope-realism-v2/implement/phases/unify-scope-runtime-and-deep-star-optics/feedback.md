# Implement ↔ Code Reviewer Feedback

- Task ID: scope-realism-v2
- Pair: implement
- Phase ID: unify-scope-runtime-and-deep-star-optics
- Phase Directory Key: unify-scope-runtime-and-deep-star-optics
- Phase Title: Apply canonical scope optics across runtime projection, deep-star filtering, and rendering
- Scope: phase-local authoritative verifier artifact

- IMP-001 | non-blocking | No blocking findings. `viewer-shell.tsx` now keeps the magnification-derived effective scope FOV as the shared input for projection/band/tile consumers, applies deep-star optics only after the existing daylight gate plus an explicit horizon check, and carries `scopeRender` metadata through to the canvas payload. `scope-star-canvas.tsx` consumes profile-driven `intensity/corePx/haloPx` with compact two-pass rendering, and the updated tests cover deep-star retention, photometry response, magnification-driven spacing, unchanged daylight suppression, and the legacy settings/UI regression suites already established in the prior phase.
