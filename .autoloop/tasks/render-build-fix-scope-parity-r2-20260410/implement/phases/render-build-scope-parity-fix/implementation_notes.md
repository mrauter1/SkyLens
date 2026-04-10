# Implementation Notes

- Task ID: render-build-fix-scope-parity-r2-20260410
- Pair: implement
- Phase ID: render-build-scope-parity-fix
- Phase Directory Key: render-build-scope-parity-fix
- Phase Title: Fix browser-safe satellite import and preserve scope parity
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/lib/vendor/satellite.ts`
- `.autoloop/tasks/render-build-fix-scope-parity-r2-20260410/decisions.txt`
- `.autoloop/tasks/render-build-fix-scope-parity-r2-20260410/implement/phases/render-build-scope-parity-fix/implementation_notes.md`

## Symbols touched
- `degreesToRadians`
- `ecfToLookAngles`
- `eciToEcf`
- `radiansToDegrees`
- `gstime`
- `propagate`
- `twoline2satrec`
- `SatRec`

## Checklist mapping
- Milestone 1 / AC-1 / AC-2: completed by replacing the package-root `satellite.js` re-export with explicit browser-safe dist entrypoints while preserving the wrapper export surface.
- Milestone 2 / AC-3: no code change required; focused serverless parity tests passed unchanged, confirming non-bright lens parity, wide-stage ownership, and stage-surface interaction behavior remain intact.
- Milestone 3 / AC-4: completed with required serverless build plus focused motion, celestial, scope-runtime, and settings validation; also ran the feasible root settings regression.

## Assumptions
- `SkyLensServerless` installs `satellite.js` in its local `node_modules`, matching the root app wrapper pattern already accepted in this repo.

## Preserved invariants
- `SkyLensServerless/lib/viewer/motion.ts` keeps the same local wrapper contract and needed no call-site edits.
- Scope-mode parity for non-bright lens classes remains test-covered and unchanged.
- Wide-stage ownership for sizing, highlighting, and interaction surfaces remains unchanged.

## Intended behavior changes
- Client builds now resolve browser-safe `satellite.js` dist modules instead of the package root, avoiding Node-only runtime module resolution during `next build`.

## Known non-changes
- No `viewer-shell` logic changes.
- No motion algorithm changes.
- No settings contract changes.
- No test expectation changes were required.

## Expected side effects
- `SkyLensServerless` production builds complete successfully under Next 16 static export with the existing viewer behavior preserved.

## Validation performed
- `cd SkyLensServerless && npm run build`
- `cd SkyLensServerless && npx vitest run tests/unit/viewer-motion.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx`
- `cd /workspace/SkyLens && npx vitest run tests/unit/viewer-settings.test.tsx`

## Deduplication / centralization decisions
- Reused the existing root-app `satellite.js` wrapper pattern directly instead of introducing a new abstraction or changing downstream imports.
