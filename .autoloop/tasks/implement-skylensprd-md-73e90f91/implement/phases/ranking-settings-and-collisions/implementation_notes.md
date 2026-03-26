# Implementation Notes

- Task ID: implement-skylensprd-md-73e90f91
- Pair: implement
- Phase ID: ranking-settings-and-collisions
- Phase Directory Key: ranking-settings-and-collisions
- Phase Title: Ranking, settings, and collisions
- Scope: phase-local producer artifact

## Files changed

- `lib/labels/ranking.ts`
- `lib/viewer/settings.ts`
- `lib/permissions/coordinator.ts`
- `lib/astronomy/celestial.ts`
- `components/landing/landing-screen.tsx`
- `components/settings/settings-sheet.tsx`
- `components/viewer/viewer-shell.tsx`
- `lib/astronomy/constellations.ts`
- `tests/fixtures/labels/dense_scene.json`
- `tests/unit/label-ranking.test.ts`
- `tests/unit/viewer-settings.test.tsx`
- `tests/unit/settings-sheet.test.tsx`
- `tests/unit/viewer-shell-celestial.test.ts`
- `tests/unit/celestial-layer.test.ts`
- `.autoloop/tasks/implement-skylensprd-md-73e90f91/decisions.txt`

## Symbols touched

- `layoutLabels`, `selectLabelCandidates`, `getLabelRankScore`
- `readViewerSettings`, `writeViewerSettings`, `markViewerOnboardingCompleted`
- `createDemoViewerRoute`
- `normalizeCelestialObjects`, `isCelestialDaylightLabelSuppressed`
- `SettingsSheet`
- `ViewerShell`, `buildSkyScene`, `getViewportFromBounds`
- `buildVisibleConstellations`

## Checklist mapping

- M6 visibility filtering, rank scoring, global cap, anchor order, and greedy collision handling: done
- M6 persisted settings sheet with toggles, likely-visible-only, calibration offsets, FOV, fix-alignment, recenter, and demo entry: done
- M6 shared demo-route handoff from settings and landing/viewer paths: done
- M6 alignment warning text and calibration controls: done
- M6 daylight simplification exactness for center-locked daylit planets: done
- M6 dense-scene ranking fixtures/tests and persisted-settings tests: done

## Assumptions

- The PRD only locks explicit candidate budgets for aircraft, satellites, and stars; other object types stay uncapped before the global label pass.
- `skylens.viewer-settings.v1` is the first locked persisted-settings key for this app.
- Zero-sized stage measurements are treated as non-authoritative and fall back to the default mobile viewport.

## Preserved invariants

- Global label cap stays `18`.
- Minimum label spacing stays `24px` with zero rectangle overlap tolerance.
- Labels clamp to the viewport, while constellation lines still use overscan-aware projection.
- Daylit non-priority planets remain hidden from ordinary labels unless centered or explicitly selected, but they stay eligible for center-lock.
- Recenter does not wipe persisted heading/pitch/FOV offsets.
- Demo mode entry still flows through the shared `/view` route-state contract.

## Intended behavior changes

- Labels now rank by the PRD ladder, enforce per-type candidate budgets, and resolve dense collisions greedily instead of slicing by raw importance.
- Viewer settings now persist layer toggles, likely-visible-only, calibration offsets, FOV adjustment, and onboarding completion in localStorage.
- The settings sheet now exposes the full alignment controls and routes `Enter demo mode` through the shared deterministic demo entry helper.
- Daylight likely-visible-only now keeps non-priority planets in the scene for center-lock continuity while suppressing their labels until centered or selected.

## Known non-changes

- Trail rendering and demo-scenario polish remain deferred.
- No new sky object classes were introduced.
- Satellite and stellar daylight eligibility rules remain in their existing pipelines; only the daylit non-priority planet center-lock case changed in this turn.

## Expected side effects

- Off-screen-but-overscan objects can still receive clamped labels when their ranking survives the collision pass.
- Changing heading/pitch/FOV sliders immediately reprojects labels and constellation lines using the persisted offsets.
- Landing/demo entry now records onboarding completion in the same settings document used by the viewer.

## Validation performed

- `npm run lint`
- `npm test`
- `npm test -- --run tests/unit/celestial-layer.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-settings.test.tsx tests/unit/label-ranking.test.ts`
- `npm test -- --run tests/unit/label-ranking.test.ts tests/unit/viewer-settings.test.tsx tests/unit/settings-sheet.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/celestial-layer.test.ts tests/unit/projection-camera.test.ts`
- `npm run build` (did not complete within repeated 60s waits after `Creating an optimized production build ...`; no failure output surfaced)

## Deduplication / centralization

- Centralized label ranking, per-type budgets, and collision/layout math in `lib/labels/ranking.ts`.
- Centralized persisted viewer settings and onboarding bookkeeping in `lib/viewer/settings.ts`.
- Reused one shared demo-route helper instead of duplicating demo-entry state construction across landing and viewer actions.
