# Render Build Stall And Scope-Parity Follow-Ups

## Goal
Ship one bounded serverless change set that restores `SkyLensServerless` production builds on Next 16/static export while preserving the recently reviewed scope-mode parity and interaction-surface behavior.

## Scope
- Update `SkyLensServerless/lib/vendor/satellite.ts` so client code no longer imports the `satellite.js` package root that resolves Node-only runtime modules during `next build`.
- Keep the existing `../vendor/satellite` interface stable for `SkyLensServerless/lib/viewer/motion.ts` and any downstream viewer consumers.
- Preserve scope-mode parity for non-bright classes in the lens while keeping wide-stage ownership for stage sizing, highlighting, and interaction outside the lens.
- Adjust only the tests required to make the build-safe import path and parity expectations deterministic.

## Out Of Scope
- Any broad refactor of viewer motion, scope rendering, or label-ranking architecture.
- Changes to public viewer settings contracts unless a failing test proves a compatibility issue already exists.
- Root-app feature work outside targeted parity/settings regression checks requested for validation.

## Current Findings
- `SkyLensServerless/lib/vendor/satellite.ts` currently re-exports from `'satellite.js'`, which is the import path implicated in the build stall.
- The repo root already uses browser-safe dist imports in `/workspace/SkyLens/lib/vendor/satellite.ts`; that pattern is the lowest-risk baseline for the serverless fork.
- Existing serverless tests already cover the requested parity invariants:
  - non-bright scope center-lock and lens-marker class parity
  - wide-stage visibility/clickability outside the lens
  - wide-stage marker sizing ownership vs magnified lens markers
  - motion-affordance anchoring to the clicked stage marker in scope mode
- Existing serverless settings tests already cover canonical `scopeModeEnabled` precedence over legacy `scope.enabled`, which is the root-side parity check explicitly worth re-running if feasible.

## Implementation Plan
### Milestone 1: Browser-safe satellite wrapper
- Replace the package-root re-export in `SkyLensServerless/lib/vendor/satellite.ts` with explicit browser-safe dist entrypoints that match the root app wrapper.
- Keep exported names and type surface unchanged:
  - `degreesToRadians`
  - `ecfToLookAngles`
  - `eciToEcf`
  - `gstime`
  - `propagate`
  - `radiansToDegrees`
  - `twoline2satrec`
  - `SatRec`
- Verify `SkyLensServerless/lib/viewer/motion.ts` continues to compile without call-site changes.

### Milestone 2: Scope parity and interaction safety
- Review the touched viewer-shell logic only where the build-safe motion path intersects existing scope-mode rendering.
- Preserve these invariants:
  - Non-bright normal-view winners keep the same visual class treatment when mirrored into scope lens markers.
  - Wide-stage markers remain the owner of stage sizing and wide-scene highlight state.
  - Objects outside the lens remain stage-visible and stage-clickable in scope mode.
  - Selected/hovered summary and motion-affordance anchoring continue to use the stage interaction surface rather than silently switching to scope-only ownership.
- Limit code changes to local fixes if tests expose drift; do not redesign the interaction model.

### Milestone 3: Deterministic validation
- Run `cd SkyLensServerless && npm run build`.
- Run focused serverless tests:
  - `tests/unit/viewer-motion.test.ts`
  - `tests/unit/viewer-shell-celestial.test.ts`
  - `tests/unit/viewer-shell-scope-runtime.test.tsx`
- If feasible in time/environment, run the requested root settings regression covering canonical scope-mode precedence.
- Update/add tests only when the import correction or a parity fix changes deterministic expectations.

## Interfaces And Compatibility
- Internal module contract only: `SkyLensServerless/lib/vendor/satellite.ts` must preserve its existing named exports and `SatRec` type export so `lib/viewer/motion.ts` remains unchanged.
- No intended user-facing behavior changes, persisted-data migrations, route changes, or config changes.
- Compatibility note: using explicit browser dist entrypoints narrows resolution to the browser-safe subset intentionally required by the static-export client build; this is acceptable because current consumers are client-safe motion calculations.

## Regression Risks And Controls
- Risk: importing the wrong `satellite.js` subpath could fix the webpack stall but break runtime propagation or types.
  - Control: mirror the already-working root wrapper export map and validate with `viewer-motion` tests plus `next build`.
- Risk: parity follow-up edits could collapse wide-stage vs scope-lens ownership again.
  - Control: keep viewer-shell changes minimal and rely on existing targeted celestial/scope-runtime tests that assert class parity, outside-lens clickability, marker sizing, and motion-affordance anchoring.
- Risk: legacy settings compatibility could regress if scope-mode parity edits touch persisted settings assumptions.
  - Control: re-run the canonical-vs-legacy scope settings test if feasible; avoid settings contract edits unless required.

## Rollout / Rollback
- Rollout: land the wrapper correction and any minimal viewer/test fixes together as one change set so build validation and parity validation describe the same state.
- Rollback: revert the serverless wrapper path change and any directly associated viewer/test edits if production build still fails or motion calculations regress.
- Do not rollback unrelated viewer scope-mode behavior without reproducing a regression in the targeted tests above.

## Acceptance Checklist
- `SkyLensServerless` production build no longer stalls on Node-scheme module resolution from `satellite.js`.
- `SkyLensServerless/lib/viewer/motion.ts` keeps using the same local wrapper contract.
- Scope-mode parity remains intact for non-bright lens classes, wide-stage sizing/highlighting ownership, and selected/hovered summary interaction surfaces.
- Validation includes the required serverless build plus focused viewer tests, with root settings regression coverage if feasible.
