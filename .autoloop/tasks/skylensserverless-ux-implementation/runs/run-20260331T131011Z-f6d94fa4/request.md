# SkyLensServerless UX Implementation Task (Autoloop)

## Context
The previous PR only added documentation (`SKYLENSSERVERLESS_UX_10X_PLAN.md`) and was unsatisfactory.
Implement the actual product/UI changes in **SkyLensServerless**.

## Goal
Deliver the UX improvements described in the plan with production-quality code and tests.

## Required outcomes
1. Overlays are **full-height sheets** (use full vertical space), but **not full-screen takeovers**.
2. Settings and relevant overlays close on clicking outside (policy-based exceptions allowed for critical steps).
3. Instructions show only the **single next step** with one primary CTA per state.
4. Banner clutter is reduced via prioritization/collapse (single primary actionable banner by default).
5. Desktop landing/banner hierarchy is reduced in visual dominance and clutter.
6. Mobile behavior must remain stable and not regress.

## Implementation scope
- `SkyLensServerless/components/ui/compact-mobile-panel-shell.tsx`
- `SkyLensServerless/components/settings/settings-sheet.tsx`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/lib/viewer/alignment-tutorial.ts`
- `SkyLensServerless/components/landing/landing-screen.tsx`
- Relevant unit and e2e tests under `SkyLensServerless/tests/`

## Quality bar
- Keep accessibility and focus management correct.
- Preserve/adjust test IDs as needed and update tests accordingly.
- Ensure deterministic behavior for banner/next-step resolution.

## Test expectations
Run and pass relevant unit and e2e checks for touched behavior. Include regression coverage for:
- Outside click close and escape close behavior
- Focus restoration
- Next-step resolver output
- Banner prioritization
- Mobile overlay flows

## Process constraints
- Use **pairs: plan,implement,test**.
- Do not set max iterations.
- Run in full auto answers mode.
- Implement directly in codebase (no docs-only outcome).

## Run Intent (2026-03-30T11:16:27.251624+00:00)
# Resume SkyLensServerless UX Implementation (Autoloop)

Resume and complete the existing task `skylensserverless-ux-implementation`.

## Objective
Implement actual production code and tests (not docs-only) for SkyLensServerless UX improvements:
1. Full-height sheet overlays (not full-screen takeovers).
2. Outside-click close behavior for settings/relevant overlays with policy-based exceptions.
3. Single next-step primary guidance/CTA model.
4. Prioritized single primary actionable banner by default.
5. Reduced desktop banner/hero dominance and cleaner hierarchy.
6. Preserve mobile behavior and accessibility.

## Required process
- Run with pairs: plan,implement,test.
- Use full-auto answers.
- Do not set max_iterations.
- Complete the run to finished state.

## Required deliverables
- Code changes in SkyLensServerless components/lib as needed.
- Updated/added unit and e2e tests for modified behavior.
- Commit(s) produced by the autoloop flow.

## Run Intent (2026-03-30T11:16:42.606012+00:00)
# Resume SkyLensServerless UX Implementation (Autoloop)

Resume and complete the existing task `skylensserverless-ux-implementation`.

## Objective
Implement actual production code and tests (not docs-only) for SkyLensServerless UX improvements:
1. Full-height sheet overlays (not full-screen takeovers).
2. Outside-click close behavior for settings/relevant overlays with policy-based exceptions.
3. Single next-step primary guidance/CTA model.
4. Prioritized single primary actionable banner by default.
5. Reduced desktop banner/hero dominance and cleaner hierarchy.
6. Preserve mobile behavior and accessibility.

## Required process
- Run with pairs: plan,implement,test.
- Use full-auto answers.
- Do not set max_iterations.
- Complete the run to finished state.

## Required deliverables
- Code changes in SkyLensServerless components/lib as needed.
- Updated/added unit and e2e tests for modified behavior.
- Commit(s) produced by the autoloop flow.

## Run Intent (2026-03-30T11:43:04.798107+00:00)
# SkyLensServerless UX - Execute Implementation Now

Use autoloop to complete actual implementation and tests for the planned SkyLensServerless UX work.

## Must deliver code (not planning-only)
- Implement overlay full-height sheet behavior (not full-screen takeover).
- Implement outside-click close behavior with policy exceptions.
- Implement per-surface focus restoration.
- Implement single next-step guidance/CTA resolver behavior.
- Implement prioritized single primary banner behavior.
- Reduce desktop landing/banner visual dominance.
- Preserve mobile behavior and accessibility.

## Must deliver tests
- Unit/e2e coverage for dismissal, focus restoration, next-step resolver, banner prioritization, and mobile overlay regressions.

## Process requirements
- full auto answers mode
- pairs: plan,implement,test
- do not set max_iterations
- continue until run reaches completed state

## Run Intent (2026-03-30T11:43:15.408106+00:00)
# SkyLensServerless UX - Execute Implementation Now

Use autoloop to complete actual implementation and tests for the planned SkyLensServerless UX work.

## Must deliver code (not planning-only)
- Implement overlay full-height sheet behavior (not full-screen takeover).
- Implement outside-click close behavior with policy exceptions.
- Implement per-surface focus restoration.
- Implement single next-step guidance/CTA resolver behavior.
- Implement prioritized single primary banner behavior.
- Reduce desktop landing/banner visual dominance.
- Preserve mobile behavior and accessibility.

## Must deliver tests
- Unit/e2e coverage for dismissal, focus restoration, next-step resolver, banner prioritization, and mobile overlay regressions.

## Process requirements
- full auto answers mode
- pairs: plan,implement,test
- do not set max_iterations
- continue until run reaches completed state

## Run Intent (2026-03-30T15:16:30.328474+00:00)
# Resume SkyLensServerless UX task and finalize completion

Continue the existing `skylensserverless-ux-implementation` task and resolve remaining blocked/in-progress work.

## Required completion criteria
- Move `finalize-ux-contract` from in_progress to completed.
- Address any inline feedback from prior diffs.
- Keep scope to SkyLensServerless UX changes and associated tests.
- Ensure plan, implement, and test pairs run in sequence.

## Process constraints
- full auto answers enabled
- pairs: plan,implement,test
- do not set max_iterations
- do not stop early while run is active

## Run Intent (2026-03-30T16:24:04.033432+00:00)
# Resume SkyLensServerless UX implementation to completion

Continue task `skylensserverless-ux-implementation` and finish all remaining work without stopping early.

## Required behavior
- Keep scope in SkyLensServerless UX implementation and its tests.
- Address unresolved inline feedback/blockers from prior run artifacts.
- Complete the active phase `finalize-ux-contract`.

## Required validation
- Run full unit validation required by the phase (including full viewer-shell suite, not only filtered subsets).
- Run required Playwright e2e specs in a Chromium-capable environment and record pass evidence.
- Ensure plan, implement, and test pairs execute in sequence.

## Process requirements
- full auto answers enabled.
- pairs: plan,implement,test.
- do not set max_iterations.
- do not stop while run is active.

## Run Intent (2026-03-30T16:24:17.050565+00:00)
# Resume SkyLensServerless UX implementation to completion

Continue task `skylensserverless-ux-implementation` and finish all remaining work without stopping early.

## Required behavior
- Keep scope in SkyLensServerless UX implementation and its tests.
- Address unresolved inline feedback/blockers from prior run artifacts.
- Complete the active phase `finalize-ux-contract`.

## Required validation
- Run full unit validation required by the phase (including full viewer-shell suite, not only filtered subsets).
- Run required Playwright e2e specs in a Chromium-capable environment and record pass evidence.
- Ensure plan, implement, and test pairs execute in sequence.

## Process requirements
- full auto answers enabled.
- pairs: plan,implement,test.
- do not set max_iterations.
- do not stop while run is active.

## Run Intent (2026-03-30T18:31:21.580665+00:00)
# Resume and complete SkyLensServerless UX autoloop run

Continue task `skylensserverless-ux-implementation` to terminal completion.

## Required process
- Use full auto answers mode.
- Use pairs: plan,implement,test.
- Do not set max iterations.
- Do not stop while active.

## Required completion
- Resolve remaining review feedback in `finalize-ux-contract`.
- Reach a terminal autoloop run status (success/blocked/failed) with artifacts recorded.
- Preserve task scope to SkyLensServerless UX and related tests.

## Run Intent (2026-03-30T18:31:35.045964+00:00)
# Resume and complete SkyLensServerless UX autoloop run

Continue task `skylensserverless-ux-implementation` to terminal completion.

## Required process
- Use full auto answers mode.
- Use pairs: plan,implement,test.
- Do not set max iterations.
- Do not stop while active.

## Required completion
- Resolve remaining review feedback in `finalize-ux-contract`.
- Reach a terminal autoloop run status (success/blocked/failed) with artifacts recorded.
- Preserve task scope to SkyLensServerless UX and related tests.

## Run Intent (2026-03-30T21:21:45.581049+00:00)
# Resume SkyLensServerless UX with test-only pair

Run only the `test` pair for task `skylensserverless-ux-implementation`.

## Requirements
- full auto answers mode
- pairs: test only
- no max_iterations override
- continue until terminal run completion and record artifacts

## Run Intent (2026-03-30T21:21:55.837655+00:00)
# Resume SkyLensServerless UX with test-only pair

Run only the `test` pair for task `skylensserverless-ux-implementation`.

## Requirements
- full auto answers mode
- pairs: test only
- no max_iterations override
- continue until terminal run completion and record artifacts

## Run Intent (2026-03-31T03:21:50.307180+00:00)
# Re-run SkyLensServerless UX task after autoloop update

Run the existing task `skylensserverless-ux-implementation` again after updating autoloop.

## Goals
- Continue implementation/test completion for remaining blockers in finalize-ux-contract.
- Preserve scope to SkyLensServerless UX and related tests only.

## Required process
- full auto answers enabled
- pairs: plan,implement,test
- do not set max_iterations
- run until terminal completion

## Run Intent (2026-03-31T13:10:11.055077+00:00)
# SkyLensServerless review validation and fixes via autoloop

Analyze the provided review comments for correctness and applicability, then apply only the correct fixes in scope.

## Mandatory UX requirement
- "No motion" or similar warnings must always remain visible in a very compact way.

## Review items to evaluate and fix if correct
1. Banner primary-selection logic may demote critical non-actionable warnings.
2. Redundant nullish coalescing in desktop primary action kind.
3. Focusable-elements helper missing some focusable types and CSS visibility filtering.
4. Alignment opener surface inference may rely on `document.activeElement` and misclassify mobile taps.
5. Focus-restore predicate may accept non-focusable/hidden targets.

## Scope
- SkyLensServerless/components/viewer/viewer-shell.tsx
- Related tests under SkyLensServerless/tests/unit and e2e as needed

## Process requirements
- full auto answers
- pairs: plan,implement,test
- do not set max_iterations
- complete to terminal run state
