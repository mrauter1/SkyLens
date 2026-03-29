# SkyLensServerless follow-up permissions/delegation plan

## Scope and baseline

- Implement only the `SkyLensServerless/` regression unless execution uncovers fresh drift elsewhere; the repo-root app already carries the corrected camera + geolocation permissions contract.
- Preserve the current serverless fork architecture: `next.config.ts` remains the canonical source for response headers, `public/_headers` remains the checked-in static-host artifact, and `out/` remains build-generated output.
- Preserve the prior serverless behavior that was intentionally changed in the last PR: browser-direct CelesTrak fetch behavior, existing landing/privacy copy, and the current mobile viewer overlay UX.

## Milestone

### Restore the permissions/delegation parity contract in the serverless fork

- Expand the fork-local permissions policy to the required exact capability set:
  `camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)`.
- Keep runtime and static/export surfaces derived from the same contract source so `next.config.ts`, `public/_headers`, and generated `out/_headers` cannot drift.
- Restore embedded live-viewer delegation in `app/embed-validation/page.tsx` so the iframe `allow` attribute delegates:
  `camera; geolocation; accelerometer; gyroscope; magnetometer`.
- Refresh build-generated exported embed artifacts under `SkyLensServerless/out/` via `npm run build` so the tracked static output matches the fixed source contract.
- Update fork-local tests and parity/docs text to enforce and describe the corrected contract.

## Interfaces and invariants

- Canonical response header value:
  `Permissions-Policy: camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)`.
- Canonical embed delegation value:
  `allow="camera; geolocation; accelerometer; gyroscope; magnetometer"`.
- `SkyLensServerless/next.config.ts` must remain the single authored source for the policy string and any derived static-host header text used by tests.
- `SkyLensServerless/public/_headers` must exactly match the derived static-host header artifact.
- `SkyLensServerless/out/_headers` and exported embed HTML/RSC artifacts are generated outputs; update them by rebuilding, not by inventing separate literals.
- The embed validation route must keep the current viewer `src`, same-origin hosting assumption, and mobile-visible iframe sizing so existing mobile overlay checks continue to work.

## Affected files

- `SkyLensServerless/next.config.ts`
- `SkyLensServerless/public/_headers`
- `SkyLensServerless/app/embed-validation/page.tsx`
- `SkyLensServerless/tests/unit/next-config.test.ts`
- `SkyLensServerless/tests/unit/serve-export.test.ts`
- `SkyLensServerless/tests/e2e/embed.spec.ts`
- `SkyLensServerless/PARITY.md`
- Build-generated tracked outputs under `SkyLensServerless/out/` that mirror the embed page and exported `_headers`

## Validation

- Run fork-local unit coverage for header/static-host parity and export preview behavior:
  `npm test -- --runInBand` is not needed; use the existing `npm test` or a scoped Vitest run from `SkyLensServerless/`.
- Run `npm run build` from `SkyLensServerless/` to regenerate `out/_headers` and exported embed-validation artifacts.
- Run the fork-local embed/browser regression path with `npm run test:e2e -- --grep embed` or the nearest equivalent existing Playwright filter.
- Verify the passing embed flow still exposes the viewer stage and mobile overlay trigger inside the iframe.

## Regression controls

- Do not change the landing-page reassurance copy or TLE/provider behavior as part of this follow-up; only permission/delegation wording in parity/docs should change.
- Do not narrow the current motion-sensor contract while adding camera/geolocation.
- Avoid duplicating the permissions list across unrelated files; prefer deriving static artifacts from the existing config constant and rebuilding generated output.
- Treat any failure of the embed mobile overlay visibility check as a release blocker because the request explicitly forbids regressing mobile UX.

## Rollback

- Revert the fork-local permissions/delegation/doc/test edits as one unit if exported hosting or embed validation breaks unexpectedly.
- If build-generated `out/` artifacts diverge from source after rollback, regenerate them from the reverted source with `npm run build` instead of editing generated files manually.
