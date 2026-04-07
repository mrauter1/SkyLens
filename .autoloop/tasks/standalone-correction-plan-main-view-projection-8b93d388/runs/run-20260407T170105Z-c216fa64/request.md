# Standalone Correction Plan: Main-View Projection Alignment + Overlay Consistency

## Background
A prior optics-unification change introduced main-view profile-based projection for magnification and a shared deep-star pipeline. Automated review identified three correctness regressions in `SkyLensServerless/components/viewer/viewer-shell.tsx`:

1. Main-view profile projection path omits camera frame source dimensions (`sourceWidth`/`sourceHeight`) when calling `projectWorldPointToScreenWithProfile`.
2. Main-view deep-star profile projection also omits camera frame source dimensions.
3. Overlay elements (constellation line segments and focused aircraft trails) remain projected with base vertical FOV logic instead of active profile/FOV when main-view magnification differs from 1x.

This causes marker-to-video misalignment and overlay divergence when viewport aspect ratio differs from camera source and/or when magnification is active.

## Goal
Correct projection alignment and overlay consistency for magnified main view while preserving:
- scope behavior,
- DRY projection logic,
- existing center-lock and persistence semantics.

## In-Scope Corrections

### C1 — Main object profile projection uses camera frame mapping
- In the `useStageProfileProjection` branch for `projectedObjects`, pass camera source dimensions alongside viewport dimensions to `projectWorldPointToScreenWithProfile`:
  - `sourceWidth: cameraFrameLayout?.sourceWidth`
  - `sourceHeight: cameraFrameLayout?.sourceHeight`

### C2 — Main deep-star profile projection uses camera frame mapping
- In non-scope deep-star projection, include camera source dimensions in the profile projection viewport object.
- Ensure deep-star spatial alignment matches bright objects and center-lock candidates in live mode.

### C3 — Overlay projection follows active main-view profile
- For non-scope mode when profile magnification is active:
  - apply the same active projection profile/FOV path to constellation line segment projection,
  - apply the same active projection profile/FOV path to focused aircraft trail projection.
- Keep scope-mode behavior unchanged.

## Must-Not-Break Invariants
1. Scope lens overlay projection and clipping remain unchanged in scope mode.
2. Main-view magnification remains FOV/projection-only.
3. Aperture-driven emergence logic remains unchanged.
4. Deterministic center-lock ordering remains unchanged.

## Implementation Guidance
- Primary file: `SkyLensServerless/components/viewer/viewer-shell.tsx`
- Projection utility API: `SkyLensServerless/lib/projection/camera.ts`
- Reuse existing profile selection variables (`useStageProfileProjection`, `stageProjectionProfile`, `activeProjectionProfile`) rather than adding parallel logic.
- Prefer small helper(s) to avoid duplicating projection call shape across objects/deep-stars/overlays.

## Test Plan

### Unit / Integration
1. Add/extend tests proving profile projection path preserves camera-frame crop mapping for main objects and deep stars.
2. Add/extend tests proving constellation lines and focused aircraft trails remain co-located with marker projections when main magnification != 1x.
3. Verify no regressions in scope runtime tests.

### E2E
1. Add/extend demo/e2e coverage for magnified main view alignment behavior (or update existing demo test with assertions tied to overlay consistency).
2. If environment blocks browser dependencies, document limitation clearly while keeping unit/integration coverage strong.

## Acceptance Criteria
1. In live mode with camera source AR != viewport AR and main magnification active, marker positions remain aligned to video feed.
2. Deep stars and non-deep markers align spatially under same camera pose.
3. Constellation lines and focused aircraft trails align with projected markers under main magnification.
4. Scope mode behavior remains unchanged.
5. Updated tests pass for touched logic.

## Autoloop Execution Requirements
- Use autoloop with full-auto answers enabled.
- Use `plan,implement,test` pairs.
- Do not set `max_iterations`.
- Let server-side processing run to completion even if logs appear paused.
