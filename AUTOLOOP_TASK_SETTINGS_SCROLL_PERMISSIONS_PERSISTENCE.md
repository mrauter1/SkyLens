# SkyLens task: settings scroll parity + permission messaging + full persistence

## Objective
Implement the following in the live viewer experience:

1. **Settings scroll behavior parity with Open viewer overlay**
   - Keep the **stage (camera/stars background) fixed** when settings are open.
   - Make only settings content scroll internally, matching open viewer behavior.
   - Ensure mobile safe-area and max-height behavior remains robust.

2. **Permission action labels and motion-disabled warning**
   - When permissions are missing, show the correct CTA text:
     - "Enable camera and motion" when both are missing
     - "Enable camera" when only camera is missing
     - "Enable motion" when only motion is missing
   - When motion is not enabled, show a **yellow warning message** with polished wording that preserves meaning:
     - motion is not enabled
     - elements will not be shown in the right location
   - Ensure warning appears consistently in relevant overlay states.

3. **Persist all settings + calibration settings in localStorage**
   - Persist viewer settings and all calibration-related settings/state.
   - Ensure values restore correctly after reload.
   - Preserve backward compatibility with existing storage payloads.

## Scope guidance
- Focus on viewer and settings modules (likely `components/viewer/viewer-shell.tsx`, `components/settings/settings-sheet.tsx`, `lib/viewer/settings.ts`, and related tests).
- Add/adjust tests to cover:
  - fixed stage + internal settings scrolling
  - permission label permutations
  - yellow motion-disabled warning
  - persistence and restore of settings + calibration state

## Execution requirements
- Use pairs: **plan, implement, test**.
- Use full auto answers.
- Do not set max_iterations.
