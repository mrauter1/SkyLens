# SkyLensServerless Fixes 1 and 2 Plan

## Scope

- Apply changes only under `SkyLensServerless/` plus the required autoloop plan artifacts.
- Enforce an explicit static-export deployment contract without changing user-facing UI flows.
- Harden TLE relay fetching so relay failures are retried in order per source while keeping the existing schema, dedupe, and stale-cache behavior.

## Milestones

### 1. Static-only deployment contract

- Update `SkyLensServerless/next.config.ts` to opt into static export while preserving the existing `Permissions-Policy` behavior through a repo-owned static-host artifact/config that ships with the exported bundle.
- Add the repo-owned static-host artifact/config inside `SkyLensServerless/` (prefer a checked-in `public/_headers` file so the export emits it without extra infrastructure) and treat it as part of the fork’s supported deployment contract.
- Update `SkyLensServerless/package.json` scripts so production workflow targets static output instead of `next start`, and adjust any fork-contract tests that assert the old script surface.
- Extend `SkyLensServerless/tests/unit/next-config.test.ts` to assert static export mode and that the live AR permissions-policy contract remains defined; add any focused contract coverage needed for the emitted static-host artifact.
- Add a deployment-mode section to `SkyLensServerless/PARITY.md` documenting:
  - the fork’s static/serverless-only contract,
  - contributor constraints against reintroducing runtime-only Next features,
  - the repo-owned static-host artifact/config required to preserve the `Permissions-Policy` header in exported deployments.

### 2. Ordered TLE relay fallback and validation

- Update `SkyLensServerless/lib/satellites/tle.ts` so `NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE` accepts an ordered comma-separated list of relay templates while preserving single-template values.
- For each TLE group source, attempt relay templates in order and stop on the first successful fetch + parse path; only fail the group after all configured relays fail.
- Preserve:
  - `TleApiResponseSchema` / `TleSatelliteSchema` validation,
  - per-group parsing and NORAD dedupe behavior,
  - cache freshness and 24-hour stale fallback semantics,
  - the external `TLE data unavailable.` failure contract when no stale cache can be served.
- Attach structured retry diagnostics to failure paths so logs/errors identify the `groupId`, relay index, and relay path/template without changing the public response shape.
- Extend `SkyLensServerless/tests/unit/satellite-layer.test.ts` for:
  - primary relay failure with secondary relay success,
  - all relays failing with stale cache available,
  - all relays failing without stale cache.
- Run focused validation for changed units plus a production build that proves the static export configuration emits the expected static output.

## Interfaces and Contracts

- `next.config.ts`
  - Must explicitly declare static export mode.
  - Must stay compatible with `next build` producing export output for static hosting.
  - Must not rely on fork-owned runtime route handlers or other server-only Next features.
- Static-host header artifact/config
  - Must live inside `SkyLensServerless/` and ship with the exported static bundle.
  - Preferred form: a checked-in `public/_headers` file that preserves the current `Permissions-Policy` contract for exported routes.
  - `PARITY.md`, focused tests, and build validation must treat this artifact/config as part of the deployment contract rather than optional documentation.
- `package.json` scripts
  - `dev` remains the local authoring path.
  - `build` remains the build gate for the exported app and emitted static-host artifact.
  - Production/start guidance must point at serving exported assets, not `next start`.
- `NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE`
  - Backward compatible with a single template.
  - New contract: comma-separated ordered templates, each containing `{url}`.
  - Invalid templates must fail fast with actionable diagnostics.
- `getTleApiResponse()`
  - Response schema stays unchanged.
  - Stale cache remains a fallback only after refresh failure.
  - Retry behavior becomes per-source/per-relay rather than single-attempt.
  - Failure diagnostics must include `groupId`, relay index, and relay path/template.

## Compatibility and Regression Notes

- Static export cannot silently drop the current `Permissions-Policy` behavior. The supported plan is to preserve parity through a repo-owned static-host artifact/config emitted with the export bundle and documented in `SkyLensServerless/`; if that contract cannot be maintained, implementation must not silently downgrade the behavior.
- The relay change must not alter catalog ordering, deduped group membership, ISS tagging, or cache timestamps beyond existing behavior.
- Existing reassurance copy already describes a configurable browser-safe relay; no copy change is required unless implementation details make the relay contract ambiguous.
- Tests outside the explicitly requested files may need focused updates if they pin the old `next start` workflow or the old header-emission assumption.

## Validation

- Run focused unit tests in `SkyLensServerless/`:
  - `tests/unit/next-config.test.ts`
  - `tests/unit/satellite-layer.test.ts`
  - any affected fork-contract/health tests if config or cache semantics are touched
- Run `npm run build` from `SkyLensServerless/` and confirm both the static export output and the repo-owned header artifact/config are emitted as expected.
- If the static-host artifact/config adds a focused contract file, validate that file directly rather than weakening the existing permissions-policy coverage.

## Risk Register

- Static export vs. permissions headers
  - Risk: `headers()` in `next.config.ts` can block or invalidate export-mode builds while the current permissions-policy parity must stay intact.
  - Mitigation: preserve the header through a repo-owned static-host artifact/config that ships with the export bundle, and validate both the artifact and current permission-facing behavior instead of downgrading the contract.
- Script contract drift
  - Risk: changing `start` can break local expectations and bootstrap tests.
  - Mitigation: update scripts, docs, and bootstrap assertions together; keep `dev`/Playwright workflow unchanged unless the implementation proves otherwise.
- Relay retry masking the root failure
  - Risk: naive retry loops can hide which group/relay failed or accidentally swallow parse/HTTP errors.
  - Mitigation: collect structured attempt context with `groupId`, relay index, and relay path/template, and surface it on the terminal failure path while keeping the public error string stable.
- Stale-cache regression
  - Risk: partial retry success or aggregate failure handling could change when stale cache is served.
  - Mitigation: preserve the outer stale-window decision point and add explicit tests for stale/no-stale exhaustion paths.

## Rollback

- Revert the static export config, script, test, and PARITY changes as one unit if `npm run build` no longer produces a valid static bundle.
- Revert the relay parsing/retry changes and their tests as one unit if satellite fetching, stale fallback, or diagnostics regress.
