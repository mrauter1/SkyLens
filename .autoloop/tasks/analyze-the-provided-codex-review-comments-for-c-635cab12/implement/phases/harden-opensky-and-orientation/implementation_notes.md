# Implementation Notes

- Task ID: analyze-the-provided-codex-review-comments-for-c-635cab12
- Pair: implement
- Phase ID: harden-opensky-and-orientation
- Phase Directory Key: harden-opensky-and-orientation
- Phase Title: Harden OpenSky bbox and orientation readiness
- Scope: phase-local producer artifact

## Files changed
- `lib/aircraft/opensky.ts`
- `lib/sensors/orientation.ts`
- `tests/unit/aircraft-layer.test.ts`
- `tests/unit/orientation-permission-and-subscription.test.ts`

## Symbols touched
- `fetchOpenSkyStates`
- `buildOpenSkyStatesUrls`
- `buildOpenSkyLongitudeRanges`
- `mergeOpenSkyStates`
- `requestOrientationPermission`
- `supportsAbsoluteOrientationEvents`
- `subscribeToOrientationPose`
- `probeOrientationAvailability`
- `getNormalizedOrientationSample`

## Checklist mapping
- OpenSky antimeridian hardening: completed in `lib/aircraft/opensky.ts` with split longitude ranges and merged upstream responses.
- Orientation permission probe: completed in `lib/sensors/orientation.ts` with bounded live-event confirmation when explicit permission APIs are unavailable.
- Orientation stream locking: completed in `lib/sensors/orientation.ts` with a bounded relative fallback window so absolute can preempt before lock-in, then non-selected events are ignored.
- Focused unit coverage: completed in `tests/unit/aircraft-layer.test.ts` and `tests/unit/orientation-permission-and-subscription.test.ts`.

## Assumptions
- OpenSky accepts multiple bounded requests more reliably than a single wrapped `lomin > lomax` interval.
- A short relative fallback delay is acceptable only when absolute-event support is exposed by the runtime; relative-only browsers should not incur startup delay.

## Preserved invariants
- Aircraft cache keys, response schema, and degraded fallback behavior are unchanged.
- Orientation permission results remain limited to `granted | denied | unavailable`.
- Viewer fallback semantics remain manual-pan whenever orientation is not granted.

## Intended behavior changes
- Antimeridian-spanning aircraft fetches now use valid non-inverted longitude intervals and merge the returned states.
- Platforms without explicit orientation permission APIs return `granted` only after a valid orientation event is observed within a bounded probe window.
- Orientation pose history and smoothing now consume exactly one event family after selection, with absolute samples able to preempt a pending relative fallback before lock-in.

## Known non-changes
- No new viewer route/query states were added.
- No UI copy, cache TTLs, or aircraft normalization logic were changed.
- No broader sensor or camera refactors were introduced.

## Expected side effects
- Antimeridian queries may issue two upstream OpenSky requests instead of one.
- Some browsers previously marked orientation-ready without live samples will now resolve to `unavailable`.

## Validation performed
- Attempted targeted Vitest run for `tests/unit/aircraft-layer.test.ts`, `tests/unit/orientation-foundation.test.ts`, and `tests/unit/orientation-permission-and-subscription.test.ts`, but the workspace does not have installed JS dependencies (`vitest` binary missing).
- Attempted `tsc --noEmit`; the workspace failed broadly on missing project dependencies/types (`next`, `react`, `vitest`, `zod`, Node types), so no clean typecheck result was available for this phase.
- Manually inspected the resulting diffs for scope, invariants, and adjacent regression surfaces.

## Deduplication / centralization
- Shared orientation event normalization was centralized in `getNormalizedOrientationSample()` so probing and live subscription use the same validity criteria.
