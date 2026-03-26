# Implementation Notes

- Task ID: implement-skylensprd-md-73e90f91
- Pair: implement
- Phase ID: app-shell-and-permissions
- Phase Directory Key: app-shell-and-permissions
- Phase Title: App shell and permissions
- Scope: phase-local producer artifact

## Files changed

- `.autoloop/tasks/implement-skylensprd-md-73e90f91/implement/phases/app-shell-and-permissions/implementation_notes.md`
- `.gitignore`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `next-env.d.ts`
- `next.config.ts`
- `postcss.config.mjs`
- `eslint.config.mjs`
- `vitest.config.ts`
- `playwright.config.ts`
- `app/globals.css`
- `app/layout.tsx`
- `app/page.tsx`
- `app/view/page.tsx`
- `app/manifest.ts`
- `app/api/config/route.ts`
- `components/landing/landing-screen.tsx`
- `components/settings/settings-sheet.tsx`
- `components/viewer/viewer-shell.tsx`
- `lib/config.ts`
- `lib/permissions/coordinator.ts`
- `public/icons/icon-192.svg`
- `public/icons/icon-512.svg`
- `tests/unit/config-contract.test.ts`
- `tests/unit/permission-coordinator.test.ts`
- `tests/e2e/landing.spec.ts`
- `tests/e2e/permissions.spec.ts`

## Symbols touched

- `getPublicConfig`
- `LANDING_DESCRIPTION`
- `PRIVACY_REASSURANCE_COPY`
- `runStartFlow`
- `createDemoViewerState`
- `buildViewerHref`
- `parseViewerRouteState`
- `describeViewerExperience`
- `supportsOrientationEvents`
- `LandingScreen`
- `ViewerShell`
- `SettingsSheet`
- `GET` in `app/api/config/route.ts`

## Checklist mapping

- M1 landing page, route skeleton, trust copy, and demo entry: complete
- M1 manifest and icons: complete
- M1 `/api/config` bootstrap contract: complete
- M1 permission flow and fallback shell: complete
- M1 required npm scripts and test scaffolding: complete
- M1 initial Playwright coverage for landing, privacy copy, and denied-permission flow: complete

## Assumptions

- The phase session file referenced in the run preamble was missing on disk; implementation proceeded from the immutable request, plan, criteria, feedback, and decisions artifacts.
- Demo entry from the landing page must not request permissions, so it enters `/view` with an explicit demo-state payload.

## Preserved invariants

- Permission requests occur only from explicit user actions.
- Permission request order remains location, then camera, then orientation/motion.
- Location denial remains blocking; camera denial remains non-camera fallback; orientation denial remains manual-pan fallback.
- Bare `/view` remains blocked until the route carries an explicit live permission result.
- `/api/config` keeps the locked response shape and PRD default values.
- Landing and viewer both keep the required trust copy visible in the flow.

## Intended behavior changes

- Introduced the first runnable app shell for `/` and `/view`.
- Added PWA manifest support and icon assets.
- Added a shared permission coordinator that maps landing start, viewer retry, and demo entry into a single route-state contract.
- Tightened the live viewer parser so missing permission state no longer implies granted access.
- Tightened orientation support detection so unsupported browsers fall into manual-pan fallback instead of reporting motion readiness.
- Centralized the viewer shell's blocking branch on the shared coordinator experience so partial live-state URLs cannot bypass preflight.

## Known non-changes

- No live camera attachment, orientation event subscription, location watch, projection, or sky-object rendering yet.
- Settings persistence, alignment fixes, recenter behavior, and overlay rendering remain later-phase work.
- `/api/tle`, `/api/aircraft`, and `/api/health` are still intentionally absent in this phase.

## Expected side effects

- `npm install` now produces a lockfile and installs Next.js, Tailwind, Vitest, Playwright, and related tooling.
- Playwright validation in fresh environments requires browser and OS dependency installation before `npm run test:e2e` can pass.

## Validation performed

- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:e2e`
- `npx playwright install chromium`
- `npx playwright install-deps chromium`

## Current turn delta

- No product-code edits were required in this run; the checked-in M1 shell already matched the active phase scope and acceptance criteria.
- Revalidated the existing shell, permission coordinator, `/api/config`, and Playwright coverage in the current workspace before finalizing the phase notes.

## Deduplication / centralization

- Centralized public bootstrap config and trust-copy strings in `lib/config.ts`.
- Centralized permission-ordering, route-state parsing, and fallback-state derivation in `lib/permissions/coordinator.ts`.
- Kept the viewer shell's block-vs-viewer rendering aligned with the shared coordinator result instead of re-deriving that gate from `location` alone.
