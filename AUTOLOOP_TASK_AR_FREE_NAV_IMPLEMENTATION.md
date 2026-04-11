# SkyLensServerless Autoloop Task: AR / Free Navigation Mode Implementation

## Goal
Implement explicit two-mode behavior in `SkyLensServerless` viewer:
1. **Free navigation mode** (default when AR is disabled)
   - Mobile: touch press+drag to navigate sky.
   - Desktop: mouse drag and keyboard arrows/Home/R to navigate/recenter.
2. **AR mode**
   - Uses camera + motion (+ location pipeline already present).

## Must-have UX requirements
- **Enable AR / Disable AR button must always be visible** on both mobile and desktop surfaces.
- **Camera and motion permission prompts must only happen when the user presses Enable AR**.
- When AR is disabled, free navigation is the default mode and remains fully interactive.

## Constraints
- Implement in `SkyLensServerless` app only.
- Preserve existing permission ordering (motion -> camera -> location) and existing fallback paths.
- Do not regress manual observer flow, scope controls, alignment flow, or diagnostics.
- Do not introduce automatic AR re-enable after explicit Disable AR.

## Primary implementation targets
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/e2e/permissions.spec.ts`
- `SkyLensServerless/tests/unit/permission-coordinator.test.ts`
- Additional test files as needed for robust regression coverage.

## Implementation guidance
- Add explicit interaction mode state (e.g. `'free-navigation' | 'ar'`) separated from permission status fields.
- Keep manual navigation handlers active whenever in free-navigation mode.
- Add always-visible AR toggle controls in mobile quick actions and desktop action rail/header.
- Enable AR action should reuse existing retry/start logic and only prompt on click.
- Disable AR action should shut down camera stream/orientation subscription and keep observer data continuity.
- Ensure user intent for disable is sticky (no silent auto-promotion back to AR).

## Regression checklist
- `/view` initial load does not prompt camera/motion until Enable AR is pressed.
- Mobile and desktop always render AR toggle.
- Disable AR returns to free-navigation and keeps touch/mouse/keyboard nav working.
- Scope mode still toggles and renders correctly after mode changes.
- Manual observer and alignment access remain functional.

## Validation expectations
Run relevant test suites and targeted checks covering:
- permission coordinator behavior,
- mobile/desktop permission and mode UX,
- no-prompt-before-click behavior,
- mode toggling behavior.

