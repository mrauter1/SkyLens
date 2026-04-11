# SkyLensServerless AR / Free Navigation Mode Plan

## Scope
- Limit changes to `SkyLensServerless/`.
- Implement explicit viewer interaction modes so free navigation is the default whenever AR is not actively enabled.
- Preserve existing permission ordering, fallback handling, manual observer flow, scope controls, alignment flow, and diagnostics.

## Relevant code surfaces
- Viewer orchestration: `SkyLensServerless/components/viewer/viewer-shell.tsx`
- Permission contract helpers: `SkyLensServerless/lib/permissions/coordinator.ts`
- Viewer-shell unit coverage: `SkyLensServerless/tests/unit/viewer-shell.test.ts`, `SkyLensServerless/tests/unit/viewer-shell-resolvers.test.ts`
- Permission contract coverage: `SkyLensServerless/tests/unit/permission-coordinator.test.ts`
- End-to-end permission UX: `SkyLensServerless/tests/e2e/permissions.spec.ts`

## Milestones
### 1. Separate interaction mode from permission state
- Add explicit viewer interaction mode state in `viewer-shell.tsx`, with `free-navigation` as the default live mode until the user explicitly enables AR.
- Keep `ViewerRouteState` and permission statuses focused on permission facts only; do not use `unknown` permissions as a reason to block manual navigation.
- Rework `manualMode` and related runtime helpers so manual drag/keyboard navigation activates for free-navigation by intent, not only as a denial fallback.

### 2. Rewire AR enable/disable lifecycle around explicit user intent
- Reuse the existing startup/retry logic for `Enable AR`, preserving motion -> camera -> location ordering and current fallback paths.
- Add explicit `Disable AR` handling that stops the active camera stream and orientation subscription, returns the viewer to free-navigation, and does not silently re-enable AR.
- Preserve observer continuity: keep live/manual observer data, manual observer entry, and existing retry actions available after disabling AR.
- Preserve the current meaning of explicit retry actions: `retry-motion`, `retry-camera`, and `retry-location` remain valid user-triggered recovery paths that can continue or recover an AR session without forcing an extra `Enable AR` click.

### 3. Keep AR controls always visible on both layouts
- Keep an AR toggle control visible in mobile quick actions and desktop action chrome regardless of current permission state.
- When in free-navigation mode, render `Enable AR`; when in AR mode, render `Disable AR`.
- Keep scope and alignment entry points functional after mode switches, with free-navigation remaining interactive while AR is off.

### 4. Update regression coverage around no-prompt-before-click and mode switching
- Update permission coordinator tests to keep the ordering contract and clarify that permission state remains separate from the new interaction-mode state.
- Extend viewer-shell unit coverage for:
  - initial `/view` free-navigation without startup side effects
  - always-visible mobile/desktop AR toggle controls
  - disable-to-free-navigation behavior with drag and keyboard navigation still active
  - sticky disable behavior so later effects do not auto-promote back into AR
- Extend e2e coverage for no prompt before click, visible toggle controls, and post-disable navigation behavior on mobile and desktop.

## Interface and state notes
- Treat interaction mode as viewer-shell-owned state, not a new URL or persisted route contract, unless implementation discovers a concrete regression that cannot be solved locally.
- `ViewerRouteState` and `runStartFlow()` should continue to describe permission results and request ordering only.
- `describeRuntimeExperience()` / `startupState` should stop treating unknown permissions as a fully blocked viewer surface; they should support free-navigation as a valid non-AR runtime.
- `Disable AR` must tear down AR-only resources locally:
  - stop the current media stream
  - stop the active orientation subscription
  - clear any waiting-for-orientation startup timers
  - leave observer/manual observer state intact
- Passive effects must not re-enable AR after an explicit `Disable AR`.
- Existing recovery actions (`retry-motion`, `retry-camera`, `retry-location`) stay available as explicit user-triggered recovery paths. When the user presses one of those controls, it may continue or recover AR using the current fallback logic; what must be prevented is silent/effect-driven promotion back into AR after a disable.

## Compatibility notes
- No route-param migration is planned.
- No persisted settings migration is planned.
- Demo mode stays available and continues to use manual navigation semantics.
- Permission coordinator ordering remains motion -> camera -> location.

## Regression-risk notes
- `viewer-shell.tsx` is the primary risk surface because startup gating, sensor subscriptions, camera lifecycle, mobile/desktop controls, scope access, and alignment state all converge there.
- The highest-risk regression is accidental permission prompting on initial `/view` load through existing effects that assume verified live startup once route state is present.
- A second high-risk regression is leaking AR resources after `Disable AR`, which could keep camera/orientation active or allow later effects to re-enter AR without user intent.
- Scope-mode availability must remain independent from AR enablement once free-navigation becomes the baseline interactive state.

## Validation
- Unit:
  - permission coordinator ordering and route parsing remain stable
  - viewer-shell initial live render does not request motion/camera/location before `Enable AR`
  - always-visible mobile and desktop AR controls render in free-navigation and AR states
  - disabling AR restores drag + keyboard navigation and preserves manual observer/alignment/scope entry points
  - disabling AR is sticky across subsequent effects and retries until the user explicitly enables AR again
  - explicit retry-motion / retry-camera / retry-location actions still recover or continue AR when the user invokes them
- E2E:
  - bare `/view` does not prompt before `Enable AR` is clicked
  - mobile and desktop both expose an AR toggle surface at all times
  - disabling AR returns to free-navigation and keeps navigation working
  - scope mode and manual observer remain reachable after mode changes
  - explicit retry actions still recover the live AR path after user interaction, without requiring a redundant extra enable step
- Manual spot-check:
  - enable AR starts prompts only from the explicit button
  - disable AR removes the camera feed / live sensor behavior without wiping observer context

## Risk register
- Risk: existing startup effects infer “live session started” from route state and could still trigger observer/camera/orientation work on initial load.
  - Control: gate AR-only effects from explicit interaction mode, not only route permissions or startup state.
- Risk: disable logic stops the camera stream but leaves orientation listeners or timeout state running.
  - Control: centralize AR teardown in a single viewer-shell path reused by `Disable AR` and cleanup-sensitive transitions.
- Risk: sticky-disable guarding is implemented too broadly and breaks explicit retry-camera / retry-motion / retry-location recovery flows.
  - Control: define the invariant narrowly: passive effects cannot auto-promote back into AR after disable, but explicit user-triggered retry actions still follow the existing recovery semantics.
- Risk: scope/alignment controls regress because they currently key off blocked/manual/live runtime modes.
  - Control: define free-navigation as an interactive runtime with explicit expectations for scope/alignment availability and cover both layouts in tests.
- Risk: permission coordinator tests drift into modeling UI interaction mode in the route contract.
  - Control: keep the coordinator contract permission-only and validate interaction mode separately in viewer-shell coverage.

## Rollback
- Revert the interaction-mode wiring in `viewer-shell.tsx` while preserving unrelated tests if free-navigation destabilizes startup, alignment, or scope behavior.
- Revert explicit disable teardown separately if it causes resource lifecycle regressions, keeping the no-prompt-before-click guard and visible toggle coverage intact where safe.
