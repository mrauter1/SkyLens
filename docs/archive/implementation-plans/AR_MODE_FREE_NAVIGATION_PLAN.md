# SkyLensServerless: AR vs Free Navigation Mode Plan

## Goal
Introduce two explicit interaction modes in the viewer:
1. **Free navigation mode** (default when AR is disabled)
   - Mobile: touch press+drag pans the sky.
   - Desktop: mouse drag and keyboard arrows/Home/R continue to pan/recenter.
2. **AR mode**
   - Uses live camera + motion + location pipeline.

The **AR toggle must always be visible** (Enable AR / Disable AR), and **camera/motion prompts must only happen after pressing Enable AR**.

---

## Current-state verification (what the code already does)

### 1) Free navigation input exists and is active in manual mode
- `handleStagePointerDown/Move/Up` and `handleStageKeyDown` are already wired on the stage.
- Those handlers are gated by `manualMode`, and apply `applyManualPoseDrag` + recenter (`Home`, `R`, double-tap recenter).

### 2) Free navigation currently maps to fallback/manual experience
- `manualMode` is true when runtime experience is `demo` or `manual-pan`.
- `describeRuntimeExperience` returns `manual-pan` when orientation is not granted.

### 3) Permission prompts are user-driven from AR actions
- The startup path calls permission APIs from explicit action handlers (`handleRetryPermissions`, retry motion/camera handlers).
- `/view` with unknown statuses initializes to `ready-to-request` and stays blocked until user action.
- No automatic permission request occurs on landing or initial `/view` render.
- Live camera and orientation subscriptions are only activated after live session conditions are met (no eager subscription at initial blocked state).

### 4) AR action visibility today
- Desktop has an always-present action rail button labeled `Enable AR` (`desktop-enable-ar-action`) with state text.
- Mobile quick actions show the permission action only when `showMobilePermissionAction` is true (i.e., hidden once both camera+motion are granted).

### 5) Tests already cover startup/permission gating foundations
- Unit tests verify blocked `/view` state and ordered permission request flow.
- E2E tests verify blocked startup UX and manual-pan fallback state.

---

## Gaps against requested behavior

1. **Mode semantics are implicit** (`manual-pan` fallback) rather than explicit user-facing mode selection.
2. **Mobile AR toggle is not always visible** after AR is fully enabled; it disappears when no recovery action is needed.
3. **No explicit Disable AR action** that intentionally returns user to free navigation mode while preserving in-session state.
4. **Desktop currently has always-visible AR button**, but behavior is oriented to recovery/startup, not symmetric enable/disable mode switching.

## Correctness review notes (to avoid logic mistakes)

1. **Do not overload permission state as mode state.**
   - `state.camera/state.orientation` are capability/permission facts.
   - `interactionMode` should represent user intent (AR enabled vs free navigation), even when permissions are partially denied.
2. **Preserve current startup ordering and messaging.**
   - Keep motion → camera → location request order and existing fallback messaging.
3. **Avoid forced AR auto-resume.**
   - If the user explicitly presses Disable AR, do not silently switch back to AR because permissions are still granted.
4. **Do not regress stage interactions while overlays are closed.**
   - Free navigation must continue to honor pointer + keyboard controls with existing focus behavior.
5. **Do not regress privacy posture.**
   - Disable AR should stop camera stream and orientation listeners immediately.

---

## Proposed implementation plan

### Phase 1 — Introduce explicit interaction mode state
- Add a viewer-level mode state, e.g.:
  - `interactionMode: 'free-navigation' | 'ar'`.
- Derive initial value:
  - `ar` only when `state.entry === 'live'` and both camera+orientation are granted and session is not blocked.
  - otherwise `free-navigation`.
- Keep existing `startupState` and permission status plumbing, but make `manualMode` depend on `interactionMode === 'free-navigation'`.

### Phase 2 — Make AR toggle always visible on both mobile and desktop
- Replace conditional permission action rendering with a persistent AR mode toggle control:
  - If `interactionMode === 'free-navigation'`: label `Enable AR`.
  - If `interactionMode === 'ar'`: label `Disable AR`.
- Keep this visible regardless of overlay state (mobile quick-actions and desktop action rail).

### Phase 3 — Enable AR behavior (permission request only on click)
- On `Enable AR` click:
  - Run existing permission-start flow (`handleRetryPermissions`), preserving today’s permission order and fallback logic.
  - Only after successful conditions (motion granted + camera granted) flip `interactionMode` to `ar`.
  - If denied/partial, remain in `free-navigation` and show existing guidance banners.

### Phase 4 — Disable AR behavior (explicit manual return)
- On `Disable AR` click:
  - Force `interactionMode` to `free-navigation`.
  - Stop camera stream (`stopMediaStream`) and orientation subscription for battery/privacy.
  - Keep location/manual observer data for continuity.
  - Preserve stage panning controls and allow re-enable AR later.
  - Mark this as a user-intent transition so downstream effects do not auto-promote back to AR.

### Phase 5 — UX copy and telemetry alignment
- Update status text/copy to present two clear modes:
  - “Free navigation” vs “AR”.
- Keep diagnostics and warnings, but avoid calling free-navigation a “fallback” when user intentionally disabled AR.

### Phase 6 — Tests
- Unit tests:
  - mode reducer/derivation for enable/disable transitions.
  - AR toggle label state and visibility rules.
  - Disable AR should not auto-revert to AR without explicit user action.
  - Enabling AR should not run before user click from bare `/view`.
- E2E tests:
  - `/view` opens in free navigation by default.
  - mobile and desktop always show AR toggle.
  - permission prompt only appears after clicking Enable AR.
  - Disable AR returns to drag/keyboard/touch navigation and detaches live camera.
  - Manual observer + scope mode remain usable after AR disable.

---

## Concrete files to modify in implementation phase

- `SkyLensServerless/components/viewer/viewer-shell.tsx`
  - Add explicit mode state and toggle handlers.
  - Keep pointer/touch/keyboard manual controls active in free-navigation mode.
- `SkyLensServerless/tests/e2e/permissions.spec.ts`
  - Add mode-toggle and “always visible AR button” assertions.
- `SkyLensServerless/tests/unit/permission-coordinator.test.ts`
  - Extend cases for explicit mode behavior and no pre-click permission request.
- (Optional) `SkyLensServerless/components/settings/settings-sheet.tsx`
  - If we surface mode copy in settings panel.

---

## Acceptance criteria (verifiable)

1. Opening `/view` does **not** trigger camera/motion prompts automatically.
2. Viewer starts in **Free navigation** unless AR has been explicitly enabled and permissions are granted.
3. **Enable AR / Disable AR control is always visible** on mobile and desktop.
4. Touch drag (mobile), mouse drag + keyboard arrows/Home/R (desktop) work in free-navigation mode.
5. Disabling AR cleanly turns off camera/motion processing and returns to free navigation.
6. Existing fallback safety paths (denied motion/camera/location) remain intact.
7. Explicit Disable AR does not auto-flip back to AR without a new Enable AR action.
8. Scope controls, alignment entry points, and manual observer flow remain functional after mode toggles.

---

## Risk notes and mitigations

- **Risk:** conflating “fallback” and “intentional free-navigation” can regress copy logic.
  - **Mitigation:** separate mode labeling from permission health messaging.
- **Risk:** toggling modes can leave stale camera/orientation side effects.
  - **Mitigation:** centralize enable/disable lifecycle cleanup in one handler.
- **Risk:** mobile quick-action layout crowding with always-visible AR button.
  - **Mitigation:** keep compact button text + ensure overflow/line-wrap behavior tested on short viewports.
