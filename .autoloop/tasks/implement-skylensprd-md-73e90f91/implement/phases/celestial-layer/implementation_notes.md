# Implementation Notes

- Task ID: implement-skylensprd-md-73e90f91
- Pair: implement
- Phase ID: celestial-layer
- Phase Directory Key: celestial-layer
- Phase Title: Celestial layer
- Scope: phase-local producer artifact

## Files changed

- `package.json`
- `package-lock.json`
- `next-env.d.ts`
- `components/settings/settings-sheet.tsx`
- `components/viewer/viewer-shell.tsx`
- `lib/viewer/contracts.ts`
- `lib/astronomy/celestial.ts`
- `lib/astronomy/stars.ts`
- `lib/astronomy/constellations.ts`
- `public/data/stars_200.json`
- `public/data/constellations.json`
- `tests/unit/celestial-layer.test.ts`
- `tests/unit/viewer-shell-celestial.test.ts`
- `.autoloop/tasks/implement-skylensprd-md-73e90f91/decisions.txt`
- `.autoloop/tasks/implement-skylensprd-md-73e90f91/implement/phases/celestial-layer/implementation_notes.md`

## Symbols touched

- `ObjectType`
- `SkyObject`
- `StarCatalogEntry`
- `ConstellationCatalogEntry`
- `normalizeCelestialObjects`
- `getSolarAltitudeDeg`
- `loadStarCatalog`
- `normalizeVisibleStars`
- `loadConstellationCatalog`
- `validateConstellationCatalog`
- `buildVisibleConstellations`
- `ViewerShell`
- `SettingsSheet`

## Checklist mapping

- M3 bundled `stars_200.json` and `constellations.json`: complete
- M3 Sun/Moon/planet/star/constellation normalization: complete
- M3 likely-visible-only and horizon filtering for celestial objects: complete
- M3 center-lock bottom dock and celestial detail-card behavior: complete
- M3 critical astronomy failure hard banner plus demo fallback: complete
- M3 fixture-backed celestial tests and detail-card field locks: complete

## Assumptions

- The current phase keeps one fixed demo observer/time seam from the existing viewer shell; the required multi-scenario demo catalog remains a later milestone.
- The checked-in bundled catalogs are deterministic reductions of static upstream astronomy data and are treated as locked repo assets after generation.

## Preserved invariants

- `SkyObject` remains the shared cross-layer object contract before focus, projection, and card rendering.
- Celestial visibility keeps `0 = north`, `90 = east`, horizon gating, and PRD likely-visible-only daylight behavior for planets, stars, and constellations.
- Center-lock still uses the fixed 4-degree angular radius from the projection layer.
- Critical live astronomy errors do not leave the live viewer partially active; the shell switches to demo mode and surfaces a hard banner.

## Intended behavior changes

- Replaced the dummy projection harness with live celestial, star, and constellation scene assembly in the viewer shell.
- Added bundled bright-star and constellation catalogs and the client-side astronomy modules that normalize them.
- Wired the bottom dock to the active center-locked celestial object only, and render tapped non-centered labels in a separate selected-object detail card so the dock still falls back to the reticle hint when nothing qualifies.
- Made settings-layer visibility toggles and the `Likely visible only` toggle drive the celestial scene immediately.

## Known non-changes

- No satellite or aircraft live-data integration yet.
- No final dense-scene ranking/collision algorithm beyond the existing shell-level display cap.
- No multi-scenario demo selector or demo satellite/aircraft sample data yet.

## Expected side effects

- `next-env.d.ts` now points at the stable `.next/types` routes file after the final production build.
- The viewer shell now imports Astronomy Engine and bundled catalogs on the client route, increasing `/view` bundle work as expected for this milestone.

## Validation performed

- `npm run lint`
- `npm run test`
- `npm run build`

## Deduplication / centralization

- Centralized celestial object math in `lib/astronomy/celestial.ts` instead of recomputing body positions in the viewer.
- Centralized star catalog loading and constellation catalog validation in the dedicated astronomy modules.
- Kept label suppression in the viewer shell while leaving the full visible star set available to constellation eligibility, avoiding duplicated “budget” logic across astronomy modules.
