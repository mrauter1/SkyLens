# SkyLens Movement Fidelity Plan (Autoloop)

This plan is organized as **plan → implement → test** pairs focused on smooth, faithful motion for moving objects.

## Pair 1: Increase simulation/render cadence

### Plan
- Replace 1Hz scene time updates with animation-driven time progression.
- Keep reduced-motion and battery-conscious fallbacks.
- Ensure demo/live modes continue to work with the new cadence.

### Implement
- Update `components/viewer/viewer-shell.tsx` scene clock from `setInterval(..., 1000)` to a `requestAnimationFrame` loop with a configurable throttle (e.g. 15/30fps).
- Respect `prefersReducedMotion` by falling back to coarse updates.

### Test
- Add unit tests proving scene time advances continuously when animation loop is active.
- Add tests proving reduced-motion fallback keeps low update cadence.

---

## Pair 2: Aircraft interpolation / dead-reckoning between 10s snapshots

### Plan
- Avoid aircraft teleporting by interpolating/extrapolating short-horizon motion between backend snapshots.
- Preserve safety with bounded extrapolation and stale-data handling.

### Implement
- Extend aircraft state handling in `components/viewer/viewer-shell.tsx` (and contracts if needed) to retain previous/current snapshots and timestamps.
- Interpolate by id when both snapshots exist.
- Use velocity/heading-based dead reckoning for short gaps where interpolation is unavailable.
- Fade in/out aircraft entering/leaving snapshot sets.

### Test
- Add unit tests in aircraft and viewer-shell suites validating:
  - smooth intermediate motion across snapshot boundaries,
  - bounded extrapolation behavior,
  - stale data fallback.

---

## Pair 3: Unified motion-state pipeline by object type

### Plan
- Centralize moving-object smoothing logic into a reusable motion-state layer.
- Apply per-type fidelity policy (satellite deterministic propagation, aircraft sampled+predicted).

### Implement
- Add a motion-state module (e.g., `lib/viewer/motion.ts`) with per-object state, confidence decay, and render-pose resolution.
- Integrate into `buildSceneSnapshot` pipeline in `components/viewer/viewer-shell.tsx`.

### Test
- Add tests for per-type policy behavior and confidence decay transitions.
- Verify no regressions in existing label/object ranking behavior.

---

## Pair 4: Visual movement affordances and quality controls

### Plan
- Provide clear movement cues (short trails/vectors) while preserving readability.
- Add quality controls for performance and reduced-motion accessibility.

### Implement
- Add a persisted viewer setting for motion quality (`low|balanced|high`) in `lib/viewer/settings.ts`.
- Generalize trail behavior in `components/viewer/viewer-shell.tsx` for moving objects (aircraft/satellites) with limits per quality mode.
- Add stale/extrapolated-state visual treatment.

### Test
- Add settings tests for persistence/defaults.
- Add viewer tests for quality-mode-dependent trail behavior and reduced-motion handling.

---

## Final verification
- Run `npm run test`.
- Run `npm run lint`.
- Confirm all changed behavior is covered by tests.
- Commit and create PR.
