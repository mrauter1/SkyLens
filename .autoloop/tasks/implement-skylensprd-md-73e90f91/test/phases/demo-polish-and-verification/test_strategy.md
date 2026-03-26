# Test Strategy

- Task ID: implement-skylensprd-md-73e90f91
- Pair: test
- Phase ID: demo-polish-and-verification
- Phase Directory Key: demo-polish-and-verification
- Phase Title: Demo mode, polish, and verification
- Scope: phase-local producer artifact

## Coverage Map

- Demo scenarios and offline bundles:
  `tests/unit/demo-scenarios.test.ts` locks the three bundled scenario IDs, default fallback, and the Tokyo ISS fixture contract.
  `tests/e2e/demo.spec.ts` exercises desktop demo-mode rendering, deterministic label/detail-card behavior, and persisted layer toggles.

- Accessibility and manual-mode controls:
  `tests/unit/settings-sheet.test.tsx` covers focus trapping, Escape-to-close, and focus return to the Settings trigger.
  `tests/unit/viewer-shell.test.ts` covers keyboard panning and deterministic double-tap recenter behavior in manual mode.
  `tests/unit/viewer-shell-celestial.test.ts` covers the manual-stage label-tap guard so selected-object cards still open during manual fallback.

- Reduced-motion and visual polish:
  `tests/unit/viewer-shell-celestial.test.ts` covers the reduced-motion branch by asserting label transition styles are removed when `prefers-reduced-motion` is active and preserved otherwise.
  The same suite now captures the viewer's scene-time interval and asserts that a trail-eligible ISS renders a `polyline` trail in the default branch while reduced motion suppresses that trail.

- Health status surfacing:
  `tests/unit/health-route.test.ts` covers `/api/health` empty, fresh, and stale cache payloads.
  `tests/unit/viewer-settings.test.tsx` covers the real viewer-to-settings integration for stale and expired satellite-cache labels fetched from `/api/health`.

## Preserved Invariants Checked

- Demo mode stays desktop-usable without live sensors or live network dependencies.
- Manual-mode taps on labels do not regress into stage drags.
- Single taps do not recenter; only a second tap inside the double-tap window does.
- Settings persistence still survives remounts alongside the new health and accessibility coverage.

## Edge Cases / Failure Paths

- Unknown demo scenario IDs fall back to the default bundle.
- Reduced-motion preference removes animated label transitions.
- Trail polylines appear only for trail-eligible objects as scene time advances and stay suppressed under reduced motion.
- Satellite cache status mapping is checked for both `stale` and `expired`.
- Blocked and degraded viewer shells remain covered by the existing unit and Playwright suites.

## Validation

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

## Known Gaps

- No additional gap noted for this phase after the current pass.
