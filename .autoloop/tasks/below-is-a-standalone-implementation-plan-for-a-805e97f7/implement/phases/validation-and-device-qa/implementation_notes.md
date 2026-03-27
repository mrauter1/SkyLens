# Implementation Notes

- Task ID: below-is-a-standalone-implementation-plan-for-a-805e97f7
- Pair: implement
- Phase ID: validation-and-device-qa
- Phase Directory Key: validation-and-device-qa
- Phase Title: Validation And Device QA
- Scope: phase-local producer artifact

## Files changed

- `app/embed-validation/page.tsx`
- `tests/e2e/embed.spec.ts`
- `tests/e2e/permissions.spec.ts`
- `.autoloop/tasks/below-is-a-standalone-implementation-plan-for-a-805e97f7/decisions.txt`
- `.autoloop/tasks/below-is-a-standalone-implementation-plan-for-a-805e97f7/implement/phases/validation-and-device-qa/implementation_notes.md`

## Symbols touched

- `EmbedValidationPage`
- `embed.spec.ts` iframe contract assertions
- `permissions.spec.ts` fallback-shell assertions

## Checklist mapping

- Plan item 10 / AC-1: revalidated automated coverage for W3C orientation math, projection cover-crop mapping, startup order, secure-context failure, and fallback transitions across unit tests plus the mobile permissions E2E slice.
- Plan item 10 / AC-4: confirmed the shipped deployment contract through the existing `next.config.ts` header test, viewer secure-context gating coverage, and the `/embed-validation` Playwright slice that asserts the iframe `allow` delegation plus embedded live-viewer startup shell.
- Plan item 10 / AC-2 and AC-3: recorded the remaining gap that physical-device Safari/Android verification is still required for the requested browser matrix; this workspace can only validate desktop Chromium automation.

## Assumptions

- Playwright browser runs in this workspace do not have a granted geolocation source by default, so live fallback routes can legitimately land in the manual-observer panel even when query params seed `location=granted`.
- The mobile overlay copy and badges already covered by `ViewerShell` unit tests are the stable source of truth for the E2E assertions.

## Preserved invariants

- No runtime viewer logic changed in this phase; only validation coverage and phase documentation were updated.
- Secure-context gating, permissions-policy header emission, and startup/fallback behavior remain exercised through existing unit coverage.

## Intended behavior changes

- None in product code.
- Browser E2E assertions now match the current shipped mobile overlay contract instead of stale heading expectations from an earlier shell copy.

## Known non-changes

- No real-device Safari/iPhone, Chromium Android, Samsung Internet, or Firefox Android session could be executed from this container.
- Completing AC-2 and AC-3 now depends on an external manual QA run with physical mobile hardware or a managed device lab; there is no remaining repo-side substitute for that requirement.
- Per the cycle 3 clarification, this phase intentionally remains blocked until those external real-device results are supplied; no placeholder artifact should be treated as satisfying AC-2 or AC-3.

## Expected side effects

- The permissions E2E spec is less brittle against geolocation-unavailable browser runs and now validates the actionable fallback UI (`Retry location`, `Enable motion`, manual observer entry) that users actually see.
- The embed validation route now keeps the mobile overlay trigger inside the iframe viewport during Playwright's mobile-sized host run, so the delegated iframe contract is exercised instead of timing out on an off-screen control.

## Validation performed

- `npm ci`
- `npx playwright install chromium`
- `npx playwright install-deps chromium`
- `npm test -- tests/unit/orientation-foundation.test.ts tests/unit/orientation-permission-and-subscription.test.ts tests/unit/projection-camera.test.ts tests/unit/permission-coordinator.test.ts tests/unit/viewer-shell.test.ts tests/unit/next-config.test.ts`
- `npm run test:e2e -- tests/e2e/embed.spec.ts`
- `npm run test:e2e -- tests/e2e/permissions.spec.ts`

## Device QA outcomes

- Automated browser validation passed in Chromium for the blocked-startup path, secure-context gating, manual observer fallback, non-camera fallback, and manual-pan fallback.
- Requested physical-device QA matrix is still pending outside this workspace: Safari on iPhone, one Chromium-based Android browser, and Samsung Internet or Firefox Android.
- Because no physical sensors/cameras are exposed here, acceptance items about vertical crossing, portrait/landscape rotation stability on hardware, calibration hold through modest pans, and persisted rear-camera selection still require manual device execution before release.
- Blocked status is now explicit rather than inferred: do not mark the phase complete until those physical-device outcomes are recorded.

## Deployment / embed requirements

- Live AR must run on HTTPS or `localhost`; the viewer surfaces the unsupported state when `window.isSecureContext` is false.
- Response header requirement remains `Permissions-Policy: camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)`.
- The in-repo `/embed-validation` page plus `tests/e2e/embed.spec.ts` now exercise the embedded live-viewer shell under that header and `allow="camera; geolocation; accelerometer; gyroscope; magnetometer"` delegation.
- If embedded elsewhere, the host iframe must still include `allow="camera; geolocation; accelerometer; gyroscope; magnetometer"` or equivalent delegation; otherwise camera/location/sensor failures should be treated as deployment misconfiguration before browser-specific debugging.

## Deduplication / centralization

- Kept the fallback contract sourced from existing `ViewerShell` copy/status badges rather than duplicating alternate headings in the E2E layer.
