# Test Author ↔ Test Auditor Feedback

- Task ID: task-implement-main-viewer-optics-unification-sk-d0e30232
- Pair: test
- Phase ID: validate-optics-regressions
- Phase Directory Key: validate-optics-regressions
- Phase Title: Validate Coverage And Runtime Behavior
- Scope: phase-local authoritative verifier artifact

- Added coverage for shared quick-control rebinding between main-view runtime optics and persisted scope optics, plus main-view HYG deep-star center-lock/label participation without scope mode.
- Corrected the Playwright reload expectation so persisted scope optics remain visible after reload while scope mode is still enabled, and main-view defaults reappear only after toggling scope mode off.
- Validation status: targeted Vitest slices passed; direct single-test Playwright selection works, but Chromium launch is still blocked here by missing `libatk-1.0.so.0`.

- TST-001 non-blocking — Browser validation environment: the updated Playwright reload test is correctly scoped and wired, but browser execution remains blocked by the runner’s missing `libatk-1.0.so.0`. The current artifact already records this accurately; rerun the direct `pnpm exec playwright test ... -g "..."` command once Chromium system libraries are available to convert the coverage from launch-verified to fully executed.
