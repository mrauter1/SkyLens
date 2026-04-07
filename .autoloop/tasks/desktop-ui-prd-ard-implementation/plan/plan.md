# plan.md

## Scope
- Target subtree: `SkyLensServerless/`.
- Primary touchpoints: `SkyLensServerless/components/viewer/viewer-shell.tsx`, `SkyLensServerless/components/settings/settings-sheet.tsx`, `SkyLensServerless/components/ui/compact-mobile-panel-shell.tsx`, and related unit tests under `SkyLensServerless/tests/unit/`.
- Out of scope: root-app mirror outside `SkyLensServerless/`, permission model rewrites, viewer rendering/math changes, and unrelated mobile redesign beyond shared dismiss/focus behavior.

## Current State
- Desktop header currently keeps extra chrome inline: separate `Enable camera` and `Motion` actions, inline scope quick sliders, settings trigger, next-action card, and top warning stack.
- Secondary viewer content already exists inside the desktop viewer panel, but diagnostics/manual observer/privacy and some quick controls still compete with the desktop header instead of staying behind `Open viewer`.
- Warning feed is prioritized correctly by `resolveViewerBannerFeed`, but the desktop rail renders a primary banner plus overflow disclosure rather than one-line rows with per-item expand and dismiss state.
- Escape and backdrop-close behavior already exists for the mobile viewer overlay, mobile alignment overlay, and settings sheet, but the dismiss/focus contract is split across `ViewerShell` and `SettingsSheet`.
- `SettingsSheet` always renders through `CompactMobilePanelShell`, so desktop reuses a mobile-height surface and is the likely source of clipped settings content.

## Implementation Plan

### Phase 1: Desktop Quick Actions And Unified Enable AR
- Keep the desktop quick row limited to `Open Viewer`, `Align`, `Enable AR`, and `Scope` in that order.
- Remove separate desktop camera/motion action buttons from the row and route the single desktop `Enable AR` action through the existing permission recovery flow.
- Preserve current permission recovery semantics by keeping the underlying resolver stateful (`camera-only`, `motion-only`, `camera-and-motion`, `none`) while normalizing the desktop row label and click target to one `Enable AR` intent.
- Keep blocked-state guidance and primary next-action copy available, but do not reintroduce extra quick-row buttons.
- Regression controls:
  - Do not break camera-only or motion-only recovery routing.
  - Do not regress mobile action labels or blocked-state onboarding behavior unless implementation proves a shared change is required.

### Phase 2: Move Secondary Desktop Clutter Into Open Viewer
- Treat the desktop header as a compact summary plus four quick actions only.
- Move secondary content that currently expands beside the quick row into the `Open viewer` desktop panel:
  - scope aperture/magnification quick sliders,
  - diagnostics-heavy viewer snapshot content,
  - privacy reassurance and manual observer content,
  - any advanced/settings-adjacent explanatory copy that is not needed for immediate action selection.
- Keep `SettingsSheet` reachable from desktop chrome, but make the quick-action area visually narrow and action-focused.
- Regression controls:
  - Preserve all currently reachable advanced content; only its location changes.
  - Preserve viewer panel open/close behavior and existing selected/crosshair object details.

### Phase 3: Compact Warning Rail With Expand/Dismiss State
- Replace the desktop warning stack / overflow disclosure pattern with compact per-warning rows that are one line high by default.
- Add a viewer-owned warning UI state model keyed by banner id:
  - `expanded`: row body/actions exposed,
  - `dismissed`: row hidden for the current session,
  - default collapsed unless a critical/actionable state needs immediate emphasis.
- Keep `resolveViewerBannerFeed` responsible for priority/order, then layer UI state on top without changing banner semantics.
- Prefer session-scoped persistence only if implemented cheaply and locally (for example session storage keyed outside viewer settings); do not mutate the persisted viewer settings schema for warning dismissals.
- Accessibility requirements:
  - per-row expand button with `aria-expanded`,
  - per-row dismiss button with an accessible label,
  - actionable controls still keyboard reachable when expanded.
- Regression controls:
  - Critical/actionable warnings must remain visible by default unless explicitly dismissed by the user.
  - Shared banner actions must continue to invoke the existing retry/alignment handlers.

### Phase 4: Consistent Outside-Click, Escape, And Focus Restore
- Standardize dismiss behavior for overlay/dialog/sheet surfaces used by this task:
  - mobile viewer overlay,
  - mobile alignment overlay,
  - the current settings sheet surface and shared opener/fallback focus logic it already uses.
- Use a minimal shared dismiss/focus contract instead of a broad modal framework:
  - capture opener/fallback focus target on open,
  - close on Escape,
  - close on backdrop/outside click only,
  - keep inside-panel interaction from dismissing the surface,
  - restore focus to the opener or best fallback after close.
- Reuse the existing focus-restore helpers already present in `ViewerShell` where practical rather than adding a new cross-app abstraction.
- Regression controls:
  - Opening alignment from one surface must still restore focus to the correct mobile/desktop trigger.
  - Existing mobile overlay scroll lock and focus trap behavior must remain intact.

### Phase 5: Desktop-Optimized Settings Presentation
- Extend `SettingsSheet` with a presentation path that preserves its callback API but renders a desktop dialog variant on desktop-sized layouts.
- Keep the current compact mobile sheet for small screens; add a desktop dialog shell with:
  - centered desktop presentation,
  - internal scroll region,
  - non-clipping max height/width sized for desktop,
  - role/dialog semantics and the same close/focus behavior contract established in Phase 4.
- Keep `ViewerShell` ownership of open-state reporting (`onOpenChange`) and trigger surface ids intact so scroll-lock/focus logic still works.
- Regression controls:
  - No changes to settings value plumbing or persistence behavior.
  - Desktop settings content must remain fully reachable without viewport clipping.

## Interface Notes
- `getPermissionRecoveryAction(state)` should continue exposing routing kind; desktop rendering can map all recoverable states to one `Enable AR` row label.
- `SettingsSheet` should keep its existing settings callbacks and may add a narrow presentation prop or responsive branch internally; avoid a second settings component with duplicated logic.
- Warning UI state should stay in `ViewerShell` (or a small adjacent helper) rather than embedding dismissed/expanded state into banner resolver output.

## Validation
- Update/add unit tests in `SkyLensServerless/tests/unit/viewer-shell.test.ts`, `SkyLensServerless/tests/unit/viewer-shell-resolvers.test.ts`, and `SkyLensServerless/tests/unit/settings-sheet.test.tsx`.
- Cover at minimum:
  - desktop quick-action visibility, order, and `Enable AR` routing,
  - relocated desktop content remaining reachable through `Open viewer`,
  - warning expand/dismiss accessibility and default one-line presentation,
  - backdrop close, Escape close, and focus restoration across viewer/alignment/settings surfaces,
  - desktop settings dialog rendering with internal scroll and no clipped content contract.
- Task completion also requires the final implementation changes and test updates to be committed in git after verification passes.

## Compatibility And Rollback
- No data/schema migration is planned.
- Permission recovery, viewer operation, and stored viewer settings remain backward-compatible.
- Rollback path: revert desktop presentation and warning UI changes without touching viewer state persistence or sensor/camera permission plumbing.

## Risk Register
- Risk: desktop quick-action cleanup accidentally removes camera-only or motion-only recovery paths.
  - Mitigation: keep resolver kinds and handler wiring intact; only collapse the desktop presentation layer.
- Risk: warning dismissal hides a critical issue for too long.
  - Mitigation: keep dismissals session-scoped, default critical/actionable rows visible, and cover with tests.
- Risk: shared dismiss refactor breaks existing mobile focus restoration.
  - Mitigation: reuse current restore-target logic and extend tests around opener/fallback focus.
- Risk: desktop settings dialog duplicates mobile settings markup and drifts.
  - Mitigation: keep one `SettingsSheet` content tree and vary only the shell/presentation layer.
