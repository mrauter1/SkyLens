# Implementation Notes

- Task ID: skylensserverless-follow-up-fixes-for-review-com-b8a11a92
- Pair: implement
- Phase ID: restore-serverless-permissions-parity
- Phase Directory Key: restore-serverless-permissions-parity
- Phase Title: Restore serverless permissions and embed parity
- Scope: phase-local producer artifact

## Files changed

- `SkyLensServerless/next.config.ts`
- `SkyLensServerless/public/_headers`
- `SkyLensServerless/app/embed-validation/page.tsx`
- `SkyLensServerless/tests/unit/next-config.test.ts`
- `SkyLensServerless/tests/e2e/embed.spec.ts`
- `SkyLensServerless/PARITY.md`
- `SkyLensServerless/out/_headers`
- Regenerated tracked export artifacts under `SkyLensServerless/out/` affected by the build ID refresh, including `embed-validation*`, `view*`, `index*`, `_not-found*`, and `_next/static/*`
- `.autoloop/tasks/skylensserverless-follow-up-fixes-for-review-com-b8a11a92/decisions.txt`

## Symbols touched

- `SKYLENS_PERMISSIONS_POLICY`
- `SKYLENS_RESPONSE_HEADERS`
- `SKYLENS_NEXT_HEADERS`
- `SKYLENS_STATIC_HOST_HEADERS`
- `EmbedValidationPage`

## Checklist mapping

- Permissions policy restored to `camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)` in source and static headers.
- Runtime/static/export parity preserved by keeping `next.config.ts` canonical and rebuilding `out/`.
- Embed iframe delegation restored to `camera; geolocation; accelerometer; gyroscope; magnetometer`.
- Unit and e2e assertions updated to enforce the corrected contract.
- Parity documentation updated from motion-only wording to the five-capability contract.

## Assumptions

- Repo-root SkyLens remains the authoritative comparison point for the intended permission/delegation contract.
- The tracked `out/` directory is expected to move broadly on rebuild because Next export regenerates build IDs and dependent static references.

## Preserved invariants

- No changes to direct CelesTrak/browser data-provider behavior.
- No changes to viewer startup flow or mobile overlay UX beyond validating the existing embed/mobile checks.
- `next.config.ts` remains the authored contract source; `public/_headers` and `out/` stay derived artifacts.

## Intended behavior changes

- Exported and runtime headers now grant camera and geolocation in addition to the existing motion sensors.
- The embed validation route now delegates camera and geolocation alongside accelerometer, gyroscope, and magnetometer.
- Fork-local parity/docs text no longer describes a motion-only contract.

## Known non-changes

- No repo-root app edits.
- No modifications to aircraft, satellite, landing-page reassurance, or manual observer flows.

## Expected side effects

- `npm run build` regenerates tracked static files outside the embed page because the export build ID and asset names changed.
- Playwright browser dependencies had to be bootstrapped in the container to execute the embed spec.

## Validation performed

- `npm ci`
- `npm test -- tests/unit/next-config.test.ts tests/unit/serve-export.test.ts`
- `npm run build`
- `npm run test:e2e -- tests/e2e/embed.spec.ts`

## Deduplication / centralization

- Reused the fork's existing header constants in `next.config.ts`; tests and static-host artifacts continue to derive from that single contract source instead of duplicating permission strings across runtime and export surfaces.
