Autoloop implementation task.

Important formatting rule for autoloop planning artifacts:
- Do not use backticks or markdown inline code in phase_plan yaml content fields.
- Use plain text only.

Execution requirements:
- full_auto answers
- pairs plan,implement,test
- do not set max_iterations
- implement only via autoloop

Required model change:
- Normalize limiting magnitude to anchored linear aperture mapping:
  at 40 mm gives limiting magnitude 3
  at 240 mm gives limiting magnitude 10
  linear interpolation between these anchors
- Keep altitude penalty behavior in place.
- Keep main view default aperture at 40 mm.
- Ensure helper and render profile stay consistent.
- Update tests for anchors and regressions.

Validation commands:
pnpm --dir SkyLensServerless exec vitest run tests/unit/scope-optics.test.ts
pnpm --dir SkyLensServerless exec vitest run tests/unit/viewer-settings.test.tsx
pnpm --dir SkyLensServerless exec vitest run tests/unit/viewer-shell-scope-runtime.test.tsx
pnpm --dir SkyLensServerless test
