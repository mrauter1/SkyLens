# Autoloop Task: Implement SkyLensServerless Scope Realism Final v5

Implement the PRD/ARD located at:
- `SkyLensServerless/scope-realism-final-v5-prd-ard.md`

## Execution contract
- Treat the PRD/ARD file above as the single source of truth.
- Implement all in-scope requirements and acceptance criteria.
- Respect locked decisions and non-negotiable guardrails.
- Keep behavior deterministic and test-stable.
- Do not add any `.bin` artifacts.

## Required implementation surfaces
- `SkyLensServerless/components/viewer/scope-star-canvas.tsx`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/lib/viewer/settings.ts`
- `SkyLensServerless/components/settings/settings-sheet.tsx`
- Scoped tests in `SkyLensServerless/tests/unit/` as specified by PRD/ARD.

## Mandatory testing
Run at minimum:
- `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/settings-sheet.test.tsx`

Also run broader scoped tests if needed to validate no regressions.

## Completion checks
- Verify compatibility/migration behavior for settings.
- Verify no `.bin` files were added.
- Ensure final implementation aligns with all PRD/ARD acceptance criteria.
