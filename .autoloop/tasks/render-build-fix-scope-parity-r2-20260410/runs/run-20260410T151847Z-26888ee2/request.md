# Autoloop Task: Fix Render build stall and apply review follow-ups

## Context
Render deploys for `SkyLensServerless` stall at:
- `next build`
- `Creating an optimized production build ...`

Local investigation indicates webpack reports Node scheme errors via `satellite.js` package runtime imports:
- `node:module`
- `node:worker_threads`

Import trace reaches:
- `SkyLensServerless/lib/vendor/satellite.ts`
- `SkyLensServerless/lib/viewer/motion.ts`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`

## Required changes
1. **Fix build root cause for static export + Next 16 production build**
   - Update `SkyLensServerless/lib/vendor/satellite.ts` to avoid top-level `satellite.js` import path that pulls wasm/node runtime modules into client build.
   - Use browser-safe import paths that do not resolve `node:` scheme modules in Next build.

2. **Apply related review-requested fixes already discussed**
   - Keep scope-mode parity behavior (non-bright classes in lens) while preserving wide-stage ownership/sizing/highlighting separation.
   - Do not regress interaction-surface handling for selected/hovered summaries.

3. **Stabilize tests only as needed for deterministic validation**
   - Update tests impacted by the build-safe satellite import correction.
   - Avoid broad unrelated refactors.

## Validation requirements
Run and report at least:
- `cd SkyLensServerless && npm run build`
- focused viewer tests relevant to touched behavior
- if feasible, root settings tests touched by recent parity changes

## Constraints
- Implement only via autoloop workflow.
- Use plan, implement, test pairs.
- full-auto answers enabled.
- do not set max-iterations.
