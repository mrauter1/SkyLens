# Test Strategy

- Task ID: skylens-serverless-migration-and-equivalence-tas-1962bcf4
- Pair: test
- Phase ID: verify-parity-and-document
- Phase Directory Key: verify-parity-and-document
- Phase Title: Verify feature parity and document the migration
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- Config parity and provider-path disclosure:
  `SkyLensServerless/tests/unit/config-contract.test.ts`
  Verifies the in-process public config contract, public build-version precedence, and the fork-local privacy/data-flow reassurance copy for direct OpenSky aircraft requests plus the configured satellite relay path.
- Satellite freshness behavior and payload parity:
  `SkyLensServerless/tests/unit/satellite-layer.test.ts`
  Verifies in-process TLE normalization, NORAD dedupe, proxy-template request construction, 6-hour fresh window, 24-hour stale fallback window, stale-window expiry failure, and deterministic satellite detail metadata from fixtures.
- Local health derivation:
  `SkyLensServerless/tests/unit/health-route.test.ts`
  Verifies `empty`, `fresh`, and `stale` cache states derived locally from the browser-side TLE cache metadata instead of a route handler.
- Static-safe route handling:
  `SkyLensServerless/tests/unit/view-page.test.tsx`
  Verifies that `ViewPageClient` parses client-side `useSearchParams()` into the preserved viewer route state contract.
- Embed/header expectations:
  `SkyLensServerless/tests/unit/next-config.test.ts`
  `SkyLensServerless/tests/e2e/embed.spec.ts`
  Verifies the fork-local `Permissions-Policy` header and the iframe `allow` delegation contract for the embedded viewer path.
- Privacy/data-flow reassurance copy visibility:
  `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  `SkyLensServerless/tests/e2e/landing.spec.ts`
  Verifies that live-startup and landing surfaces show the current reassurance copy, including the direct OpenSky aircraft path and the configured satellite relay disclosure.
- Demo/e2e parity and standalone runtime:
  `SkyLensServerless/tests/e2e/demo.spec.ts`
  `SkyLensServerless/tests/e2e/permissions.spec.ts`
  Verifies demo-shell behavior, detail-card interaction, settings persistence, fallback/permission states, and the statically served `/view` route in a running fork.

## Preserved invariants checked

- Payload shapes for config, health, and TLE responses remain unchanged for consumers.
- Satellite freshness semantics stay at 6 hours fresh plus 24 hours stale fallback.
- The fork still emits the same live AR permissions-policy contract and embed delegation expectations.
- The fork’s privacy/data-flow copy stays truthful to the selected provider path recorded in `decisions.txt`.

## Edge cases and failure paths

- TLE upstream failure within the stale window returns stale cached data.
- TLE upstream failure after the stale window expires throws instead of silently degrading to a false fresh state.
- Health derivation covers no-cache and post-expiry states without a server route.
- `/view` query parsing preserves demo deep-link semantics from client-side router state.

## Reliability / stabilization

- Unit coverage uses deterministic fixtures and fake timers for cache freshness transitions.
- E2E assertions avoid live-network dependence and use bundled demo state or fork-local rendered copy.
- The demo detail-card e2e targets a deterministic visible star label (`Polaris`) rather than a mobile-only aircraft label that can drop out of the default label layout, reducing selector flake while preserving interaction coverage.

## Known gaps

- None material to AC-1 through AC-3 after the recorded `npm test`, `npm run build`, and `npm run test:e2e` verification.
