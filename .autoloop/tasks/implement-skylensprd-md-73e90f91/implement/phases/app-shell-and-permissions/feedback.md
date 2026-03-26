# Implement ↔ Code Reviewer Feedback

- Task ID: implement-skylensprd-md-73e90f91
- Pair: implement
- Phase ID: app-shell-and-permissions
- Phase Directory Key: app-shell-and-permissions
- Phase Title: App shell and permissions
- Scope: phase-local authoritative verifier artifact

- IMP-001 | blocking | [lib/permissions/coordinator.ts](/workspace/SkyLens/lib/permissions/coordinator.ts):74-91, [app/view/page.tsx](/workspace/SkyLens/app/view/page.tsx):8-24, [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx):27-31,163-177
  Bare `/view` requests are treated as if `location`, `camera`, and `orientation` are already granted because `parseViewerRouteState()` defaults missing params to `granted`. That lets users bypass the gated Start flow entirely and renders the "Live viewer" / "Permissions are in place" state even when no permission action has run. This conflicts with the phase objective to enter the viewer safely through the permission/fallback flow and will become a real regression once camera/sensor startup is added in M2. Minimal fix: introduce an explicit preflight/unknown viewer state or persist the actual Start-flow result, and make query-less `/view` block or reroute until a verified permission outcome exists.

- IMP-002 | blocking | [lib/permissions/coordinator.ts](/workspace/SkyLens/lib/permissions/coordinator.ts):214-238
  `requestOrientationPermission()` returns `granted` whenever `DeviceOrientationEvent` exists and no `requestPermission()` API is present. On unsupported or desktop browsers that expose the constructor but do not emit usable `deviceorientationabsolute` / `deviceorientation` events, the shell incorrectly enters live or non-camera mode instead of the required manual-pan fallback. Minimal fix: centralize real orientation capability detection in the coordinator by checking actual event support (`deviceorientationabsolute` / `deviceorientation`) or a first-event probe, and map lack of both to `unavailable` so the viewer enters manual-pan mode.

- IMP-003 | blocking | [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx):113-185, [lib/permissions/coordinator.ts](/workspace/SkyLens/lib/permissions/coordinator.ts):103-108
  The coordinator now classifies any live state with `unknown` permissions as blocked, but `ViewerShell` still renders its blocking UI only when `location !== 'granted'`. A request such as `/view?entry=live&location=granted` therefore skips the preflight block even though the shared experience model says the state is invalid, and the shell renders fallback/live content instead of requiring a verified full permission payload. Minimal fix: centralize the block-vs-viewer branch on the shared experience mode (or a helper derived from the same coordinator logic) and add coverage for partial live-state URLs, not just bare `/view`.

- Cycle 3 re-review: no remaining findings. IMP-001, IMP-002, and IMP-003 were resolved by the explicit preflight state, the orientation-support gate, the centralized blocked-branch rendering, and the added partial-live-state coverage.

- Cycle 1 verifier review for run `run-20260326T020604Z-abe9114e`: no new findings. The producer turn was validation-only, the app-shell-and-permissions implementation still satisfies AC-1 through AC-4, and the reviewer-owned criteria remain fully checked.
