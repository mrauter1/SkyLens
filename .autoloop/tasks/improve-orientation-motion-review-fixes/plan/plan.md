# Orientation Motion Review Fix Plan

## Scope
- Limit implementation to [orientation.ts](/workspace/SkyLens/SkyLensServerless/lib/sensors/orientation.ts), [viewer-shell.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx), and directly affected tests in `SkyLensServerless/tests/unit/`.
- Preserve existing provider arbitration, Safari upgrade/downgrade thresholds, viewer route semantics, and live/manual/demo startup boundaries unless a change is required to stop unsafe absolute promotion.

## Findings
- In [orientation.ts](/workspace/SkyLens/SkyLensServerless/lib/sensors/orientation.ts), `reconcileCompassValidation()` currently keeps promoting compass-backed relative samples to the Safari validated absolute path while `compassValidation.validated` is still true, even when the current sample fails validation and the invalid streak has not yet reached the downgrade threshold.
- The required safety fix is narrower than a full downgrade rewrite: on any failed validation sample after upgrade, emit that sample as relative immediately, but continue tracking invalid streaks so Safari only exits the validated state after the existing sustained-failure threshold.
- In [viewer-shell.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx), the retry-permissions flow and the orientation-controller reset/startup gate both clear the same orientation session fields inline. The only intentional difference is the baseline absolute flag (`false` during retry vs route-derived during startup/manual fallback).
- Existing focused coverage already exercises Safari upgrade/downgrade behavior in [orientation.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/orientation.test.ts) and motion retry/startup behavior in [viewer-shell.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell.test.ts), so the safest plan is to extend those suites rather than add new test files.

## Milestone
### 1. Fix unsafe compass promotion and unify viewer orientation resets
- Update `reconcileCompassValidation()` so a compass-backed event sample that fails Safari validation is never emitted as an absolute promoted sample on that tick.
- Keep the current Safari validation state machine structure:
  - still require consecutive valid samples before first upgrade
  - still allow the validated state to persist until the sustained invalid threshold is reached
  - still reset the validated state only after the existing downgrade threshold
  - still respect the current absolute-upgrade window and provider priority rules
- Keep the downgrade behavior observable as:
  - first invalid sample after validation: emitted as relative immediately
  - repeated invalid samples continue as relative
  - once the invalid threshold is reached, clear the validated bookkeeping so later re-upgrade again requires fresh consecutive valid samples
- Extract the duplicated viewer orientation reset into one local helper in [viewer-shell.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx) that clears the shared orientation session state in one place and accepts the caller-specific baseline absolute value.
- Use that helper from both relevant call sites:
  - retry permissions flow before re-requesting motion/camera/location
  - orientation subscription reset path when live startup stops, restarts, or falls back to manual/non-live handling
- Keep the helper local to `ViewerShell`; do not introduce cross-file abstractions or new shared modules.

## Interface And Compatibility Notes
- `orientation.ts` should not change exported types or provider ids. The fix is internal behavior only.
- `viewer-shell.tsx` should keep the existing component props, route contract, storage behavior, and sensor-controller API unchanged.
- The viewer reset helper should accept only the small caller-controlled difference needed to preserve current behavior, such as the baseline `orientationAbsolute` value to restore.

## Validation Plan
- Extend [orientation.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/orientation.test.ts) to prove:
  - a validated Safari compass path upgrades only after the existing valid-sample threshold
  - the first misaligned compass sample after validation is emitted as relative immediately instead of remaining promoted absolute
  - sustained invalid samples still trigger the existing downgrade/reset behavior, and fresh valid samples are required before any later re-upgrade
- Extend [viewer-shell.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell.test.ts) to prove the shared reset path does not regress startup/retry behavior, with emphasis on clearing stale orientation state before a retry and keeping the viewer pending until a new usable sample arrives.
- Run targeted unit suites for the touched areas first:
  - `npx vitest run tests/unit/orientation.test.ts tests/unit/viewer-shell.test.ts`
- If implementation touches adjacent orientation/viewer behavior beyond those files, run the directly impacted additional unit suites before handing off to the test phase.

## Regression Prevention
- Preserve these invariants:
  - Safari compass-backed samples are never knowingly emitted as absolute when the current sample fails validation.
  - A validated Safari event stream can still upgrade from relative to absolute under the existing consecutive-valid and time-window rules.
  - Provider arbitration, absolute-source priority, and non-Safari event/sensor flows stay unchanged.
  - Viewer retry/startup resets clear the same orientation session slice consistently so stale source/sample/rate state cannot leak across flows.
- Keep changes local and traceable; avoid introducing generic reset utilities or widening the scope into unrelated viewer or sensor refactors.

## Rollout And Rollback
- Rollout is code-only: apply the scoped fixes, run focused unit validation, then rely on the dedicated test phase for the full required checks.
- If regressions appear:
  - revert the compass validation behavior change independently from the viewer reset helper if the issue is isolated to provider arbitration
  - revert the viewer reset helper extraction independently if startup/retry UI state regresses while keeping the orientation safety fix intact

## Risk Register
- R1: Clearing validated status too early could weaken Safari downgrade semantics and block legitimate re-upgrade behavior.
  - Control: keep the existing invalid threshold for clearing validated state, but stop promotion immediately on each failed sample.
- R2: Changing provider promotion paths could accidentally affect non-compass or non-selected providers.
  - Control: constrain the change to the existing Safari compass reconciliation branch and preserve provider id/priority logic elsewhere.
- R3: Consolidating reset logic could accidentally change the one intentional difference between retry and startup reset flows.
  - Control: make the helper parameterize only the baseline absolute value and keep the surrounding caller-specific side effects where they already live.
- R4: Viewer tests could still pass without proving stale state was cleared.
  - Control: extend retry/startup assertions to cover pending-state reset and absence of carried-over orientation state until a new sample arrives.
