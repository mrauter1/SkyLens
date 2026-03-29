# SkyLensServerless Parity

This fork preserves the root SkyLens app's user-visible behavior while replacing fork-owned server runtime surfaces with browser-side equivalents inside `SkyLensServerless/`.

| Original SkyLens server-side feature | Root app surface | SkyLensServerless replacement | Parity / validation |
| --- | --- | --- | --- |
| Public config bootstrap | `app/api/config/route.ts` returns `getPublicConfig()` | `lib/config.ts` exports `getPublicConfig()` directly and the landing/viewer read it in-process | `tests/unit/config-contract.test.ts`, `tests/unit/bootstrap-standalone-fork.test.ts` |
| TLE aggregation, validation, dedupe, freshness metadata | `app/api/tle/route.ts` + `lib/satellites/tle.ts` | `lib/satellites/tle.ts` runs in-browser, fetches CelesTrak directly by default, optionally honors `NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE` when explicitly configured, validates with the existing schemas, dedupes by NORAD ID, and stores a fork-local stale fallback cache in `localStorage` | `tests/unit/satellite-layer.test.ts`, `tests/unit/health-route.test.ts` |
| Health route for viewer cache status | `app/api/health/route.ts` | `lib/health/client.ts` derives `HealthApiResponse` locally from the same TLE cache metadata | `tests/unit/health-route.test.ts`, `tests/unit/viewer-settings.test.tsx` |
| `/view` server-page search param parsing | `app/view/page.tsx` awaited async `searchParams` on the server | `app/view/page.tsx` is static-safe and delegates query parsing to `app/view/view-page-client.tsx` via `useSearchParams()` and `parseViewerRouteState()` | `tests/unit/view-page.test.tsx`, `tests/e2e/permissions.spec.ts`, `npm run build` |
| Live AR permissions-policy header | host/runtime config | `next.config.ts` keeps the same `Permissions-Policy` header during local Next runtime use, and `public/_headers` preserves that header in exported deployments | `tests/unit/next-config.test.ts`, `tests/e2e/embed.spec.ts`, `npm run build` |
| Embedded viewer delegation contract | embedded route + iframe allow list | `app/embed-validation/page.tsx` keeps the iframe `allow` contract and renders the fork-local viewer | `tests/e2e/embed.spec.ts` |

## Deployment mode

- `SkyLensServerless` is a static-export-only fork. `next.config.ts` sets `output: 'export'`, and the supported production artifact is the emitted `out/` directory from `npm run build`.
- `npm run start` no longer boots a Next runtime. It previews the already-built `out/` export and applies the emitted `_headers` rules so local verification matches the exported header contract.
- `public/_headers` is a required fork-owned deployment artifact. Hosts that honor Netlify-style `_headers` files preserve the current `Permissions-Policy` contract for every exported route without depending on a fork-owned server runtime.
- Contributors must keep exported routes static-safe. Do not reintroduce fork-owned route handlers, runtime-only data dependencies, or other Next features that require `next start` in production.
- If the permissions-policy contract changes, update `next.config.ts`, `public/_headers`, and `tests/unit/next-config.test.ts` together so local runtime and exported-host behavior stay aligned.

## Data-flow notes

- Aircraft requests still go browser-direct to OpenSky. The existing OpenSky reassurance copy remains accurate and is covered by `tests/unit/aircraft-client.test.ts`, `tests/unit/viewer-shell.test.ts`, and `tests/e2e/landing.spec.ts`.
- Satellite requests are no longer routed through a fork-owned Next handler. They now go directly from the browser to CelesTrak by default, with an optional explicit relay-template override if a deployment needs it. Coverage lives in `tests/unit/config-contract.test.ts`, `tests/unit/viewer-shell.test.ts`, and `tests/e2e/landing.spec.ts`.

## Standalone verification

- Unit/integration: `npm test`
- Browser run/e2e: `npm run test:e2e`
- Production build: `npm run build`

All commands are intended to run from `SkyLensServerless/`.
