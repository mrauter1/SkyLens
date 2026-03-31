# Test Strategy

- Task ID: skylensserverless-ux-implementation
- Pair: test
- Phase ID: finalize-ux-contract
- Phase Directory Key: finalize-ux-contract
- Phase Title: Finalize and verify the SkyLensServerless UX contract
- Scope: phase-local producer artifact

## Behavior-to-Coverage Map

- AC-1 Overlay dismiss policy
  - `tests/unit/settings-sheet.test.tsx`
  - `tests/unit/viewer-shell.test.ts`
  - `tests/e2e/demo.spec.ts`
  - `tests/e2e/permissions.spec.ts`
  - Covers backdrop close, Escape close, inner-panel click immunity, and guarded alignment-focus non-dismiss behavior.

- AC-2 Focus restoration
  - `tests/unit/settings-sheet.test.tsx`
  - `tests/unit/viewer-shell.test.ts`
  - `tests/e2e/demo.spec.ts`
  - `tests/e2e/permissions.spec.ts`
  - Covers opener restore, opener-unmount fallback, and alignment/settings return targets.

- AC-3 Next-step and banner determinism
  - `tests/unit/alignment-tutorial.test.ts`
  - `tests/unit/viewer-shell-resolvers.test.ts`
  - Covers one primary step, supporting notice constraints, prioritized primary banner selection, and deterministic overflow ordering.

- AC-4 Desktop hierarchy and mobile reachability
  - `tests/unit/viewer-shell.test.ts`
  - `tests/e2e/demo.spec.ts`
  - `tests/e2e/landing.spec.ts`
  - `tests/e2e/permissions.spec.ts`
  - Covers compact desktop viewer hierarchy, landing CTA prominence, short-viewport mobile overlay reachability, and preserved compact sheet behavior.

- AC-5 Full validation contract
  - `tests/unit/settings-sheet.test.tsx`
  - `tests/unit/alignment-tutorial.test.ts`
  - `tests/unit/viewer-shell-resolvers.test.ts`
  - `tests/unit/viewer-shell.test.ts`
  - `tests/e2e/demo.spec.ts`
  - `tests/e2e/permissions.spec.ts`
  - `tests/e2e/landing.spec.ts`
  - Covers the required authoritative package-local unit and Chromium Playwright evidence.

## Preserved Invariants Checked

- Stable selector contract remains intact for `mobile-viewer-overlay*`, `mobile-alignment-overlay*`, `settings-sheet-*`, `alignment-start-action`, `viewer-top-warning-stack`, and `desktop-open-viewer-action`.
- Product behavior remains unchanged outside the requested UX contract; the final fix stayed in `tests/unit/viewer-shell.test.ts`.
- Shared resolver ownership remains in existing local seams; no duplicated banner or next-step assertions were introduced.

## Edge Cases and Failure Paths

- Late-file `viewer-shell` regressions cover timeout-prone render-loop paths:
  - scheduled `requestVideoFrameCallback`
  - one-shot relative-sensor emission
  - estimated-aircraft selected-detail rendering under a controlled demo clock
- Playwright coverage confirms the provisioned Chromium environment still exercises demo, permissions, and landing flows after the test-harness stabilization.

## Stabilization Notes

- The selected-aircraft detail regression now runs under `vi.useFakeTimers()` plus the existing `installAnimationFrameClock()` helper so the demo scene clock is deterministic in both focused and full-file runs.
- Full authoritative validation was rerun from `/workspace/SkyLens/SkyLensServerless` after the refinement.

## Known Gaps

- No new product-path gaps identified in this phase.
