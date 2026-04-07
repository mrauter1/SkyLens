# Task: Implement Main-Viewer Optics Unification (SkyLensServerless)

Implement the PRD/ARD in `SkyLensServerless/PRD_ARD_MAIN_VIEW_OPTICS_UNIFICATION.md`.

## Scope
- Implement on `SkyLensServerless` codepaths.
- Keep scope lens overlay optional presentation.
- Main-view optics always active.
- Main-view and scope-mode optics are independently wired.

## Required behavior
1. Main-view optics
   - Always active in normal/main view.
   - Sliders visible by default.
   - Magnification default = `1.0x`.
   - Magnification minimum = `0.25x`.
   - Magnification affects FOV/projection only.
   - Aperture controls deep-star emergence only.
   - Main-view aperture/magnification are **not persisted**; always reset to defaults on load.

2. Scope-mode optics
   - Scope lens remains optional presentation mode.
   - Scope-mode aperture/magnification values are persisted.
   - Scope-mode optics values are independent from main-view optics values.
   - Controls look the same between modes; callback wiring depends on active mode.

3. Object/label/center-lock behavior
   - Deep stars participate with other objects in center-lock and labels.
   - Winner rule: closest to center wins.
   - Tie-breaker for perfect overlap: brightest wins.
   - Final deterministic fallback: stable object-id ordering.

4. Dataset scope
   - Deep-star scope for this feature stays HYG-only.

5. DRY requirement
   - Do not duplicate optics math/projection/filter/ranking logic.
   - Reuse shared paths and abstractions.

## Implementation guidance
- Primary touchpoints:
  - `SkyLensServerless/components/viewer/viewer-shell.tsx`
  - `SkyLensServerless/lib/viewer/scope-optics.ts`
  - `SkyLensServerless/lib/viewer/settings.ts`
  - `SkyLensServerless/components/settings/settings-sheet.tsx`
  - Relevant deep-star paths under `SkyLensServerless/lib/scope/*`
- Keep architecture conservative and avoid unnecessary churn.
- Preserve existing request cancellation/invalidation behavior.

## Testing requirements
Add/update unit, integration, and e2e tests to cover:
- 0.25x minimum and 1.0x default magnification for main view.
- Magnification = FOV-only effect.
- Aperture-driven emergence behavior.
- Main-view non-persistence vs scope-mode persistence.
- Center-lock deterministic ranking (distance -> brightness -> id).
- Mode switching behavior and control wiring.

Run relevant tests and report outcomes.

## Constraints
- Follow DRY principles.
- Prefer minimal, high-leverage changes.
- Keep existing UX labels the same.
