# Test Strategy

- Task ID: implement-skylensprd-md-73e90f91
- Pair: test
- Phase ID: ranking-settings-and-collisions
- Phase Directory Key: ranking-settings-and-collisions
- Phase Title: Ranking, settings, and collisions
- Scope: phase-local producer artifact

## Behavior to coverage map

- AC-1 ranking, candidate budgets, anchor order, and collision layout:
  `tests/unit/label-ranking.test.ts`
  Covers the dense-scene fixture, global label cap, viewport clamping, collision-free placement,
  PRD anchor fallback order, deterministic type-priority ordering, center-lock override, and
  per-type candidate budgets.
- AC-2 daylit planet center-lock continuity:
  `tests/unit/celestial-layer.test.ts`
  Covers `likelyVisibleOnly` daylight behavior where non-priority planets stay in the scene with
  label suppression metadata instead of disappearing before center-lock can select them.
- AC-2 viewer-shell center-lock and selected-card behavior:
  `tests/unit/viewer-shell-celestial.test.ts`
  Covers center-locked dock ownership, selected-object cards, and the no-center-lock fallback hint
  while the ranking pass operates on the full projected scene.
- AC-3 persisted settings document and reload behavior:
  `tests/unit/viewer-settings.test.tsx`
  Covers loading persisted settings, preserving offsets on recenter, shared demo-mode routing,
  mutating layer toggles plus likely-visible-only and calibration/FOV controls through the sheet,
  then remounting `ViewerShell` to verify those values reload from the same localStorage document.
- AC-3 settings sheet controls:
  `tests/unit/settings-sheet.test.tsx`
  Covers layer availability copy, opening calibration controls, and slider callbacks for the
  settings-sheet alignment UI.
- AC-1/AC-2 projection seam used by ranking and FOV persistence:
  `tests/unit/projection-camera.test.ts`
  Covers the locked FOV math and projection calculations that the viewer-shell ranking pass and FOV
  display depend on.

## Preserved invariants checked

- Persisted viewer controls remain one versioned localStorage document keyed by
  `skylens.viewer-settings.v1`.
- Recenter preserves heading, pitch, and vertical FOV offsets instead of wiping calibration.
- Daylit non-priority planets stay eligible for center-lock while ordinary daylight labels remain
  suppressed.
- Dense-scene ranking remains deterministic under the PRD ladder, per-type budgets, and global cap.

## Edge cases and failure paths

- Zero-overlap label layout in a dense mixed scene.
- Anchor fallback when the preferred anchor collides.
- Center-lock override against otherwise higher-priority object types.
- Likely-visible-only daylight filtering for non-priority planets.
- Persisted settings reload after toggling layers and changing calibration/FOV controls.

## Flake controls

- Ranking tests use the fixed dense-scene fixture and deterministic projection inputs.
- Viewer-shell celestial behavior uses mocked scene inputs instead of sensor startup timing.
- Settings persistence tests operate entirely through jsdom localStorage with explicit remounts and
  no timers or network.

## Validation refresh

- Updated `vitest.config.ts` to include `tests/unit/**/*.test.{ts,tsx}` so the checked-in TSX unit
  suites are exercised by `npm test`.
- Validation rerun: `npx vitest run tests/unit/viewer-settings.test.tsx`
- Validation rerun: `npx vitest run tests/unit/settings-sheet.test.tsx`
- Validation rerun:
  `npm test -- --run tests/unit/label-ranking.test.ts tests/unit/viewer-settings.test.tsx tests/unit/settings-sheet.test.tsx tests/unit/viewer-shell-celestial.test.ts tests/unit/celestial-layer.test.ts tests/unit/projection-camera.test.ts`
- Validation rerun: `npm test`
- Validation rerun: `npm run lint`
