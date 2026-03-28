# Implementation Notes

- Task ID: skylensserverless-follow-up-fixes-task-fixes-1-a-1fc787a5
- Pair: implement
- Phase ID: static-export-contract
- Phase Directory Key: static-export-contract
- Phase Title: Enforce static-only deployment contract
- Scope: phase-local producer artifact

## Files changed

- `SkyLensServerless/next.config.ts`
- `SkyLensServerless/public/_headers`
- `SkyLensServerless/scripts/serve-export.mjs`
- `SkyLensServerless/package.json`
- `SkyLensServerless/app/manifest.ts`
- `SkyLensServerless/lib/satellites/tle.ts`
- `SkyLensServerless/tests/unit/next-config.test.ts`
- `SkyLensServerless/tests/unit/bootstrap-standalone-fork.test.ts`
- `SkyLensServerless/tests/unit/serve-export.test.ts`
- `SkyLensServerless/tests/unit/satellite-layer.test.ts`
- `SkyLensServerless/PARITY.md`

## Symbols touched

- `SKYLENS_PERMISSIONS_POLICY`
- `SKYLENS_RESPONSE_HEADERS`
- `SKYLENS_NEXT_HEADERS`
- `SKYLENS_STATIC_HOST_HEADERS`
- `getTleApiResponse()`
- `fetchSatelliteCatalog()`
- `fetchTleGroupWithRelayFallback()`
- `buildBrowserSafeTleUrl()`
- `createStaticExportServer()`
- `loadHeaderRules()`
- `manifest()`

## Checklist mapping

- Static-only deployment contract:
  `next.config.ts` now sets `output: 'export'`; `public/_headers` preserves the permissions-policy header for exported hosts; `package.json` `start` previews `out/` through a repo-local server that applies emitted `_headers`; `app/manifest.ts` is explicitly static for export compatibility.
- Focused coverage:
  `tests/unit/next-config.test.ts` asserts export mode and `_headers` parity; `tests/unit/bootstrap-standalone-fork.test.ts` asserts the repo-local preview contract; `tests/unit/serve-export.test.ts` verifies the preview server serves the exported permissions-policy header.
- Relay hardening:
  `lib/satellites/tle.ts` now accepts ordered comma-separated relay templates, retries each relay per source, and carries structured attempt context.
- Relay tests:
  `tests/unit/satellite-layer.test.ts` covers primary-relay failure with secondary success, all-relays-fail stale fallback, and all-relays-fail without cache.
- Documentation:
  `PARITY.md` documents the static-export-only contract, `_headers` artifact, and contributor constraints.

## Assumptions

- Keeping `headers()` in `next.config.ts` is still required for local Next dev/e2e parity even though export builds warn that runtime headers do not apply to exported output.
- A repo-owned static host artifact inside `SkyLensServerless/public/` is the authoritative production mechanism for preserving the permissions-policy header.

## Preserved invariants

- Public permissions-policy value is unchanged.
- `getTleApiResponse()` still returns the same response schema and still throws `TLE data unavailable.` when no cache can be served.
- TLE parsing, NORAD dedupe, ISS tagging, refresh window, and stale window semantics are unchanged.
- Root app files outside `SkyLensServerless/` were not modified.

## Intended behavior changes

- Production deployment is now explicitly static-export-only.
- `npm run start` now previews the exported bundle through a Node-executable repo-local server that applies emitted `_headers` rules.
- `NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE` accepts an ordered comma-separated list of `{url}` relay templates.
- Relay failures now expose structured diagnostic context through stale-fallback logging and terminal error causes.

## Known non-changes

- Dev workflow remains `next dev`.
- The embed iframe `allow` contract and user-visible viewer behavior were not changed.
- No new runtime route handlers or server-only deployment paths were introduced.

## Expected side effects

- `next build` emits the expected Next.js warning that runtime `headers()` are not applied to exported output; parity is preserved through `public/_headers`.
- `npm run start` now requires an existing `out/` build because it previews static export output and applies the emitted `_headers` rules at request time.

## Validation performed

- `npm ci`
- `npm run test -- tests/unit/next-config.test.ts tests/unit/bootstrap-standalone-fork.test.ts tests/unit/serve-export.test.ts tests/unit/satellite-layer.test.ts`
- `npm run build`
- `npm run start`
- `curl -I http://127.0.0.1:3000/embed-validation`
- Verified the preview response includes `Permissions-Policy: camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)`.

## Deduplication / centralization

- Centralized header contract literals in `next.config.ts` so the local Next header rule and the checked-in `_headers` artifact can be validated against the same exported constants.
