# Implement ↔ Code Reviewer Feedback

- Task ID: skylensserverless-ux-implementation
- Pair: implement
- Phase ID: guidance-and-banner-resolution
- Phase Directory Key: guidance-and-banner-resolution
- Phase Title: Deterministic next-step and banner resolution
- Scope: phase-local authoritative verifier artifact

- IMP-001 | blocking | `SkyLensServerless/components/viewer/viewer-shell.tsx` (`resolveViewerBannerFeed(...)`, `sharedBannerFeed` call site): the shared camera-fallback banner was narrowed to `state.camera === 'denied'`, but live camera permission/status can also be `'unavailable'` (`probeRearCameraPermission()` returns that when `mediaDevices` is missing). Before this refactor, any live `state.camera !== 'granted'` state surfaced the "Camera access is off." banner on desktop and mobile. After this change, supported live `camera='unavailable'` routes can render without any primary camera banner, which regresses the non-camera fallback contract and can violate AC-2 for that state. Minimal fix: feed the actual camera status into the resolver and restore the camera fallback candidate for non-granted live camera states outside the startup-pending path, then add resolver coverage for the `'unavailable'` case.
- IMP-002 | non-blocking | Re-review result: `IMP-001` is resolved. `resolveViewerBannerFeed(...)` now consumes `cameraStatus`, the `sharedBannerFeed` call site passes the live camera status outside the startup-pending path, and `tests/unit/viewer-shell-resolvers.test.ts` now covers the `'unavailable'` camera case. No further blocking issues found in this phase-local diff.
