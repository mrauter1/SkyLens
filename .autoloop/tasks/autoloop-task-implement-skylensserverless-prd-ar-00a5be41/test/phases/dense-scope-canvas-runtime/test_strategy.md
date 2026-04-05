# Test Strategy

- Task ID: autoloop-task-implement-skylensserverless-prd-ar-00a5be41
- Pair: test
- Phase ID: dense-scope-canvas-runtime
- Phase Directory Key: dense-scope-canvas-runtime
- Phase Title: Dense Scope Canvas Runtime
- Scope: phase-local producer artifact
- Behaviors covered:
  `tests/unit/scope-runtime.test.ts`
  Adaptive depth-band selection for the exact FOV and alignment-health policy.
  Daylight suppression for deep stars.
  Tile selection for RA wraparound, worst-declination RA widening, and the explicit pole-reaching “all RA tiles in-band” path.
  Proper-motion adjustment and EQJ/HOR coordinate round-trip behavior.
  Session caching and stale-generation helper behavior in the scope catalog loader.
  `tests/unit/viewer-shell-scope-runtime.test.tsx`
  Named deep stars surface through scope center-lock while staying canvas-only.
  Stale tile responses are ignored after scope disable.
  `tests/unit/scope-lens-overlay.test.tsx`
  Lens overlay remains pointer-shielded, clipped, non-focusable, and includes the deep-star canvas layer.
- Preserved invariants checked:
  Deep stars do not enter the wide marker/button path.
  Scope overlay remains pointer-inert except for the shield layer.
  Existing scope-filtered viewer tests still pass for previously landed scope controls and bright-object lens behavior.
- Edge cases:
  High-declination wrapped selection.
  Pole-reaching selection where RA coverage must widen to the full band.
  Named deep-star resolution without bright scope-object competition.
- Failure paths:
  Stale tile response after scope disable.
  Loader cache/generation helper misuse regression through direct unit coverage.
- Flake risks / stabilization:
  Viewer integration tests stub `fetch`, astronomy scene inputs, and canvas context for deterministic output.
  Viewer render helpers flush effects multiple times to absorb async scope-load state transitions without broadening global test timeouts.
- Known gaps:
  No end-to-end browser test exercises real static-file fetches against the committed scope dataset.
  Scope-filtered viewer suites are used instead of the broader unfiltered celestial suite because the broader suite has unrelated instability outside this phase’s scope.
