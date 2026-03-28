# Implementation Notes

- Task ID: skylens-serverless-migration-and-equivalence-tas-1962bcf4
- Pair: implement
- Phase ID: bootstrap-standalone-fork
- Phase Directory Key: bootstrap-standalone-fork
- Phase Title: Bootstrap standalone SkyLensServerless app
- Scope: phase-local producer artifact

## Files changed
- Created `SkyLensServerless/` with copied baseline app/runtime/test/config surface: `app/`, `components/`, `lib/`, `public/`, `tests/`, `.gitignore`, `eslint.config.mjs`, `next-env.d.ts`, `next.config.ts`, `package.json`, `package-lock.json`, `playwright.config.ts`, `pnpm-lock.yaml`, `postcss.config.mjs`, `tsconfig.json`, `vitest.config.ts`.
- Updated `SkyLensServerless/package.json`.
- Updated `SkyLensServerless/playwright.config.ts`.
- Updated `SkyLensServerless/next.config.ts`.
- Updated `SkyLensServerless/lib/viewer/settings.ts`.

## Symbols touched
- `VIEWER_SETTINGS_STORAGE_KEY`
- `nextConfig`

## Checklist mapping
- Milestone 1 / Standalone Fork Bootstrap: completed baseline copy into `SkyLensServerless/`.
- Milestone 1 / Fork-local scripts-config: completed by copying and validating `package.json`, Next, Vitest, Playwright, TypeScript, ESLint, and PostCSS config.
- Deferred: all serverless data/runtime substitutions remain for later phases.

## Assumptions
- Preserving baseline behavior for this phase means keeping copied API routes and route structure intact until the dedicated serverless-migration phase replaces them.

## Preserved invariants
- Root-app implementation files outside autoloop artifacts were not edited.
- Fork runtime imports resolve within `SkyLensServerless/` using the same relative layout as the root app.
- Baseline UI/routes and existing payload contracts remain unchanged in the copied fork.

## Intended behavior changes
- Fork package identity is `skylens-serverless`.
- Fork viewer settings use a separate local-storage namespace from the root app.
- Fork Playwright web server uses port `3100`.
- Fork Next config pins `turbopack.root` to the fork directory to avoid parent-workspace inference.

## Known non-changes
- `SkyLensServerless/app/api/*` is still present in this bootstrap phase.
- Live-data provider behavior, privacy copy, and `/view` static-safety have not been rewritten yet.

## Expected side effects
- `npm install` inside `SkyLensServerless/` generates fork-local `node_modules/`.
- `npm run build` inside `SkyLensServerless/` generates fork-local `.next/`.

## Validation performed
- `cd /workspace/SkyLens/SkyLensServerless && npm install`
- `cd /workspace/SkyLens/SkyLensServerless && npm test` → 20 files passed, 199 tests passed.
- `cd /workspace/SkyLens/SkyLensServerless && npm run build` → success.
- `cd /workspace/SkyLens/SkyLensServerless && npm run test:e2e -- --list` → Playwright discovered 12 tests across 4 files.
- `cd /workspace/SkyLens/SkyLensServerless && npx vitest run tests/unit/next-config.test.ts` after the Next root fix → passed.

## Deduplication / centralization decisions
- Reused the root app’s existing directory structure and configs verbatim where possible to minimize parity drift during bootstrap.
