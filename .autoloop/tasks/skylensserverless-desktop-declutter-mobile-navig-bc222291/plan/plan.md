# SkyLensServerless Desktop Declutter + Mobile Navigation + Direct API Plan

## Scope
- Limit product changes to `SkyLensServerless/`.
- Treat `components/viewer/viewer-shell.tsx` as the primary UI integration surface.
- Preserve existing cache, sensor, permission, and demo behavior unless this task explicitly changes it.

## Relevant code surfaces
- Data path: `SkyLensServerless/lib/satellites/tle.ts`, `SkyLensServerless/lib/satellites/client.ts`, `SkyLensServerless/lib/config.ts`
- Viewer UI: `SkyLensServerless/components/viewer/viewer-shell.tsx`, `SkyLensServerless/components/settings/settings-sheet.tsx`, `SkyLensServerless/components/ui/compact-mobile-panel-shell.tsx`
- Route shell: `SkyLensServerless/app/view/view-page-client.tsx`
- Regression coverage: `SkyLensServerless/tests/unit/satellite-layer.test.ts`, `SkyLensServerless/tests/unit/config-contract.test.ts`, `SkyLensServerless/tests/unit/viewer-shell.test.ts`, `SkyLensServerless/tests/e2e/demo.spec.ts`, `SkyLensServerless/tests/e2e/permissions.spec.ts`, `SkyLensServerless/tests/e2e/landing.spec.ts`

## Milestones
### 1. Remove relay/proxy TLE fetching and keep the direct browser data contract stable
- Replace the default TLE fetch path in `lib/satellites/tle.ts` with direct fetches to the existing CelesTrak group URLs.
- Remove `corsproxy.io` references and the baked-in `corsproxy.io` default, while preserving optional non-`corsproxy.io` relay-template compatibility unless implementation proves it is unused and separately confirmed for removal.
- Keep stale-cache, dedupe, diagnostics, and public TLE failure behavior intact so only the transport path changes.
- Update user-facing privacy copy and tests so they describe direct browser fetches to OpenSky and CelesTrak, not a browser-safe relay.

### 2. Rework desktop viewer chrome around the existing compact mobile action model
- Collapse the always-visible desktop stack into a compact top/header + quick-action layout that mirrors mobile priorities instead of rendering the full desktop column by default.
- Promote four desktop controls in the always-visible chrome: `Open viewer`, `Enable camera`, `Motion`, and `Align`. The camera and motion controls can reuse the existing permission/status helpers, but the plan should treat `Motion` as an explicit desktop control slot rather than only passive status text.
- Move verbose viewer details, privacy copy, and secondary diagnostics behind an explicit openable panel/overlay instead of keeping them permanently visible on desktop.
- Reuse existing viewer state and helper functions where possible rather than introducing parallel desktop-only logic.

### 3. Add desktop hover focus that matches mobile crosshair intent without changing mobile semantics
- Introduce a desktop-only hover focus path for markers/labels so moving the pointer over an object surfaces the same summary/detail information that mobile exposes through center-lock or selection.
- Keep center-lock selection math, tap selection, alignment flow, manual pan, and mobile crosshair behavior unchanged.
- Prefer reusing the existing active/selected object rendering pipeline so hover does not create a second independent detail model.

### 4. Normalize top-positioned warning/navigation behavior and protect mobile flows
- Move motion/alignment/waiting warnings into a compact top banner stack, keeping the desktop stage visually clear while preserving the critical states already surfaced by the current fallback banners.
- Refactor the viewer-shell open/close/navigation state so mobile overlay, alignment panel, alignment focus, and settings sheet transitions share the same state contract instead of drifting between breakpoint-specific branches.
- Preserve mobile quick actions, overlay close behavior, scroll locking, and alignment entry/exit behavior while fixing the current navigation instability.

## Interface and state notes
- `getPermissionRecoveryAction()` remains the source of truth for permission-recovery labels and sequencing; desktop should reuse that logic inside explicit camera and motion control slots instead of inventing a second permission flow.
- The desktop “Open viewer” control should open the compact viewer details surface rather than restoring the current always-expanded desktop column.
- Desktop hover should feed the existing active summary / selected detail resolution, but it must not override explicit selection persistence after a click until hover leaves or selection is cleared.
- The route contract in `ViewerRouteState` should stay unchanged; this task should not expand URL parameters unless implementation proves a navigation fix requires it.

## Compatibility notes
- Direct CelesTrak fetches become the default transport path.
- `NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE` is not slated for removal in this task; if it remains, it should be an optional compatibility override and must not default to or document `corsproxy.io`.
- No migration is required for persisted viewer settings or route params.
- Public copy that currently mentions a “browser-safe relay” must be updated so the supported/default behavior is direct upstream access.

## Regression-risk notes
- High-risk file: `components/viewer/viewer-shell.tsx` because mobile overlay, desktop layout, alignment state, scroll locking, and selection behavior are all coupled there.
- The plan must avoid changing mobile hit targets, overlay reachability on short viewports, alignment start gating, and existing permission-recovery sequencing.
- The TLE transport change must not alter cache freshness windows, stale fallback timing, dedupe order, or failure messaging structure.

## Validation
- Unit:
  - direct TLE default URLs, optional non-`corsproxy.io` relay-template override behavior if retained, and cache fallback behavior
  - privacy/config copy updates
  - desktop quick-action visibility and compact layout composition
  - desktop hover-to-detail behavior
  - compact top warning stack placement/content
  - mobile overlay/alignment/settings navigation regressions
- E2E:
  - landing copy reflects direct CelesTrak fetches
  - mobile overlay still opens/closes and keeps lower content reachable on short viewports
  - mobile permission and alignment flows remain usable
- Manual/visual:
  - desktop default view shows less persistent chrome than today
  - desktop hover over a visible object surfaces its information clearly
  - warning UI is top-positioned and materially shorter than the current banner blocks

## Risk register
- Risk: Desktop simplification duplicates mobile markup and makes future fixes harder.
  - Control: extract shared compact panel/action composition instead of cloning branches.
- Risk: Hover focus fights with click selection or center-lock.
  - Control: define hover precedence explicitly and cover hover-enter/leave plus click persistence in unit tests.
- Risk: Mobile navigation regression from overlay state refactors.
  - Control: preserve existing test IDs where possible and extend unit/e2e coverage before broad UI reshaping.
- Risk: Direct CelesTrak fetches expose CORS or availability differences not covered by the current relay logic.
  - Control: keep the fetch layer local to `tle.ts`, preserve stale-cache fallback, validate direct upstream URLs, and only retain optional relay-template behavior as a compatibility override if still needed.

## Rollback
- If direct CelesTrak fetches fail unexpectedly, revert only the `tle.ts` default transport rewrite while keeping cache/schema logic unchanged and any optional compatibility override behavior isolated.
- If the desktop declutter refactor destabilizes mobile navigation, revert the shared overlay-state reshaping first and keep any isolated hover or compact-banner improvements that remain safe.
