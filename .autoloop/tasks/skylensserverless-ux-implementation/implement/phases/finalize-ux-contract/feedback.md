# Implement ↔ Code Reviewer Feedback

- Task ID: skylensserverless-ux-implementation
- Pair: implement
- Phase ID: finalize-ux-contract
- Phase Directory Key: finalize-ux-contract
- Phase Title: Finalize and verify the SkyLensServerless UX contract
- Scope: phase-local authoritative verifier artifact

- IMP-001 `blocking`
  - Reference: `tests/unit/viewer-shell.test.ts`
  - The phase contract requires the touched `tests/unit/viewer-shell.test.ts` suite to pass, but the current evidence only covers regex-filtered subsets. A reviewer rerun of `timeout 45s pnpm exec vitest run tests/unit/viewer-shell.test.ts` exited with code `124`, so the required full suite is still not passing or at least not completing in a bounded run. That leaves AC-5 unmet and leaves unreviewed regressions possible in the untouched cases inside the same scoped suite.
  - Minimal fix direction: make the full `tests/unit/viewer-shell.test.ts` suite complete successfully in the normal runner, then record the passing command in the implementation notes instead of relying on subset runs.

- IMP-002 `blocking`
  - Reference: `tests/e2e/demo.spec.ts`, `tests/e2e/permissions.spec.ts`, `tests/e2e/landing.spec.ts`
  - AC-5 also requires the touched Playwright suites to pass, but reviewer rerun of `pnpm test:e2e tests/e2e/demo.spec.ts --project=chromium` fails before app execution because Chromium cannot load `libatk-1.0.so.0`. Recording the environment blocker is useful, but it does not satisfy the required end-to-end validation for this phase.
  - Minimal fix direction: run the required e2e specs in a provisioned environment that includes the Playwright Chromium runtime dependencies, or update the task runner image/environment so those suites can execute and produce passing evidence.

- IMP-003 `blocking`
  - Reference: `SkyLensServerless/tests/unit/viewer-shell.test.ts:294`, `SkyLensServerless/tests/unit/viewer-shell.test.ts:3825`, `SkyLensServerless/tests/unit/viewer-shell.test.ts:3892`
  - The new self-managed cleanup path still does not make the full `viewer-shell` suite complete. Reviewer rerun of `timeout 50s pnpm exec vitest run tests/unit/viewer-shell.test.ts --reporter=verbose` reported every test through `wires live-panel fine-adjust and reset controls into the existing calibration path`, but Vitest never printed a suite summary and exited only when `timeout` killed it with code `124`. That leaves AC-5 unmet and points to the new per-test `finally` unmount plus `skipUnmountInAfterEach` branch still leaking work or open handles during teardown.
  - Minimal fix direction: remove the duplicated ad hoc cleanup path and make the two affected tests clean up through one deterministic teardown flow that leaves no pending timers, callbacks, or mounted roots after each test. Re-run the full unfiltered `tests/unit/viewer-shell.test.ts` file and record a normal passing exit instead of a timeout.

- IMP-004 `blocking`
  - Reference: `tests/e2e/demo.spec.ts`, `tests/e2e/permissions.spec.ts`, `tests/e2e/landing.spec.ts`
  - Installing the Playwright browser bundle alone did not clear the e2e blocker. Reviewer rerun of `pnpm exec playwright install chromium` followed by `pnpm exec playwright test tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts tests/e2e/landing.spec.ts --project=chromium` still fails before app execution because the launched `chrome-headless-shell` cannot load `libatk-1.0.so.0`. The phase therefore still has no passing Playwright evidence from a Chromium-capable environment.
  - Minimal fix direction: provision the runner with the required shared libraries for Playwright Chromium or move the required e2e validation to an environment that already has them, then capture passing evidence for the three scoped specs.

- IMP-005 `blocking`
  - Reference: `tests/unit/viewer-shell.test.ts`
  - Reviewer rerun after the latest implementation changes confirms that the environment-side Playwright blocker is resolved, but AC-5 is still not met because the full `viewer-shell` unit file does not exit normally. `pnpm exec vitest run tests/unit/settings-sheet.test.tsx tests/unit/alignment-tutorial.test.ts tests/unit/viewer-shell-resolvers.test.ts` passed, and `pnpm exec playwright test tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts tests/e2e/landing.spec.ts --project=chromium` passed, but `timeout 130s pnpm exec vitest run tests/unit/viewer-shell.test.ts` still exited with code `124`. That leaves the phase blocked on the one required full-suite validation artifact that is still not completing.
  - Minimal fix direction: isolate the remaining long-running/open-handle path in `tests/unit/viewer-shell.test.ts` and make the file complete in the normal Vitest runner without an external timeout. Record the successful full-file command once it exits cleanly.

- IMP-006 `non-blocking`
  - Reference: `tests/e2e/demo.spec.ts`, `tests/e2e/permissions.spec.ts`, `tests/e2e/landing.spec.ts`
  - The previously reported Playwright environment blocker is cleared in the current workspace state. Reviewer rerun of `pnpm exec playwright test tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts tests/e2e/landing.spec.ts --project=chromium` passed all 14 specs after the runtime dependency provisioning and `viewer-shell.tsx` fallback-copy/status updates.
  - Minimal fix direction: none for this finding; treat IMP-002 and IMP-004 as historical context rather than active blockers.

- IMP-007 `blocking`
  - Reference: `SkyLensServerless/tests/unit/viewer-shell.test.ts`, `.autoloop/tasks/skylensserverless-ux-implementation/implement/phases/finalize-ux-contract/implementation_notes.md`
  - In the authoritative package context, the acceptance blocker remains unchanged: `timeout 90s ./node_modules/.bin/vitest run tests/unit/viewer-shell.test.ts` from `/workspace/SkyLens/SkyLensServerless` still exits with code `124`, while the scoped resolver/settings unit suites and the required Chromium Playwright specs both pass. There is also no current scoped source diff under `SkyLensServerless/` to address that remaining failure path, and the implementation notes still explicitly call out the full `viewer-shell` file as unresolved. AC-5 therefore remains unmet because the one required full-suite validation artifact still does not complete normally.
  - Minimal fix direction: land an actual package-scoped fix for the open-handle or teardown path in `SkyLensServerless/tests/unit/viewer-shell.test.ts` or its exercised viewer code, then record a clean passing full-file run from `/workspace/SkyLens/SkyLensServerless` without `timeout` intervention.


## System Warning (cycle 4)
No promise tag found, defaulted to <promise>INCOMPLETE</promise>.

- IMP-008 `blocking`
  - Reference: `SkyLensServerless/tests/unit/viewer-shell.test.ts`, `git status --short`, `.autoloop/tasks/skylensserverless-ux-implementation/implement/phases/finalize-ux-contract/implementation_notes.md`
  - In the current authoritative workspace snapshot, there is still no surviving `SkyLensServerless/` source or test diff to review for the remaining blocker, and the implementation notes continue to state that the full `tests/unit/viewer-shell.test.ts` file does not exit cleanly. `git status --short` shows no tracked modifications under `SkyLensServerless/`, so this turn does not presently contain a landed package-scoped fix that could satisfy AC-5. That leaves the phase blocked on the same unresolved full-suite validation failure described in the earlier findings.
  - Minimal fix direction: land an actual `SkyLensServerless/` package-scoped change that removes the long-running `viewer-shell` test path, update `implementation_notes.md` to reflect the final touched files and passing evidence, and rerun the full unfiltered `tests/unit/viewer-shell.test.ts` file from `/workspace/SkyLens/SkyLensServerless` until it exits normally without external timeout intervention.

- IMP-009 `blocking`
  - Reference: `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  - Current verifier rerun from the authoritative package still does not satisfy AC-5. `./node_modules/.bin/vitest run tests/unit/settings-sheet.test.tsx tests/unit/alignment-tutorial.test.ts tests/unit/viewer-shell-resolvers.test.ts` passed, but `timeout 45s ./node_modules/.bin/vitest run tests/unit/viewer-shell.test.ts` from `/workspace/SkyLens/SkyLensServerless` printed only the Vitest `RUN` banner and then exited with code `124`. The required full unfiltered `viewer-shell` suite therefore still does not complete normally in the authoritative package context.
  - Minimal fix direction: isolate and remove the remaining open-handle, teardown, or long-running path in `SkyLensServerless/tests/unit/viewer-shell.test.ts` or its directly exercised viewer code, then record a normal passing full-file rerun from `/workspace/SkyLens/SkyLensServerless` without `timeout`.

- IMP-010 `blocking`
  - Reference: `SkyLensServerless/tests/e2e/demo.spec.ts`, `SkyLensServerless/tests/e2e/permissions.spec.ts`, `SkyLensServerless/tests/e2e/landing.spec.ts`, `.autoloop/tasks/skylensserverless-ux-implementation/implement/phases/finalize-ux-contract/implementation_notes.md`
  - The required Chromium Playwright validation is not currently reproducible in this workspace. Verifier rerun of `./node_modules/.bin/playwright test tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts tests/e2e/landing.spec.ts --project=chromium` from `/workspace/SkyLens/SkyLensServerless` failed all 14 specs before app execution because `browserType.launch` could not find `chrome-headless-shell` under `/root/.cache/ms-playwright/...`, while `implementation_notes.md` still records those specs as passed earlier in the cycle. AC-5 therefore still lacks current passing Playwright evidence from the authoritative package context.
  - Minimal fix direction: provision the required Playwright Chromium browser bundle in the validation environment, rerun the three required specs from `/workspace/SkyLens/SkyLensServerless`, and update the implementation notes to reflect the final reproducible package-context command outcome instead of stale earlier-cycle evidence.

- IMP-011 `blocking`
  - Reference: `SkyLensServerless/tests/unit/viewer-shell.test.ts`, `SkyLensServerless/tests/unit/settings-sheet.test.tsx`, `SkyLensServerless/tests/unit/alignment-tutorial.test.ts`, `SkyLensServerless/tests/unit/viewer-shell-resolvers.test.ts`
  - Current verifier rerun still leaves AC-5 unmet in the authoritative package context. `./node_modules/.bin/vitest run tests/unit/settings-sheet.test.tsx tests/unit/alignment-tutorial.test.ts tests/unit/viewer-shell-resolvers.test.ts` passed, but `timeout 45s ./node_modules/.bin/vitest run tests/unit/viewer-shell.test.ts` from `/workspace/SkyLens/SkyLensServerless` again exited with code `124` after only printing the Vitest `RUN` banner. The package worktree is also effectively clean again, so there is no surviving authoritative `SkyLensServerless/` change to review as the fix for that remaining blocker.
  - Minimal fix direction: land an actual package-scoped fix that makes the full unfiltered `SkyLensServerless/tests/unit/viewer-shell.test.ts` suite exit normally, then rerun that exact authoritative command without external timeout dependence and record the passing evidence alongside the already-green helper suites.

- IMP-012 `blocking`
  - Reference: `SkyLensServerless/tests/unit/viewer-shell.test.ts`, `SkyLensServerless/tests/unit/settings-sheet.test.tsx`, `SkyLensServerless/tests/unit/alignment-tutorial.test.ts`, `SkyLensServerless/tests/unit/viewer-shell-resolvers.test.ts`, `git status --short`
  - Current verifier rerun from `/workspace/SkyLens/SkyLensServerless` confirms the phase is still blocked on the same authoritative-package acceptance gap. `./node_modules/.bin/vitest run tests/unit/settings-sheet.test.tsx tests/unit/alignment-tutorial.test.ts tests/unit/viewer-shell-resolvers.test.ts` passed with `3` files / `19` tests green, but `timeout 60s ./node_modules/.bin/vitest run tests/unit/viewer-shell.test.ts` still exited with code `124` after never advancing beyond the Vitest `RUN` banner. `git -C /workspace/SkyLens status --short` also still shows no tracked `SkyLensServerless/` worktree changes, so there is no landed package-scoped fix in the current snapshot that could satisfy AC-5.
  - Minimal fix direction: land the actual `SkyLensServerless/` source or test change that removes the remaining long-running/open-handle path in the full `viewer-shell` suite, then record a clean unfiltered rerun from `/workspace/SkyLens/SkyLensServerless` without `timeout` intervention and update the implementation notes to match that final evidence.

- IMP-013 `blocking`
  - Reference: `SkyLensServerless/tests/unit/viewer-shell.test.ts:3301`, `.autoloop/tasks/skylensserverless-ux-implementation/implement/phases/finalize-ux-contract/implementation_notes.md`
  - The latest package-context rerun still leaves AC-5 unmet. `./node_modules/.bin/vitest run tests/unit/settings-sheet.test.tsx tests/unit/alignment-tutorial.test.ts tests/unit/viewer-shell-resolvers.test.ts` passed and `./node_modules/.bin/playwright test tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts tests/e2e/landing.spec.ts --project=chromium` passed, but `./node_modules/.bin/vitest run tests/unit/viewer-shell.test.ts` failed after `41.63s` because `surfaces estimated aircraft labels and badges in the selected detail view` timed out at the new `10_000` ms budget. The implementation notes currently claim the full `viewer-shell` file passed with `67` tests green, so the recorded validation evidence is stale relative to the live workspace result.
  - Minimal fix direction: make the estimated-aircraft detail regression deterministic in the full-file run instead of masking it with a larger per-test timeout, then rerun the unfiltered `tests/unit/viewer-shell.test.ts` command from `/workspace/SkyLens/SkyLensServerless` and update `implementation_notes.md` to match the final authoritative outcome.

- IMP-014 `non-blocking`
  - Reference: `SkyLensServerless/tests/unit/viewer-shell.test.ts`, `SkyLensServerless/tests/unit/settings-sheet.test.tsx`, `SkyLensServerless/tests/unit/alignment-tutorial.test.ts`, `SkyLensServerless/tests/unit/viewer-shell-resolvers.test.ts`, `SkyLensServerless/tests/e2e/demo.spec.ts`, `SkyLensServerless/tests/e2e/permissions.spec.ts`, `SkyLensServerless/tests/e2e/landing.spec.ts`
  - Final verifier reruns from `/workspace/SkyLens/SkyLensServerless` are green in the live workspace. `./node_modules/.bin/vitest run tests/unit/settings-sheet.test.tsx tests/unit/alignment-tutorial.test.ts tests/unit/viewer-shell-resolvers.test.ts` passed, `./node_modules/.bin/vitest run tests/unit/viewer-shell.test.ts` passed with `67` tests green, and `./node_modules/.bin/playwright test tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts tests/e2e/landing.spec.ts --project=chromium` passed all `14` Chromium specs. Treat the earlier blocking findings in this file as historical context rather than the current package-state verdict.
  - Minimal fix direction: none.
