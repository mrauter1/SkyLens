# SkyLens Implementation Plan

## Scope and baseline

- Source of truth: [SkyLensPRD.md](/workspace/SkyLens/SkyLensPRD.md)
- Clarifications: none beyond the immutable request snapshot and current run log
- Repo state: greenfield app; there is no product code to preserve, so this plan must lock the first implementation contracts and validation inventory
- Delivery target: implement the approved v1 exactly as specified, in the PRD milestone order, with no scope substitutions or inferred feature cuts

## Locked implementation decisions

- Build a Next.js App Router TypeScript app with Tailwind, Zod, Vitest, and Playwright; use npm scripts exactly as required by the PRD.
- Keep server state disposable: Next.js Node route handlers plus one in-memory cache interface, with lazy repopulation after restart and no persistent storage.
- Normalize every renderable entity into the shared `SkyObject` model before projection, ranking, trails, center-lock, or detail-card rendering.
- Keep live mode and demo mode on the same projection, ranking, focus-card, and detail-card pipeline; demo mode may change only the observer/time/data sources and background.
- Treat deterministic math, visibility rules, degraded-mode behavior, and stable object identity as the primary regression surface; lock them behind fixtures before polish.
- Keep the landing route and viewer route code-split from each other so the landing page does not pull the full viewer stack before the user enters `/view`.

## Milestones

### M1. App shell, manifest, config bootstrap, permissions, fallback shell

- Create the Next.js/Tailwind/Vitest/Playwright skeleton, App Router layout, `/` landing page, `/view` route shell, `app/manifest.ts`, required icons, and PRD-required package scripts.
- Implement `GET /api/config` in this milestone so the shell boots from the locked defaults, enabled layers, satellite groups, and `SKYLENS_BUILD_VERSION` contract from day one.
- Implement permission gating only from the `Start SkyLens` user gesture in this order: location, camera, orientation/motion.
- Make the required trust copy and entry points explicit shell requirements: `/` must show the one-sentence description, privacy reassurance, `Start SkyLens`, and `Try demo mode`; `/view` must continue to show the required trust messaging in the live/fallback flow.
- Build fallback routing so location denial blocks with retry/demo actions, camera denial enters non-camera mode, and orientation denial enters manual-pan mode.
- Validation:
  - `GET /api/config` returns the exact PRD bootstrap shape, including `maxLabels`, `radiusKm`, `verticalFovDeg`, `likelyVisibleOnly`, `enabledLayers`, and the three satellite groups.
  - `npm run build`, `npm run lint`, `npm run test`, and `npm run test:e2e` are wired in `package.json`.
  - Playwright covers landing load, Start button visibility, required privacy/trust copy, demo entry link, and denied-permission fallback entry.

### M2. Sensor, camera, location, and projection foundation

- Implement `lib/sensors/orientation.ts`, `lib/sensors/location.ts`, and `lib/projection/camera.ts`.
- Expose a normalized observer and pose contract for all downstream layers:

```ts
export interface ObserverState {
  lat: number
  lon: number
  altMeters: number
  accuracyMeters?: number
  timestampMs: number
  source: 'live' | 'demo'
}

export interface CameraPose {
  yawDeg: number
  pitchDeg: number
  rollDeg: number
  quaternion: [number, number, number, number]
  alignmentHealth: 'good' | 'fair' | 'poor'
  mode: 'sensor' | 'manual'
}
```

- Implement rear-camera acquisition with `facingMode: { exact: 'environment' }`, fallback to `facingMode: 'environment'`, preferred `1280x720`, and never request microphone access.
- Implement `deviceorientationabsolute` preference, `deviceorientation` fallback, smoothing, heading/pitch offsets, recenter semantics, one-shot high-accuracy startup location, watch-position updates only after `>25m` movement or `15s`, fixed-FOV math, world-vector projection, and center-reticle targeting with the locked `4°` center-lock radius using dummy objects.
- Validation:
  - Unit tests for FOV math, quaternion normalization, world-to-screen projection, screen-orientation correction, alignment-health scoring, and manual-pan fallback behavior.
  - Fixtures prove the one-time orientation-denied/manual-pan instruction path and the location update thresholds.

### M3. Celestial, stars, constellations, center-lock, and critical astronomy fallback

- Ship bundled datasets at `public/data/stars_200.json` and `public/data/constellations.json`.
- Implement Astronomy Engine-backed Sun, Moon, planet, star, and constellation pipelines with 1 Hz recomputation, horizon filtering, likely-visible-only gating, constellation eligibility rules, and center-lock detail-card behavior.
- Lock the celestial/stellar detail-card payloads in this milestone:
  - Sun, Moon, and planets: `name`, `type`, current `elevation`, current `azimuth`, optional constellation name, optional magnitude
  - Stars: `name`, `type`, `magnitude`, current `elevation`, optional constellation name
  - Constellations: `name`, `type`, and `Major star pattern` summary text
- Keep constellation labels dependent on projected line visibility and star IDs from the bundled catalog only.
- Treat astronomy failure as a critical degraded mode in this milestone: show the hard error banner and enter demo mode instead of leaving the live viewer in a partial state.
- Validation:
  - Fixture-based projection tests for known observer/time/camera inputs with the PRD tolerances.
  - Unit tests for visibility decisions, daylight simplification triggers, constellation eligibility, celestial/star/constellation detail-card payload completeness, and `SkyObject.id` stability.

### M4. Satellite layer and TLE backend

- Introduce `lib/cache` in this milestone as the shared in-memory cache boundary, then implement `GET /api/tle`, CelesTrak group fetch/merge, NORAD deduplication, `6h` refresh, `24h` stale-cache fallback, and `lib/satellites/client.ts`.
- Lock the `/api/tle` payload to `fetchedAt`, `expiresAt`, optional `stale`, and `satellites[]` entries containing `id`, `name`, `noradId`, `groups`, `tle1`, `tle2`, and `isIss`.
- Preserve overlapping `groups` membership while collapsing duplicate NORAD records into one satellite object.
- Always mark ISS via `metadata.isIss` and keep ISS includable whenever present in source data.
- Lock the satellite detail-card payload in this milestone to `name`, `type`, `NORAD ID`, current `elevation`, current `azimuth`, optional `range`, and the ISS badge.
- Validation:
  - Integration tests for normalized API payload, stale response semantics, cache freshness behavior, and no-cache hide-layer behavior.
  - Unit tests for propagation normalization, stable NORAD identity, likely-visible-only satellite gating, and satellite detail-card payload completeness.

### M5. Aircraft layer and OpenSky proxy

- Implement `GET /api/aircraft`, query validation, authenticated/anonymous OpenSky fallback, 10-second location-bucket cache, and graceful degraded behavior.
- Compute azimuth, elevation, and range on the backend; never expose direct OpenSky access from the client.
- Normalize aircraft to stable ICAO24-based IDs where available, exclude incomplete state vectors, and include an explicit aircraft-availability signal in degraded responses so the UI can show `Live aircraft temporarily unavailable`.
- Lock the aircraft detail-card payload in this milestone to callsign-or-fallback name, `type`, altitude in feet and meters, optional cardinal heading, optional speed, range from observer, and optional origin country.
- Keep error messages secret-safe and validate all external payloads with Zod before normalization.
- Validation:
  - Integration tests for `400` handling, valid normalization, outage degradation with empty aircraft results plus availability signal, cache-key bucketing at `0.1°`, and aircraft detail-card payload completeness.

### M6. Ranking, collision management, settings persistence, and visibility policy

- Implement `lib/labels/ranking.ts`, the exact global label budget (`18`), per-type candidate budgets (aircraft `12`, satellites `8`, stars `30`), PRD type priority ladder, greedy anchor order (`above`, `below`, `right`, `left`), `24px` minimum spacing, and viewport-clamped label rendering.
- Persist layer toggles, likely-visible-only, heading offset, pitch offset, FOV adjustment, and onboarding completion in `localStorage`.
- Build the settings sheet with the required layer toggles, `Likely visible only`, `Fix alignment`, `Recenter`, and `Enter demo mode` actions, plus subtle availability messaging for degraded aircraft/satellite states.
- Keep the settings-sheet `Enter demo mode` action wired to the same shared demo pipeline as landing/fallback entry, without introducing a separate demo-only viewer path.
- Wire daylight simplification, likely-visible-only exceptions, and the poor-alignment banner exactly as specified.
- Validation:
  - Fixture tests for dense-scene suppression order, center-lock priority override, settings rehydration, daylight simplification rules, zero-overlap label placement, and in-view settings-driven demo entry.

### M7. Demo mode, trails, accessibility, health, and full verification

- Implement deterministic demo mode with bundled scenarios for `San Francisco — Clear evening`, `New York — Busy daylight sky`, and `Tokyo — Night with ISS pass`, plus offline-safe sample aircraft/satellite data as needed.
- Implement manual pan/tilt desktop fallback, double-tap recenter, focus trails, reduced-motion behavior, keyboard-accessible controls, focus-trapped settings on desktop, and minimum touch target/contrast requirements.
- Implement `GET /api/health` to report app server health plus OpenSky and TLE cache freshness.
- Finish the full unit, integration, and E2E matrix, including the PRD-required named fixtures, and run the required scripts successfully.
- Validation:
  - Playwright covers demo mode labels, detail-card opening, and settings persistence.
  - Final verification runs `npm run build`, `npm run lint`, `npm run test`, and `npm run test:e2e`.

## Public interfaces and contracts

### Client domain model

Use the PRD `SkyObject`, `StarCatalogEntry`, and `ConstellationCatalogEntry` shapes unchanged. Additional client-only derived types are allowed, but `SkyObject.id`, `type`, `azimuthDeg`, `elevationDeg`, `importance`, and metadata-driven detail rendering remain the canonical cross-layer contract.

### Detail-card contract

- Aircraft cards must show callsign when available, otherwise `Unknown flight`, plus `type`, altitude in feet and meters, optional cardinal heading, optional speed, range, and optional origin country.
- Satellite cards must show `name`, `type`, `NORAD ID`, current `elevation`, current `azimuth`, optional range, and an ISS badge when applicable.
- Sun, Moon, and planet cards must show `name`, `type`, current `elevation`, current `azimuth`, optional constellation name, and optional magnitude.
- Star cards must show `name`, `type`, `magnitude`, current `elevation`, and optional constellation name.
- Constellation cards must show `name`, `type`, and the brief text `Major star pattern`.
- Each object-producing phase must populate the required metadata needed to render its card contents, and tests must fail if a supported object type omits a locked field without PRD permission.

### API contracts

- `GET /api/config`
  - Returns the exact PRD bootstrap shape with `buildVersion`, `defaults`, and `satelliteGroups`.
  - `defaults.enabledLayers` must start as `["aircraft", "satellites", "planets", "stars", "constellations"]`.
- `GET /api/tle`
  - Returns `fetchedAt`, `expiresAt`, optional `stale`, and deduplicated `satellites[]`.
  - Each satellite entry keeps stable NORAD-based identity and preserves overlapping `groups`.
- `GET /api/aircraft`
  - Accepts `lat`, `lon`, optional `altMeters`, `radiusKm`, and `limit`; invalid input returns `400`.
  - Returns `fetchedAt`, `observer`, normalized `aircraft[]`, and an explicit aircraft-availability indicator for degraded upstream states.
- `GET /api/health`
  - Returns app server health plus OpenSky and TLE cache freshness state.

### Cache boundary

Implement one small cache interface in `lib/cache` and back both TLE and aircraft caches with it:

```ts
export interface CacheEntry<T> {
  value: T
  fetchedAt: string
  expiresAt: string
  stale?: boolean
}
```

Keep TTL and stale-window policy in the feature modules, not the generic cache wrapper.

## Compatibility and operational notes

- No migration is required because the repository has no existing app code or persisted server data.
- Public compatibility starts with this implementation: API response shapes, env vars, settings keys, bundled data paths, and required scripts must be treated as locked once introduced.
- The app must remain a secure-context mobile web app; do not plan non-secure fallbacks for camera or orientation APIs.
- `/api/config` is a public bootstrap contract established in M1; later phases may consume it but must not repurpose or silently narrow its response.
- Required environment variables:
  - `OPENSKY_CLIENT_ID`
  - `OPENSKY_CLIENT_SECRET`
  - `SKYLENS_BUILD_VERSION`
- Privacy and trust constraints are non-negotiable:
  - camera frames never leave the device
  - backend never persists raw user location
  - backend may receive current location only as request parameters for aircraft filtering
  - error responses must not leak secrets
  - landing and viewer UI must keep the required trust copy visible in the flow

## Verification inventory

- Required script endpoints:
  - `npm run dev`
  - `npm run build`
  - `npm run start`
  - `npm run lint`
  - `npm run test`
  - `npm run test:watch`
  - `npm run test:e2e`
- Required named fixtures:
  - `tests/fixtures/observer/sf_evening.json`
  - `tests/fixtures/observer/ny_day.json`
  - `tests/fixtures/sensors/steady_heading.json`
  - `tests/fixtures/sensors/noisy_heading.json`
  - `tests/fixtures/opensky/sample_dense.json`
  - `tests/fixtures/tle/stations.txt`
  - `tests/fixtures/tle/brightest.txt`
  - `tests/fixtures/demo/tokyo_iss.json`
- Required tolerances:
  - screen projection tolerance: `±20px`
  - angular calculation tolerance: `±0.5°`

## Regression prevention and invariants

- Mathematical invariants:
  - azimuth uses `0=north`, `90=east`
  - projection hides objects with camera-space `z <= 0`
  - effective vertical FOV is `clamp(50 + adjustment, 40, 60)`
  - horizontal FOV is derived from aspect ratio, not hard-coded separately
  - center-lock uses a fixed `4°` angular radius and is angular, not pixel-based
- Visibility invariants:
  - aircraft render only at `elevation >= 2°`
  - satellites render only at `elevation >= 10°`
  - stars and constellations require `Sun altitude <= -6°` in likely-visible-only mode
  - satellites require `Sun altitude <= -4°` in likely-visible-only mode
  - labels never render outside the viewport and never overlap
- Identity invariants:
  - aircraft IDs remain stable from ICAO24 when available
  - satellite IDs remain stable from NORAD ID
  - IDs must survive recomputation for trails and focused-object continuity
- Resilience invariants:
  - OpenSky outage hides aircraft gracefully and exposes degraded availability state to the UI
  - missing live TLE data hides only the satellite layer if no cached or stale data exists
  - astronomy failure is treated as critical and routes to demo mode with a hard error banner
  - demo mode remains usable without live network dependencies

## Risk register

| Risk | Why it matters | Control |
| --- | --- | --- |
| Browser orientation differences cause drift or mirrored overlays | Core product trust depends on stable alignment | Normalize sensor events behind one pose interface, include recenter/offset controls, and test steady vs noisy fixtures |
| Projection math regressions make overlays appear in wrong sky regions | A small math error breaks every object class | Put projection, angle normalization, center-lock, and visibility thresholds under fixture-backed tests before all data layers land |
| OpenSky and CelesTrak outages create broken UI states | Two core live data sources are external and unstable | Implement cache-first degradation, stale metadata, empty-layer handling, and health reporting |
| Dense scenes produce unreadable labels | Mobile viewport is tight and label readability is a success criterion | Enforce PRD budgets, anchor order, and minimum spacing with dense-scene fixture tests |
| Demo mode drifts from live behavior | Separate logic would double regression surfaces | Reuse the same normalization, projection, ranking, and detail-card paths for live and demo modes |
| Public API contracts drift during implementation | Greenfield repos often regress by reshaping early endpoints | Lock `/api/config`, `/api/tle`, `/api/aircraft`, and fixture names in the first implementation plan and test them as public contracts |

## Rollout and rollback

- Rollout order follows milestones M1 through M7 with each milestone landing in a runnable state.
- If a later milestone destabilizes the viewer, rollback is by disabling the affected layer or mode behind the existing settings and route boundaries rather than rewriting shared math or sensor contracts.
- Keep backend routes additive and isolated so aircraft or satellite regressions can be disabled independently while preserving celestial and demo functionality.
- If config wiring regresses, rollback keeps `/api/config` live with the PRD static defaults/build version contract instead of removing the endpoint or changing its shape.
- If live data integration regresses late, preserve deterministic demo mode and core celestial rendering rather than shipping a broken live overlay path.
