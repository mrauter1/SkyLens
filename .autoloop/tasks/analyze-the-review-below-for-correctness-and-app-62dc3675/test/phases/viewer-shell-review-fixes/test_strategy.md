# Test Strategy

- Task ID: analyze-the-review-below-for-correctness-and-app-62dc3675
- Pair: test
- Phase ID: viewer-shell-review-fixes
- Phase Directory Key: viewer-shell-review-fixes
- Phase Title: Apply the applicable viewer-shell review fixes
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- Redundant mobile overlay breakpoint class removal
  - Coverage: existing safe-viewport overlay test asserts the inner expanded wrapper no longer contains `sm:hidden` while keeping safe-area padding expectations intact.
  - Preserved invariant: the outer mobile wrapper remains the breakpoint gate for the overlay tree.
- Live motion retry route synchronization on success
  - Coverage: existing motion recovery test asserts `router.replace(buildViewerHref(...))` is called with `orientation: 'granted'` and the recovery panel disappears after retry.
  - Preserved invariant: local live state and `/view` query params move together on successful retry.
- Live motion retry route synchronization on non-granted resolution
  - Coverage: added denied retry test asserts `router.replace(buildViewerHref(...))` is called with `orientation: 'denied'`, the recovery panel remains visible, and the existing denial guidance is shown.
  - Failure-path check: a resolved retry that stays denied does not silently clear the recovery UI.

## Edge cases

- Retrying from an already denied live orientation state still issues a route replace using the resolved denied state, preventing future regressions that only sync granted outcomes.

## Known gaps

- Exception-path coverage for `requestOrientationPermission()` throwing was not added in this phase because the requested review fix was limited to resolved retry state synchronization, and the existing error copy path was unchanged.

## Flake risk / stabilization

- Tests remain deterministic by mocking `requestOrientationPermission()` and `router.replace()` directly, with no timers, network, or real permission APIs involved.
