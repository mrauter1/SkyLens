# Autoloop Task: Review, fix, and implement deep-stars normal/scope controls + desktop defaults (SkyLensServerless)

## Execution requirements
- Run with **full_auto answers enabled**.
- Run with **pairs: plan,implement,test**.
- Do **not** set max_iterations.
- Perform implementation only through autoloop for this task.

## Objective
Re-review the current implementation against this specification, identify any mismatches/regressions, and ship fixes.

## Required behavior
1. **Independent apertures by mode**
   - Scope mode and normal view aperture values must be independent persisted values.
   - The active aperture slider should control only the active mode’s aperture.
   - Minimum aperture must be below 40mm.

2. **Normal-view magnification policy**
   - Normal view magnification is fixed at 1x.
   - Normal-view magnification control must be hidden.
   - Scope-mode magnification remains visible and functional.

3. **Desktop default panel behavior**
   - Desktop Current Focus / Next Action panel must be closed by default.
   - Default bottom actions shown: Open Viewer, Align, Enable AR, Scope.
   - Opening the panel should restore expected content and interactions.

4. **Deep-star behavior integrity**
   - Aperture-driven deep-star emergence in normal view remains visible and mode-correct.
   - Center-lock eligibility remains aligned to rendered/visible objects.
   - Scope-mode deep-star behavior must not regress.

5. **Deep-star naming**
   - Preserve/verify naming flow from names table (`nameId -> names table lookup`) and ensure no regressions in displayName plumbing.

## Files in scope
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/lib/viewer/scope-optics.ts`
- `SkyLensServerless/lib/viewer/settings.ts`
- Relevant unit tests under `SkyLensServerless/tests/unit/`

## Validation requirements
Update/add tests to prove all behavior above and run:
- `pnpm --dir SkyLensServerless exec vitest run tests/unit/scope-optics.test.ts`
- `pnpm --dir SkyLensServerless exec vitest run tests/unit/viewer-settings.test.tsx`
- `pnpm --dir SkyLensServerless exec vitest run tests/unit/viewer-shell-scope-runtime.test.tsx`
- `pnpm --dir SkyLensServerless exec vitest run tests/unit/viewer-shell-celestial.test.ts`
- `pnpm --dir SkyLensServerless exec vitest run tests/unit/viewer-shell.test.ts`
- `pnpm --dir SkyLensServerless test`

## Acceptance criteria
- Implementation matches all required behavior above.
- Targeted and full test runs pass.
- Changes are minimal, coherent, and confined to relevant files.
