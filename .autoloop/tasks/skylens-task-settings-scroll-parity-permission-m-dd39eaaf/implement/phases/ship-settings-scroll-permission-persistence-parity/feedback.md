# Implement ↔ Code Reviewer Feedback

- Task ID: skylens-task-settings-scroll-parity-permission-m-dd39eaaf
- Pair: implement
- Phase ID: ship-settings-scroll-permission-persistence-parity
- Phase Directory Key: ship-settings-scroll-permission-persistence-parity
- Phase Title: Ship settings scroll parity, permission recovery copy, and full durable persistence
- Scope: phase-local authoritative verifier artifact

- IMP-001 `blocking` [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx): `getPermissionRecoveryAction()` only differentiates `motion-only` versus “everything else”, so the new `Enable camera` CTA still routes through `handleRetryPermissions()` and re-requests motion/location instead of retrying the camera-only path. That violates the accepted plan’s “label and retry behavior” parity for all three missing-permission permutations, and it can regress users who already granted motion/location by needlessly re-prompting unrelated permissions. Minimal fix: extend the shared recovery derivation to return a camera-only action and wire it to a camera-only retry path that preserves existing motion/location state; add a test that clicks the camera-only CTA and asserts only camera recovery runs.

- IMP-002 `non-blocking` Validation was not executable in this workspace because `node_modules` is absent and `pnpm test -- ...` cannot resolve `vitest`. Once dependencies are installed, rerun the touched unit suites to confirm the scroll-owner, permission-flow, and persistence assertions against runtime behavior.

- IMP-003 `non-blocking` Re-review: IMP-001 is resolved. `ViewerShell` now dispatches camera-only recovery through a dedicated `handleRetryCameraPermission()` path, and the updated viewer-shell test exercises the click behavior to confirm motion/location are not retried for the `Enable camera` CTA.
