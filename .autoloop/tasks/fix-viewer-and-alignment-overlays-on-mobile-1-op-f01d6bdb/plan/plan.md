# Mobile Viewer Overlay And Alignment Plan

## Scope
- Fix the opened mobile viewer overlay layout so its top content is reachable and the sheet can scroll back to the top within safe-area bounds.
- Hide mobile overlay chrome during active alignment so the reticle stays unobstructed and the user only sees the center target plus alignment actions.
- Add first-use mobile action buttons for missing camera/motion access and initial alignment, while keeping an align action visible.

## Implementation Contract
- Keep the change centered in `components/viewer/viewer-shell.tsx`; avoid route, permission-coordinator, or storage-schema changes unless a minimal plumbing change is proven necessary.
- Preserve the current desktop composition, `SettingsSheet` behavior, backdrop close behavior, and existing permission/calibration logic paths.
- Reuse existing handlers (`handleRetryPermissions`, `handleRetryMotionPermission`, `alignCalibrationTarget`, `fixAlignment`) instead of introducing parallel startup or calibration flows.
- Keep the mobile align CTA visible for first-time live calibration states, but allow it to remain disabled until a live orientation sample exists and alignment can execute safely.

## Milestone
- Ship one coherent mobile slice covering overlay scrolling, alignment-focus presentation, and first-use action visibility together.

## Planned Changes
### 1. Mobile overlay scroll and viewport containment
- Replace the current mobile overlay wrapper/panel arrangement with a safe-area-aware scroll owner so the opened panel can reach its own top content again after scrolling.
- Preserve `Open viewer`, backdrop dismissal, inner click isolation, and the existing expanded overlay content order.
- Keep the fix mobile-only; the desktop header/content layout stays unchanged.

### 2. Mobile alignment-focus mode
- Add a dedicated mobile alignment-focus state in `ViewerShell` that is entered by explicit alignment flows, including the mobile first-time align action and existing alignment entry points.
- While that state is active, suppress the expanded mobile overlay content and nonessential cards so the reticle remains visible; keep the align action and an exit path available.
- Do not treat every transient noisy-sensor warning as alignment focus. The overlay-hiding mode should map to explicit alignment intent, not passive guidance banners.

### 3. First-use mobile action row
- Replace the closed mobile footer’s single-action contract with a state-aware action row.
- Show a permission CTA only when live mobile viewing is missing camera and/or motion permission.
- Show a first-time align CTA when live viewing still needs initial calibration; keep an align action visible instead of burying it inside the opened overlay/settings sheet, even if it is temporarily disabled until sensor data arrives.
- Keep access to the full overlay available when the user still needs status, object details, privacy copy, or settings.

## Interface And State Notes
- `ViewerShell` remains the owner of mobile overlay state, permission CTA visibility, and calibration/alignment state derivation.
- No API, route, or persisted settings shape changes are planned.
- If `SettingsSheet` needs to signal alignment entry more explicitly, prefer a minimal prop-level wiring change over new shared abstractions.
- Alignment CTA visibility must be derived from existing live/calibration state and must not leak into desktop-only or demo-only UI unexpectedly.
- Alignment CTA enabled/disabled state must continue to derive from existing calibration prerequisites (`manualMode`, latest orientation sample availability) rather than inventing a mobile-only calibration path.

## Regression Controls
- Preserve ordered live startup behavior: motion request first, camera second, location/manual observer third.
- Preserve desktop-only header/content composition and current settings-sheet tests.
- Preserve mobile overlay open/close semantics, backdrop handling, and safe-area padding.
- Avoid hiding manual-pan or demo-mode chrome unless the mobile alignment-focus contract explicitly requires it.

## Validation
- Extend `tests/unit/viewer-shell.test.ts` to cover the updated mobile overlay scroll container contract.
- Add/adjust viewer-shell tests for first-time live mobile state showing permission and align actions together, including the visible-but-disabled align state before a live sample exists.
- Add/adjust viewer-shell tests that assert mobile alignment focus hides overlay chrome while keeping alignment controls reachable.
- Confirm the permission CTA disappears once both camera and motion are already granted, while the align flow still follows existing calibration capability rules.

## Compatibility And Rollback
- Compatibility: no public interface, storage, route, or API contract changes are expected.
- Rollback: revert the mobile-only `ViewerShell` overlay/footer state changes if they regress overlay scrolling, permission startup reachability, or desktop composition.

## Risk Register
- Risk: overlay layout changes could break backdrop hit testing or close behavior.
  Mitigation: preserve the current backdrop/button structure and cover it with updated mobile overlay tests.
- Risk: explicit alignment focus could accidentally hide necessary chrome in passive warning states.
  Mitigation: use a dedicated mobile alignment-focus flag rather than reusing transient warning booleans.
- Risk: a new permission CTA could fork the startup sequence and desynchronize route state.
  Mitigation: route the CTA through the existing startup/retry handlers only.
- Risk: first-time alignment controls could appear in demo or unsupported contexts.
  Mitigation: gate mobile quick actions on live-entry permission/calibration state and existing capability flags.
