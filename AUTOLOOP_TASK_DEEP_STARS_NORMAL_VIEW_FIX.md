Autoloop correction pass:

Goal:
- Remove the hard lower limiting-magnitude floor completely from optics logic.
- Keep normal-view default aperture at 40mm.

Strict requirements:
1) In SkyLensServerless/lib/viewer/scope-optics.ts, no limiting-magnitude path should clamp to a fixed minimum floor of 3.
2) computeScopeLimitingMagnitude and deep-star render limit behavior should both be floor-free on the low end.
3) Keep any upper safety cap if needed (e.g., max 15.5) and invalid input handling.
4) Main-view default aperture remains 40mm.

Update tests accordingly and run:
- pnpm --dir SkyLensServerless exec vitest run tests/unit/scope-optics.test.ts
- pnpm --dir SkyLensServerless exec vitest run tests/unit/viewer-settings.test.tsx
- pnpm --dir SkyLensServerless test

Execution requirements:
- full_auto answers
- pairs plan,implement,test
- no max_iterations
