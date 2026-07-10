# SkyLens Fix Plan (Autoloop Style)

This plan is organized as **plan → implement → test** pairs.

## Pair 1: Mobile overlay dismissal + clipping resilience

### Plan
- Refactor the mobile overlay container to include a full-screen backdrop.
- Close overlay when backdrop is tapped/clicked.
- Prevent backdrop close when interacting inside the panel.
- Replace `vh`-based max height with `dvh` safe-area-aware sizing so the top section stays reachable on iOS Safari.

### Implement
- Update `components/viewer/viewer-shell.tsx` mobile overlay markup and classes.
- Add click handlers for backdrop close and event stop propagation on the panel.

### Test
- Extend `tests/unit/viewer-shell.test.ts` to verify:
  - Backdrop exists while overlay is open.
  - Clicking backdrop closes overlay.
  - Clicking inside overlay does not close it.

---

## Pair 2: Motion enable guidance / recovery

### Plan
- Add explicit iOS/Safari guidance when motion is denied/unavailable.
- Add a dedicated “Enable motion” button in manual-pan mode to retry orientation permission from a user gesture.

### Implement
- Add a new handler in `components/viewer/viewer-shell.tsx` that requests orientation permission and updates viewer state.
- Update fallback banner/body copy to include actionable steps.

### Test
- Add unit tests for manual-pan state to verify:
  - “Enable motion” button appears.
  - Button invokes orientation permission retry and updates status.

---

## Pair 3: likelyVisibleOnly default + diagnostics clarity

### Plan
- Change default `likelyVisibleOnly` from `true` to `false`.
- Add clearer in-app diagnostics text for common “nothing visible” cases.

### Implement
- Update public config default in `lib/config.ts`.
- Add contextual visibility guidance in `components/viewer/viewer-shell.tsx` when object count is zero.

### Test
- Update tests expecting default `likelyVisibleOnly` behavior.
- Add/adjust viewer shell tests to assert the new guidance text for empty-label states.

---

## Final verification
- Run `npm run test`.
- Run `npm run lint`.
- Commit all changes.
- Create PR title/body with summary + test results.
