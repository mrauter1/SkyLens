# Alignment Target Diagnosis and Fix Plan

## Date
2026-03-27

## Reported problems
1. Sun/Moon alignment target buttons should always be selectable.
2. Default selected alignment target should be whichever is more likely visible right now.

## Root-cause diagnosis

### 1) Target availability is tied to current visible scene objects
`resolveCalibrationTarget(...)` derives `availability.sun` and `availability.moon` from the currently visible celestial targets in `sceneObjects`.

Because `sceneObjects` only contains objects that survive astronomy visibility filtering, the corresponding button is disabled when that body is not in the visible set.

### 2) Sun/Moon buttons are explicitly disabled when availability is false
`AlignmentTargetButton` uses `disabled={!available}` in both the live panel and settings panel implementations.

This makes one target impossible to reselect if its availability flips false.

### 3) Default selection is hardcoded to `sun`
`alignmentTargetPreference` currently initializes to `'sun'`, not context-aware visibility.

## Desired behavior
- Sun and Moon buttons remain enabled at all times.
- The *initial/default* selected target should be chosen using runtime likelihood:
  - If only one of Sun/Moon is currently visible, choose that one.
  - If both are visible, choose the one with higher elevation (or stronger visibility heuristic).
  - If neither is visible, use a sensible fallback heuristic (e.g., prefer Moon at night using solar altitude, Sun during daytime).
- User manual choice must not be overwritten after they make a selection.

## Implementation plan
1. **Decouple UI button enabled state from dynamic availability**
   - Remove `disabled={!available}` behavior for Sun/Moon target buttons.
   - Keep availability data for messaging/telemetry only.

2. **Add default-target heuristic resolver**
   - Implement helper function to choose default alignment target from current scene and solar altitude.
   - Candidate heuristic:
     - visible Sun only => Sun
     - visible Moon only => Moon
     - both visible => higher elevation
     - neither visible => Moon if `sunAltitudeDeg < 0`, else Sun

3. **Apply default once per session unless user overrides**
   - Track whether user manually changed alignment target.
   - Auto-apply heuristic only until first manual target selection.

4. **Preserve existing calibration fallback behavior**
   - Keep `resolveCalibrationTarget(...).target` fallback chain for actual calibration target selection.
   - Keep informational fallback copy where relevant.

5. **Add/adjust tests**
   - Verify Sun and Moon target buttons remain enabled regardless of availability flags.
   - Verify initial default target follows heuristic for day/night and visibility permutations.
   - Verify manual user selection is sticky and not overridden by subsequent renders.
