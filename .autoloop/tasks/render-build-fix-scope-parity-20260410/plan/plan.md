# Render build stall + scope parity plan

## Objective
Restore `SkyLensServerless` production builds by removing the client-visible `satellite.js` package-root import that drags Node-only runtime modules into the Next 16 static export build, while preserving the recently reviewed scope-mode parity behavior and selected/hovered summary handling.

## Scope
- In scope:
  - `SkyLensServerless/lib/vendor/satellite.ts` import strategy.
  - Any minimal companion changes in `SkyLensServerless/lib/viewer/motion.ts` needed to keep the wrapper types and call sites stable.
  - Scope-mode stage/lens rendering and interaction logic in `SkyLensServerless/components/viewer/viewer-shell.tsx` only where required to preserve reviewed parity behavior.
  - Focused `SkyLensServerless` tests that cover the build-safe satellite wrapper and scope-mode viewer behavior.
- Out of scope:
  - Broad viewer refactors, scope optics redesign, or unrelated label/layout behavior changes.
  - Any non-minimal migration of satellite propagation logic away from `satellite.js`.

## Implementation slice
1. Build-safe satellite wrapper
   - Replace the package-root `satellite.js` re-export in `SkyLensServerless/lib/vendor/satellite.ts` with browser-safe subpath imports that expose only the functions/types already consumed by `lib/viewer/motion.ts`.
   - Keep the wrapper API stable for `degreesToRadians`, `ecfToLookAngles`, `eciToEcf`, `gstime`, `propagate`, `radiansToDegrees`, `twoline2satrec`, and `SatRec` so downstream motion code does not need broad churn.
   - If the chosen subpath layout changes how `SatRec` is imported, confine the type adaptation to the vendor wrapper or `lib/viewer/motion.ts`.
2. Scope-mode parity and interaction safety
   - Preserve the current reviewed contract where scope mode can widen candidate membership for lens/top-list behavior without moving wide-stage ownership of sizing, highlight state, clickability, and center-lock presentation.
   - Keep non-bright classes available inside the scope lens so center-lock winners and lens markers stay visually aligned with normal-view classes.
   - Preserve selected-detail ownership separate from hover-driven desktop summary updates; hover may swap the summary target, but must not clear explicit selection state or break scope/outside-lens marker interaction.
3. Deterministic validation
   - Update only the tests directly affected by the wrapper import change and any parity assertions that need to codify the intended stage/lens split.
   - Prefer existing viewer-shell celestial/scope-runtime tests over new broad harnesses.

## Interfaces and invariants
- `SkyLensServerless/lib/vendor/satellite.ts` remains the only viewer-facing import surface for satellite propagation helpers in this slice.
- `resolveSatelliteMotionObjects` behavior stays functionally unchanged: same inputs, same filtering, same motion metadata semantics.
- In scope mode:
  - Wide-stage markers remain the source of truth for stage sizing, highlight ownership, and pointer interaction.
  - Scope-lens markers may include widened/non-bright candidates, but must not suppress wide-stage markers that stay outside the lens.
  - Selected detail remains bound to explicit selection, while desktop active summary may follow hover/center-lock.

## Regression risks and controls
- Risk: browser-safe import path still resolves a package entry that references `node:` modules.
  - Control: validate with `cd SkyLensServerless && npm run build`; keep the wrapper limited to explicit browser-safe subpaths.
- Risk: parity fix accidentally re-couples stage highlight ownership to scope-lens membership.
  - Control: preserve and, if needed, update tests covering non-bright lens markers, wide-stage visibility/clickability outside the lens, and wide-baseline sizing in scope mode.
- Risk: summary/selection handling regresses when hovered objects differ from the explicit selection.
  - Control: retain the desktop summary test that verifies hover focus does not clear selected detail.

## Validation
- Required:
  - `cd SkyLensServerless && npm run build`
  - Focused viewer tests in `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  - Focused parity/runtime tests in `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
  - Focused scope runtime tests in `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Root `[tests/unit/viewer-settings.test.tsx](/workspace/SkyLens/tests/unit/viewer-settings.test.tsx)` as the requested regression check for recent parity-related settings behavior when it is feasible in the execution environment.
- If the root settings test cannot be run, later phases must report the concrete infeasibility reason rather than silently dropping that check.

## Rollback
- Revert the vendor wrapper and any tightly coupled motion import adjustments together if the new subpath strategy fails build or changes propagation behavior.
- Revert any scope-mode parity edits independently from the wrapper fix if viewer interaction/highlighting regressions appear during focused tests.
