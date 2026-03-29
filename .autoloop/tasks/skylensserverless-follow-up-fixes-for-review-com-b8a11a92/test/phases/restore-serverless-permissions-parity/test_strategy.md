# Test Strategy

- Task ID: skylensserverless-follow-up-fixes-for-review-com-b8a11a92
- Pair: test
- Phase ID: restore-serverless-permissions-parity
- Phase Directory Key: restore-serverless-permissions-parity
- Phase Title: Restore serverless permissions and embed parity
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- Runtime header contract:
  covered by `tests/unit/next-config.test.ts` asserting `SKYLENS_PERMISSIONS_POLICY` and `next.config.ts` header rules emit `camera`, `geolocation`, `accelerometer`, `gyroscope`, and `magnetometer`.
- Static-host header parity:
  covered by `tests/unit/next-config.test.ts` asserting `public/_headers` and generated `out/_headers` both match `SKYLENS_STATIC_HOST_HEADERS`.
- Exported embed artifact parity:
  covered by `tests/unit/next-config.test.ts` asserting `out/embed-validation.html` contains the five-capability iframe `allow` value and corrected copy, and no longer contains the motion-only allow/copy strings.
- Export preview behavior:
  covered by `tests/unit/serve-export.test.ts` asserting the preview server serves the exported permissions-policy header and blocks path traversal.
- Browser/embed contract:
  covered by `tests/e2e/embed.spec.ts` asserting the live iframe receives the five-capability `allow` value, the response header matches the same permission set, and the embedded viewer plus mobile overlay trigger remain visible.

## Preserved invariants checked

- `next.config.ts` remains the contract source and static/export artifacts stay aligned with it.
- The embed validation route continues to point at the same viewer path and preserve the mobile-visible iframe flow.
- No test encodes changes to aircraft, satellite, or viewer startup behavior outside the permission/delegation contract.

## Edge cases and failure paths

- Stale export artifact regression:
  unit assertions over `out/_headers` and `out/embed-validation.html` fail if source changes land without regenerating the tracked export.
- Contract narrowing regression:
  negative assertions fail if the embed export falls back to the old motion-only allow list or wording.
- Static preview safety:
  path traversal remains covered in `tests/unit/serve-export.test.ts`.

## Flake risks and stabilization

- Embed browser coverage remains isolated to a single deterministic route with same-origin iframe content and existing stable `data-testid` selectors.
- Export artifact assertions avoid build-ID-sensitive strings and only check the contract-bearing text/attributes.

## Known gaps

- The unit suite validates checked-in export artifacts, not a freshly built temporary export tree. Build correctness still relies on running `npm run build` in validation.
