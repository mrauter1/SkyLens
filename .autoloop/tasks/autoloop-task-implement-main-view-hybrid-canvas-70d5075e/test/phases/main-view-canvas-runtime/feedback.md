# Test Author ↔ Test Auditor Feedback

- Task ID: autoloop-task-implement-main-view-hybrid-canvas-70d5075e
- Pair: test
- Phase ID: main-view-canvas-runtime
- Phase Directory Key: main-view-canvas-runtime
- Phase Title: Split non-scope deep stars onto a visual-only canvas surface
- Scope: phase-local authoritative verifier artifact

- Added `tests/unit/main-star-canvas.test.tsx` to cover shared star-point canvas draw semantics, clamp behavior, and DPR sizing.
- Expanded `tests/unit/viewer-shell-scope-runtime.test.tsx` to cover non-scope deep-star canvas-only rendering across `center_only`, `on_objects`, and `top_list`, plus DOM-only visible-marker diagnostics.
- Validation run: targeted `npm test -- tests/unit/main-star-canvas.test.tsx tests/unit/scope-star-canvas.test.tsx tests/unit/viewer-shell-scope-runtime.test.tsx` and full `npm test`; both passed.
- TST-000 | non-blocking | No audit findings. The tests cover the changed non-scope canvas path, preserve all required label modes and center-lock participation, guard the DOM-marker removal, and stabilize the diagnostics assertion by opening the panel surface that renders it.
