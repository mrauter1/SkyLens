# Implementation Notes

- Task ID: improve-orientation-motion-review-fixes
- Pair: implement
- Phase ID: orientation-motion-review-fixes
- Phase Directory Key: orientation-motion-review-fixes
- Phase Title: Fix orientation safety and reset duplication
- Scope: phase-local producer artifact

## Files Changed
- `SkyLensServerless/lib/sensors/orientation.ts`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/orientation.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`

## Symbols Touched
- `subscribeToOrientationPose()`
- `reconcileCompassValidation()`
- `ViewerShell`
- `resetOrientationSessionState()`

## Checklist Mapping
- Compass validation safety: stop Safari compass-backed promotion on the failing sample while keeping the validated-state downgrade threshold intact.
- Viewer reset dedupe: extract the shared local orientation-session reset helper and reuse it in retry and startup/manual reset flows.
- Regression coverage: extend Safari validation sequencing and viewer retry/startup-reset tests.

## Assumptions
- Existing Safari validated-state persistence semantics are intentional, so only per-sample emission changed on failed validation ticks.
- Demo/manual reset should clear stale live orientation diagnostics and restore non-live baseline sensor state without changing route/storage contracts.

## Preserved Invariants
- Safari compass validation still needs three consecutive valid samples before the first absolute upgrade.
- Sustained invalid Safari samples still clear the validated bookkeeping only after the existing threshold.
- Retry and startup/manual reset flows still differ only by the baseline `orientationAbsolute` value they restore.
- Orientation provider ids, arbitration priority, and exported interfaces remain unchanged.

## Intended Behavior Changes
- A Safari compass-backed event sample that fails validation now emits as relative immediately instead of remaining promoted absolute for that tick.
- Viewer retry/startup reset logic now clears the same orientation-session refs and diagnostics state through one helper.

## Known Non-Changes
- No broader provider arbitration refactor.
- No public API, route contract, or storage-schema changes.
- No changes outside `SkyLensServerless/` other than this phase artifact and the shared decisions ledger.

## Expected Side Effects
- During transient Safari compass mismatch, users may see relative fallback immediately while validated state remains eligible to re-promote on later valid samples until the sustained-invalid threshold is reached.
- Viewer retry/manual/demo transitions now clear sample-rate and upgraded-from-relative diagnostics consistently with source/sample resets.

## Validation Performed
- Passed: `cd SkyLensServerless && timeout 120s npx vitest run tests/unit/orientation.test.ts`
- Passed: `cd SkyLensServerless && timeout 60s npx vitest run tests/unit/viewer-shell.test.ts -t "keeps motion-only retries pending until a usable sample arrives"`
- Passed: `cd SkyLensServerless && timeout 60s npx vitest run tests/unit/viewer-shell.test.ts -t "clears stale live sensor state when switching into demo mode"`
- Passed: `cd SkyLensServerless && timeout 120s npx vitest run tests/unit/orientation.test.ts tests/unit/viewer-shell.test.ts -t "(validates Safari compass-backed events before upgrading and downgrades after sustained failure|keeps motion-only retries pending until a usable sample arrives|clears stale live sensor state when switching into demo mode)"`
- Exploratory timeout, not used as the acceptance validation command: `cd SkyLensServerless && timeout 300s npx vitest run tests/unit/viewer-shell.test.ts`

## Deduplication / Centralization
- Kept the orientation reset helper local to `ViewerShell` and parameterized only the baseline absolute flag, matching the scoped plan.
