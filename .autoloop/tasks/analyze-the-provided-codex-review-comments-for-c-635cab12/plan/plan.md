# Plan

## Scope
- Analyze the three review comments against the current code and implement only the correct, applicable fixes.
- Keep the existing viewer permission contract: orientation remains `granted | denied | unavailable`; no new route/query states.

## Review Assessment
- `lib/aircraft/opensky.ts`: Correct and applicable. `buildOpenSkyStatesUrl()` currently wraps longitude with `clampLon()` and can emit `lomin > lomax` when the rounded bucket crosses the antimeridian.
- `lib/sensors/orientation.ts` permission result: Correct and applicable. `requestOrientationPermission()` currently returns `granted` whenever events appear supported and no permission API denies, even if no usable orientation event ever arrives.
- `lib/sensors/orientation.ts` mixed streams: Correct and applicable. `subscribeToOrientationPose()` ignores `deviceorientation` only after locking to `deviceorientationabsolute`; if `deviceorientation` wins the race first, later absolute samples can still be mixed into the smoothing/history stream.

## Milestone
### Ship one focused sensor/query hardening slice
- Harden OpenSky bbox construction so antimeridian-spanning queries do not send inverted longitude intervals. Keep the fix local to upstream query building; do not change cache bucketing, API schema, or observer-relative filtering.
- Tighten orientation permission detection so browsers without `requestPermission()` only return `granted` after a short event probe observes a usable orientation sample. Preserve `denied` precedence when permission APIs explicitly deny.
- Lock orientation subscription to exactly one browser event stream. Prefer `deviceorientationabsolute` when it produces a valid sample; otherwise fall back to `deviceorientation`, and ignore the non-selected stream thereafter.

## Interfaces And Invariants
- `getAircraftApiResponse()` response shape and degraded fallback behavior stay unchanged.
- `buildOpenSkyStatesUrl()` must never construct an inverted longitude interval. If the geographic span crosses `±180`, normalize or split the upstream request internally while preserving the existing call surface.
- `requestOrientationPermission(runtime?)` continues to return only `granted | denied | unavailable`.
- `requestOrientationPermission()` may only return `granted` without explicit permission APIs if a valid orientation event is observed within a bounded probe window; otherwise return `unavailable`, which preserves the current manual-pan fallback behavior.
- `subscribeToOrientationPose()` must feed smoothing/history from one event family at a time so alignment health, recentering, and pose output are derived from a consistent stream.

## Validation
- Add unit coverage for OpenSky longitude handling near `+180` and `-180`, asserting the upstream request remains usable and still includes in-range aircraft.
- Add unit coverage for orientation permission probing:
  - explicit permission denial still returns `denied`
  - no permission API + observed valid event returns `granted`
  - no permission API + no valid event before timeout returns `unavailable`
- Add unit coverage for orientation subscription stream locking:
  - once one stream is selected, the other stream is ignored
  - `deviceorientationabsolute` is preferred when it yields the first valid preferred sample

## Compatibility Notes
- No API route, query parameter, viewer route state, or UI copy changes are planned.
- The only intentional behavior tightening is that some browsers previously classified as orientation-ready may now resolve to `unavailable` until they prove live sensor delivery; this is required by the review comment and aligns with existing manual-pan fallback semantics.

## Regression Risks
- Antimeridian handling can accidentally under-fetch or over-fetch if the normalization/splitting logic is inconsistent with existing radius expansion.
- Orientation probing can become flaky if the timeout is too short or if event listeners are not cleaned up deterministically.
- Stream locking can regress valid absolute fallback if selection logic commits too early or continues mixing history after lock-in.

## Rollback
- Revert the OpenSky query-builder change if upstream requests start dropping aircraft outside antimeridian cases.
- Revert the permission probe only if it causes confirmed false negatives on supported browsers and no bounded probe variant can stabilize the behavior.
- Revert the stream-locking change only if it breaks a verified single-event browser path; do not revert back to mixed-stream smoothing as a fallback.

## Risk Register
- R1: OpenSky may not support a single wrapped longitude interval. Mitigation: keep the fix local and test both longitude edges explicitly.
- R2: Permission probing depends on browser event timing. Mitigation: use a short bounded probe with cleanup and deterministic unit tests using stubbed runtime/listeners.
- R3: Orientation absolute availability is platform-specific. Mitigation: encode selection precedence and fallback in tests rather than relying on implicit event ordering.
