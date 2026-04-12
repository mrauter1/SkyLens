# Autoloop Task: Fix iOS motion retry flow and default free-navigation startup

## Objective
Implement and verify a complete fix for two viewer issues:
1. iOS motion permission gets stuck in "Retrying motion..." and never finishes.
2. Viewer should open with stars visible immediately using a temporary random location until real location is enabled, and should default to free navigation mode.

## Required run mode
- full-auto answers enabled
- pairs: plan,implement,test
- do not set max_iterations
- implement only via autoloop

## Scope
Primary files expected to be touched:
- lib/sensors/orientation.ts
- components/viewer/viewer-shell.tsx
- lib/permissions/coordinator.ts (only if needed for startup interpretation)
- relevant tests covering orientation permissions, startup behavior, and observer fallback

## Correctness requirements

### A) iOS motion permission flow
- Preserve explicit user-gesture requirement: permission requests must originate from explicit user actions.
- Remove/adjust the regressed permission call shape that causes iOS incompatibility.
- Ensure orientation permission retry resolves deterministically to granted/denied/unavailable and no infinite pending UI.
- Keep fallback behavior: manual pan mode remains available when motion is denied/unavailable.

### B) Free navigation default on open
- Live viewer with unknown permissions should not hard-block initial rendering.
- Default startup mode should support free navigation/manual pan immediately.
- Start AR controls remain available for explicit permission flow.

### C) Temporary random observer before location
- If live observer is not yet available and no saved manual observer exists, initialize a temporary random observer so stars render immediately.
- Mark/use this observer as temporary fallback source.
- Seamlessly replace fallback observer when geolocation is granted or user submits manual observer.
- Ensure UX copy/status messaging clearly indicates temporary location until real observer is available.

### D) Regression constraints
- Keep camera/motion/location retry actions functional.
- Do not regress desktop/mobile AR controls visibility and behavior.
- Keep existing manual observer persistence behavior.

## Testing requirements
Autoloop must include plan, implement, and test pairs and run relevant tests to validate:
1. Orientation permission helper behavior for iOS-compatible signature handling.
2. Startup behavior in live mode with unknown permissions defaults to free nav/manual pan-capable view.
3. Fallback random observer presence on initial open and replacement on geolocation/manual observer success.
4. No regression in AR retry flows.

Run targeted tests for changed modules plus broader project test command used in this repository if required by verifier.

## Deliverables
- Code changes implementing all requirements above.
- Updated/added tests proving behavior.
- Passing test output from autoloop test pair.
- Autoloop artifacts captured in repository task workspace.
