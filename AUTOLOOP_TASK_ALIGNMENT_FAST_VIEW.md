# SkyLens alignment UX/mobile camera hardening task

## Goal
Address the alignment UX and camera viewport behavior issues in the live viewer.

## Required outcomes
1. **No camera-view scrolling while using AR viewer**
   - Prevent page/body and camera stage scrolling during live viewer usage.
   - Remove or redesign any overlay container that enables vertical scrolling in the AR flow.
   - Ensure touch gestures used for alignment/pan still work.

2. **Fast align view should show only the next action**
   - Replace the current full multi-step instructional list with a concise single “next action” message.
   - Keep only essential status/warning notices.

3. **Alignment view starts closed and can be closed explicitly**
   - Alignment panel must default to closed.
   - It should open only when the user presses Align.
   - Add a clear close/dismiss control and wire state accordingly.

4. **Apply Align via center crosshair**
   - Keep crosshair in the center and use it as the apply-align target in alignment focus mode.
   - Style it as translucent green (low alpha), preserving current overall visual geometry.
   - Add instruction text at top: user should press/tap the middle of the screen.

5. **Re-alignment without reset dependency**
   - Pressing Align should allow re-aligning repeatedly.
   - Remove reset-as-required behavior/copy from fast alignment flow.
   - Update labels/messages to reflect direct re-alignment.

## Scope and constraints
- Focus on `components/viewer/viewer-shell.tsx`, `lib/viewer/alignment-tutorial.ts`, and any related settings/alignment UI wiring.
- Preserve existing permission and sensor behavior unless needed for the requested UX fixes.
- Do not introduce unrelated refactors.

## Deliverables expected from autoloop
- A concrete **plan** and tracked phases.
- **Implementation** changes for all outcomes above.
- **Tests** added/updated to cover:
  - alignment panel visibility/open-close behavior,
  - single next-action rendering (no full steps list in fast mode),
  - repeated align behavior without reset requirement,
  - center-crosshair align action affordance,
  - no-scroll behavior in viewer overlay/camera flow.
- Run and report relevant test commands.
