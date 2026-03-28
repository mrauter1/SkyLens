# Test Strategy

- Task ID: skylensserverless-follow-up-fixes-task-fixes-1-a-1fc787a5
- Pair: test
- Phase ID: tle-relay-fallback-hardening
- Phase Directory Key: tle-relay-fallback-hardening
- Phase Title: Harden ordered TLE relay fallback
- Scope: phase-local producer artifact

## Behavior-to-coverage map

- Ordered relay fallback per source:
  `satellite-layer.test.ts` covers primary relay failure with secondary success and asserts each group retries on the next relay.
- Backward-compatible single-template support:
  `satellite-layer.test.ts` covers an explicitly configured single relay template and asserts all group fetches stay on that relay.
- Preserved stale-cache behavior:
  `satellite-layer.test.ts` covers stale-cache serving after refresh failure and stale-cache exhaustion after the stale window.
- Failure-path diagnostics:
  `satellite-layer.test.ts` covers all-relays-failing stale fallback logging and no-cache rejection with structured `groupId` / relay index / relay path assertions.
- Invalid relay template contract:
  `satellite-layer.test.ts` covers fail-fast rejection when a configured relay template omits `{url}` and asserts the actionable template message is preserved on `Error.cause` while the public failure string stays stable.

## Preserved invariants checked

- TLE payload normalization and NORAD dedupe remain intact.
- Public failure string remains `TLE data unavailable.` when no stale cache is available.
- Relay tests use fixture-backed fetch mocks and fixed timestamps to keep ordering and stale-window assertions deterministic.

## Edge cases and failure paths

- Single-template env value remains accepted without forcing comma-separated syntax.
- Primary relay HTTP failure falls through to the next relay template for each source.
- All relays failing still serves stale cache inside the stale window and rejects outside it.
- Invalid relay templates fail before any network fetch occurs and preserve actionable diagnostics on the wrapped cause.

## Known gaps

- Structured diagnostics are asserted via representative attempt entries rather than exhaustively enumerating every group attempt, because `Promise.all` exposes the first terminal group failure while sibling group requests may still be in flight.
