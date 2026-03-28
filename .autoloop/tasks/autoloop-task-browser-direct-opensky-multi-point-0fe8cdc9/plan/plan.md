# Browser-Direct OpenSky + Multi-Point Tracker Plan

## Scope
- Refactor aircraft data flow from server-proxied `/api/aircraft` snapshots to browser-direct anonymous OpenSky `/states/all` fetches.
- Replace two-snapshot aircraft interpolation/dead-reckoning with a persistent per-aircraft multi-sample tracker owned by `ViewerShell`.
- Preserve existing non-aircraft behavior: satellites, stars, planets, constellations, alignment flows, and demo-mode entry points.
- Remove aircraft server cache/auth/health surfaces and update privacy copy plus stale references/docs/config.

## Milestones
1. Contracts and fetch path
   - Rewrite `lib/aircraft/contracts.ts` around `snapshotTimeS`, observer-relative aircraft fields, `trackDeg`, and optional OpenSky metadata.
   - Add `lib/aircraft/opensky-browser.ts` using anonymous browser `fetch`, bbox generation, antimeridian split/merge, dedupe by id, observer-relative filtering, and explicit transport-failure signaling without app cache.
   - Rewrite `lib/aircraft/client.ts` as a thin browser facade over the new fetcher and remove `/api/aircraft` usage.
2. Tracker and motion integration
   - Add `lib/aircraft/tracker.ts` with bounded per-aircraft history, recency-weighted estimation, turn hysteresis, prediction, stale fade/drop, and trail generation.
   - Refactor `lib/viewer/motion.ts` to keep satellite logic intact while changing aircraft motion resolution to consume tracker output instead of snapshot interpolation.
   - Refactor `components/viewer/viewer-shell.tsx` so it owns the polling loop, tracker ref, ingest revision state, availability state, `latestAircraftSnapshotTimeS`, and tracker-driven trail rendering.
3. Cleanup, compatibility, validation
   - Delete `app/api/aircraft/route.ts` and `lib/aircraft/opensky.ts`.
   - Remove `aircraftCache` from health contracts/route while leaving satellite cache health untouched.
   - Update `lib/config.ts` ownership for polling cadence/default radius/privacy copy, demo scenarios, tests, and repo-wide stale references (`/api/aircraft`, `aircraftCache`, OpenSky auth env vars, `headingDeg`, legacy snapshot state names).
   - Run `npm run lint`, `npm test`, and `npm run build` and fix regressions before handoff.

## Interfaces
### `lib/aircraft/contracts.ts`
- `AircraftQuerySchema`
  - defaults `radiusKm` to `180`, max still bounded to current UI-supported ceiling unless implementation finds a stricter existing constraint that must stay aligned.
- `AircraftApiResponse`
  - `fetchedAt: string`
  - `snapshotTimeS: number`
  - `observer: { lat: number; lon: number; altMeters: number }`
  - `availability: 'available' | 'degraded'`
  - `aircraft: AircraftApiAircraft[]`
- `AircraftApiAircraft`
  - required: `id`, `lat`, `lon`, `azimuthDeg`, `elevationDeg`, `rangeKm`
  - optional: `callsign`, `originCountry`, `geoAltitudeM`, `baroAltitudeM`, `velocityMps`, `trackDeg`, `verticalRateMps`, `timePositionS`, `lastContactS`, `onGround`, `positionSource`, `category`
- Compatibility break
  - aircraft `headingDeg` is removed from the aircraft contract and all aircraft UI/detail labels become `Track` or `Direction`.

### `lib/aircraft/opensky-browser.ts`
- Public surface
  - `fetchOpenSkyAircraft(query: AircraftQuery, fetchImpl?: typeof fetch, now?: Date): Promise<AircraftApiResponse>`
  - `AircraftFetchError` or equivalent typed failure carrying enough reason/status detail for `ViewerShell` tests and degraded-availability handling
- Responsibilities
  - build one or two `/states/all` URLs using bbox + antimeridian split
  - do anonymous `fetch` only, no auth flow, no `time` query param
  - parse OpenSky `time` into `snapshotTimeS`
  - map indices exactly as specified in the request
  - drop rows missing id, lat/lon, or both altitude fields
  - compute azimuth/elevation/range against query observer, filter by `radiusKm` and `MIN_AIRCRAFT_ELEVATION_DEG`, sort by range then id, slice to limit, and validate through `AircraftApiResponseSchema`
  - on successful upstream responses, return validated snapshots only; on network failure, non-OK status, 429, or invalid upstream payload, throw a typed failure so the caller can degrade availability without ingesting an empty snapshot into the tracker
- Reuse
  - keep the current bbox, antimeridian, bearing, and distance math local to aircraft modules; do not introduce a new cross-cutting geo helper layer for this task.

### `lib/aircraft/client.ts`
- Public surface
  - `fetchAircraftSnapshot(observer, fetchImpl?)`
  - `normalizeAircraftObjects({ tracker, timeMs, observer, enabledLayers })`
  - `getAircraftAvailabilityMessage(availability)`
- Behavior
  - `fetchAircraftSnapshot` delegates to `fetchOpenSkyAircraft`
  - transport/rate-limit failures stay exceptional at the client boundary so live polling can mark degraded availability without mutating tracker contents
  - `normalizeAircraftObjects` becomes tracker-based and no longer accepts `previousSnapshot` or `transitionStartedAtMs`

### `lib/config.ts`
- Own public aircraft-related configuration that is read outside the tracker internals:
  - default aircraft radius `180`
  - `POLL_INTERVAL_MS_BY_QUALITY = { low: 30_000, balanced: 15_000, high: 10_000 }`
  - updated `PRIVACY_REASSURANCE_COPY`
- `lib/aircraft/tracker.ts` owns tracker/prediction/trail constants; `viewer-shell` reads cadence/defaults from config and does not duplicate them locally.

### `lib/aircraft/tracker.ts`
- Constants to codify in tracker/config usage
  - `TRACK_HISTORY_LIMIT = 12`
  - `TRACK_ESTIMATION_WINDOW = 6`
  - `TRACK_HISTORY_MAX_AGE_MS = 120_000`
  - `STALE_AFTER_MS = 20_000`
  - `DROP_AFTER_MS = 30_000`
  - `MAX_PREDICTION_MS = 15_000`
  - `TURN_ENTER_THRESHOLD_DEG_PER_S = 0.8`
  - `TURN_EXIT_THRESHOLD_DEG_PER_S = 0.3`
  - `TRAIL_HISTORY_WINDOW_MS = 40_000`
  - `TRAIL_FUTURE_WINDOW_MS = 6_000`
  - `TRAIL_STEP_MS = 1_000`
- Public surface
  - `createAircraftTracker(): AircraftTracker`
  - `ingest(snapshot: AircraftApiResponse): void`
  - `resolve(params: { observer: AircraftApiResponse['observer']; nowMs: number }): ResolvedTrackedAircraft[]`
  - `getTrail(params: { id: string; observer: AircraftApiResponse['observer']; nowMs: number }): AircraftTrailPoint[]`
  - `prune(nowMs: number): void`
  - `reset(): void`
- `ResolvedTrackedAircraft`
  - normalized aircraft contract fields for the resolved position plus `motionState: 'live' | 'estimated' | 'stale'` and `motionOpacity: number`
- `AircraftTrailPoint`
  - timestamped world/local-space-ready positional sample with resolved `lat`, `lon`, altitude, and observer-relative angles/range so the viewer can project each point without re-running tracker history logic
- Tracker rules
  - key by aircraft id
  - cap per-aircraft history to 12 samples and 120 seconds
  - primary sample timing `timePositionMs`, fallback `snapshotTimeMs`
  - derive observed speed/track/vertical-rate from adjacent samples
  - blend reported and observed motion with 0.7 reported / 0.3 observed weights, circularly for track
  - enter turn mode after 2 consecutive intervals above threshold, exit after 2 below threshold
  - predict from `timePositionMs ?? snapshotTimeMs` up to 15 seconds ahead using straight or constant-turn motion in local tangent plane plus constant vertical velocity
  - fade from 1 to 0 between 20 and 30 seconds since anchor, prune after 30 seconds even if viewer misses polls

### `lib/viewer/motion.ts`
- Keep existing satellite resolution code unchanged except for any shared type fallout.
- Replace aircraft snapshot interpolation helpers with tracker adapters:
  - `resolveAircraftMotionObjects({ tracker, timeMs, observer, enabledLayers })`
  - map tracker-resolved aircraft to `SkyObject`s, preserving `motionOpacity` and `motionState`
  - update aircraft detail metadata label/value generation from `headingCardinal` to `trackCardinal` or equivalent UI wording
- `resolveMovingSkyObjects` should stay available if still useful, but any aircraft inputs should be tracker-based rather than `previousSnapshot`/`transitionStartedAtMs`.

### `components/viewer/viewer-shell.tsx`
- Remove `AircraftTemporalState`, `currentSnapshot`, `previousSnapshot`, and `transitionStartedAtMs`.
- Add local aircraft state:
  - `aircraftTrackerRef = useRef(createAircraftTracker())`
  - `aircraftRevision` incremented after successful ingest so renders pick up tracker changes
  - `aircraftAvailability`
  - `latestAircraftSnapshotTimeS`
- Polling loop requirements
  - active only in live mode with observer present, aircraft layer enabled, and document visible
  - use `AbortController` to cancel in-flight request on dependency changes and unmount
  - cadence from `POLL_INTERVAL_MS_BY_QUALITY`
  - when quality is `high`, schedule next poll just after the next 10-second OpenSky bucket boundary derived from `snapshotTimeS`
  - success ingests only validated successful snapshots into the tracker, bumps revision, updates availability and snapshot time, and prunes stale tracks
  - failure marks availability degraded, does not call `ingest` with empty/degraded placeholder data, and does not clear or reset tracker state
- Rendering
  - live mode aircraft come from `tracker.resolve({ observer, nowMs: sceneTimeMs })`
  - demo mode seeds tracker from deterministic scenario snapshots instead of using the live poll path
  - selected or center-locked aircraft trail comes from `tracker.getTrail(...)` each frame

## Compatibility Notes
- Intentional removals
  - `/api/aircraft` route is deleted; browser runtime calls OpenSky directly.
  - `lib/aircraft/opensky.ts` and all aircraft auth env var references are removed.
  - `/api/health` no longer returns `aircraftCache`; only app and TLE health remain.
- Consumer updates required
  - failed OpenSky fetches now remain exceptional through the browser client so polling code can preserve tracker state while degrading availability
  - tests and mock payload builders must emit `snapshotTimeS` and `trackDeg`
  - any health parsing/UI assumptions about `aircraftCache` must be removed
  - privacy copy and docs must state that approximate location-based aircraft queries go directly from browser to OpenSky and that camera frames stay on-device

## Regression Controls
- Preserve satellite motion code paths and cache-health semantics as-is; aircraft refactor must not widen scope into celestial/satellite logic.
- Keep demo scenarios deterministic by storing seed aircraft snapshots in the new contract and ensuring the viewer seeds/resolves through the tracker without live polling.
- Treat transport/rate-limit failures as non-ingest events so missed polls degrade/fade existing targets instead of causing pop-out regressions from empty snapshot ingestion.
- Keep aircraft filtering/sorting behavior observer-relative and stable: min elevation, radius limit, range-first ordering, id tie-break.
- Gate browser-only polling by visibility and live mode so server render and hidden-tab behavior do not start unintended network traffic.

## Validation
- Unit coverage
  - browser client fetcher: anonymous success, antimeridian merge/dedupe, exact OpenSky index mapping, `snapshotTimeS`, optional field preservation, filtering/sort/limit, and typed failure handling for network errors and 429 responses
  - tracker: straight prediction, turn hysteresis, stale fade/prune, observed-delta fallback, curved world-space trails, graceful missed-poll decay
  - viewer shell: tracker ingest path, failed polls retain prior aircraft because failures do not ingest empty snapshots, cadence changes by motion quality, tracker trail rendering, privacy copy, health parsing without `aircraftCache`
- Cleanup grep
  - resolve all hits for `/api/aircraft`, `aircraftCache`, `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`, `headingDeg`, `previousSnapshot`, `transitionStartedAtMs`
- Final commands
  - `npm run lint`
  - `npm test`
  - `npm run build`

## Risk Register
- Browser-direct OpenSky access may fail more often than the former proxy path.
  - Control: typed fetch-failure contract, viewer-side degraded handling without ingest, and explicit tests for non-OK and 429.
- Tracker math can introduce visible jumps or wrong turn prediction.
  - Control: keep estimation local to aircraft module, codify constants, cover hysteresis/straight/curved paths with direct tracker tests.
- Viewer-shell refactor can accidentally break live/demo gating or hidden-tab behavior.
  - Control: isolate polling conditions, use abortable effect cleanup, add cadence and failure-retention tests.
- Health/privacy/docs cleanup can lag behind code changes.
  - Control: include grep cleanup in the acceptance path and treat stale references as blockers before final validation.

## Rollback
- If implementation destabilizes aircraft rendering, revert to the pre-refactor aircraft module set as one slice: `viewer-shell`, `viewer/motion`, `lib/aircraft/*`, health route/contracts, and affected tests/docs together.
- Do not partially restore `/api/aircraft` or server caching/auth; rollback must restore the full old aircraft path or keep the new browser-direct path coherent.
