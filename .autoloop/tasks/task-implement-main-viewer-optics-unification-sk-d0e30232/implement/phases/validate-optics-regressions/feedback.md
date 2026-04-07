# Implement ↔ Code Reviewer Feedback

- Task ID: task-implement-main-viewer-optics-unification-sk-d0e30232
- Pair: implement
- Phase ID: validate-optics-regressions
- Phase Directory Key: validate-optics-regressions
- Phase Title: Validate Coverage And Runtime Behavior
- Scope: phase-local authoritative verifier artifact

- IMP-001 non-blocking — Validation command / [implementation_notes.md](/workspace/SkyLens/.autoloop/tasks/task-implement-main-viewer-optics-unification-sk-d0e30232/implement/phases/validate-optics-regressions/implementation_notes.md#L50): The recorded Playwright command was described as targeting the single optics reload test, but `pnpm test:e2e -- tests/e2e/demo.spec.ts -g "..."` forwards an extra `--` to Playwright, so `-g` is not parsed as a filter and the full `demo.spec.ts` file runs instead. This did not change the observed result here because Chromium launch failed before any test body ran, but later reruns will be broader and slower than the notes imply. Minimal fix: record and use a Playwright invocation that does not insert the extra terminator, for example `pnpm exec playwright test tests/e2e/demo.spec.ts -g "main-view optics reset on reload while scope optics stay persisted"`.
