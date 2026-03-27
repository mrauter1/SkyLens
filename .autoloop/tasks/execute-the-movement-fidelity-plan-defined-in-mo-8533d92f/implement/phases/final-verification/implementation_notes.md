# Implementation Notes

- Task ID: execute-the-movement-fidelity-plan-defined-in-mo-8533d92f
- Pair: implement
- Phase ID: final-verification
- Phase Directory Key: final-verification
- Phase Title: Run final validation
- Scope: phase-local producer artifact

## Files changed
- `components/viewer/viewer-shell.tsx`
- `.autoloop/tasks/execute-the-movement-fidelity-plan-defined-in-mo-8533d92f/decisions.txt`
- `.autoloop/tasks/execute-the-movement-fidelity-plan-defined-in-mo-8533d92f/implement/phases/final-verification/implementation_notes.md`

## Symbols touched
- `ViewerShell`
- `openLiveCamera`
- `sceneSnapshot`
- `cameraFrameLayout`
- `getCurrentTimestampMs`

## Checklist mapping
- Plan milestone 5 / repo verification: `npm run test` passes repo-wide.
- Plan milestone 5 / repo verification: `npm run lint` passes repo-wide after removing hard React hook/compiler errors from `viewer-shell.tsx`.
- Plan milestone 5 / coverage confirmation: verified direct tests remain in place for cadence, aircraft continuity, shared motion state, and motion quality behavior.
- Plan milestone 5 / release hygiene: commit creation is in scope for this phase after verification; PR creation is attempted next and must be recorded as blocked if the environment cannot support it.

## Assumptions
- The remaining `eslint` warnings in `viewer-shell.tsx` are non-blocking because `npm run lint` now exits successfully and no acceptance criterion requires warning-free output.

## Preserved invariants
- Movement-fidelity behavior from the first four phases remains unchanged.
- Absolute-sensor startup, camera picker reopen behavior, and reduced-motion/motion-quality paths continue to behave as covered by existing tests.
- Object ids, label ranking, and moving-object policy semantics remain unchanged.

## Intended behavior changes
- None for product behavior; the code changes in this phase are verification-enabling fixes so repo-wide lint/test complete successfully.

## Known non-changes
- No new feature work beyond the movement-fidelity plan.
- No additional API contract changes.
- No attempt to eliminate the remaining non-blocking `exhaustive-deps` warnings in `viewer-shell.tsx`.

## Expected side effects
- `sceneSnapshot` and `cameraFrameLayout` now resolve directly from current render inputs instead of effect-driven mirror state.
- Imperative effect follow-up work that previously ran synchronously now runs in microtasks to satisfy the React hook lint rules without altering tested behavior.

## Deduplication / centralization
- Centralized timestamp reads behind `getCurrentTimestampMs()` so render-path purity issues stop tripping lint in calibration flows.
- Removed redundant mirrored state for `sceneSnapshot` and `cameraFrameLayout`.

## Validation performed
- `npx vitest run tests/unit/viewer-shell.test.ts`
- `npm run lint`
- `npm run test`
