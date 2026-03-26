# Test Strategy

- Task ID: implement-skylensprd-md-73e90f91
- Pair: test
- Phase ID: celestial-layer
- Phase Directory Key: celestial-layer
- Phase Title: Celestial layer
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- AC-1 fixture math: `tests/unit/celestial-layer.test.ts`
  - known observer/time fixtures produce expected visible daylight celestial objects
  - known observer/time fixtures project Moon, Jupiter, and Deneb within the locked tolerance window
- AC-2 bundled catalog determinism: `tests/unit/celestial-layer.test.ts`
  - `stars_200.json` count and stable leading entry
  - constellation catalog validates every referenced star ID against the bundled star catalog
- AC-3 bottom dock behavior: `tests/unit/viewer-shell-celestial.test.ts`
  - centered object populates dock fields
  - empty center-lock shows `Move until an object snaps here.`
  - tapping a non-centered label keeps the dock on the centered object and opens a separate selected-object card
- AC-4 critical astronomy fallback: `tests/unit/viewer-shell-celestial.test.ts`
  - live astronomy failure forces demo-mode routing and shows the hard fallback banner
- AC-5 detail-card field contract: `tests/unit/celestial-layer.test.ts`
  - celestial, star, and constellation metadata expose the required typed fields used by the viewer cards

## Preserved invariants checked

- likely-visible-only daylight rules keep stars and constellations suppressed when the Sun is above the allowed threshold
- constellation overlays only materialize from the bundled catalog and validated star IDs
- center-lock remains angular and independent from tapped-label detail selection

## Edge cases / failure paths

- no center-locked object
- tapped non-centered object while another object remains center-locked
- live astronomy pipeline throw during verified live mode
- likely-visible-only daytime path for stars and constellations

## Flake controls

- astronomy math tests use fixed bundled fixtures and fixed camera poses
- viewer-shell dock tests mock the celestial-scene inputs so sensor startup timing does not control assertions

## Known gaps

- No browser E2E coverage yet for constellation lines or bottom-dock transitions; current protection is unit-level.
- No separate fixture yet for a critical failure during an already-running live camera stream; current failure-path coverage uses the verified non-camera live shell.

## Validation refresh

- Cycle 2 producer rerun confirmed the current celestial test surface stays green with `npm run lint` and `npm run test -- tests/unit/celestial-layer.test.ts tests/unit/viewer-shell-celestial.test.ts`; no additional phase-local regression gap was exposed by the audit.
