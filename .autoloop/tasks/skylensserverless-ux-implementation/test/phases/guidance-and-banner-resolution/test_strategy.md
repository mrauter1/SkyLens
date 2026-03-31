# Test Strategy

- Task ID: skylensserverless-ux-implementation
- Pair: test
- Phase ID: guidance-and-banner-resolution
- Phase Directory Key: guidance-and-banner-resolution
- Phase Title: Deterministic next-step and banner resolution
- Scope: phase-local producer artifact
- Behaviors covered:
  AC-1 / alignment contract:
  `tests/unit/alignment-tutorial.test.ts`
  align-now primary step with CTA
  waiting-for-motion primary step with disabled CTA contract
  manual-mode return-to-live-sensors state
  alignment-unavailable state
  preferred-target fallback supporting notice
  preserved mobile render hook:
  `tests/unit/viewer-shell.test.ts`
  blocked first-sample path still renders `alignment-start-action` and the new primary-step copy
- AC-2 / shared banner prioritization:
  `tests/unit/viewer-shell-resolvers.test.ts`
  actionable banner outranks informational overflow deterministically
  overflow ordering is stable
  alignment actions drop out cleanly when the surface is informational only
  live `cameraStatus: 'unavailable'` preserves the camera fallback banner
  startup-pending `cameraStatus: null` does not synthesize a camera banner
  preserved desktop chrome contract:
  `tests/unit/viewer-shell.test.ts`
  desktop top-warning stack remains compact by default after the resolver swap
- AC-3 / targeted resolver coverage:
  pure unit tests cover both `buildAlignmentTutorialModel(...)` and `resolveViewerBannerFeed(...)` directly instead of relying only on full render assertions
- Preserved invariants checked:
  `alignment-start-action` remains the stable CTA hook in waiting states
  primary/overflow selection stays deterministic across multiple concurrent banner candidates
  non-camera live fallback still surfaces a camera banner when camera support is unavailable
- Edge cases:
  preferred alignment target unavailable
  startup pending with no camera banner
  unavailable camera support versus denied camera support
  manual alignment state with no CTA
- Failure paths:
  waiting for motion sample
  alignment unavailable in the current mode
  camera unavailable fallback
- Flake controls:
  pure resolver tests avoid timers and browser-runtime dependencies
  render-level assertions reuse existing stable viewer-shell fixtures and test ids
- Known gaps:
  Playwright mobile overlay coverage for this phase remains blocked by the repo web-server startup timeout, so resolver behavior is validated in unit tests rather than a successful browser run this turn.
