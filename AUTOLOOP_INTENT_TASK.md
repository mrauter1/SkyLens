# Intent
Improve the SkyLens in-view object presentation and camera orientation behavior so the viewer feels physically correct, uncluttered, and configurable.

# Task
Implement the following user-facing outcomes:

1. **Camera pitch / zenith behavior**
   - Remove the practical motion break near pitch 90° so camera movement remains correct and continuous when pointing upward.
   - Refactor orientation handling to avoid singular behavior around zenith/nadir and maintain stable projection behavior.

2. **Object visualization as markers (not large label boxes)**
   - Render a compact object marker/drawing for visible objects.
   - Scale marker size based on apparent/visible size from camera context, with a minimum size cap to preserve visibility.

3. **Label display modes with sensible default**
   - Add a setting to control name display behavior:
     - `center_only` (default): show only the object name + identification for the object inside the crosshair.
     - `on_objects`: show labels near objects.
     - `top_list`: show names at the top for all currently shown objects.

4. **Label overlap behavior**
   - Prevent overlapping labels from displacing to visually incorrect locations.
   - Prefer stable anchoring and deterministic hide/de-prioritize behavior (and/or leader lines) over large positional drift.

5. **Tests and validation**
   - Add/update unit tests for orientation continuity near zenith, label mode behavior, and collision/placement behavior in dense scenes.
   - Run lint and test suite; ensure changes are covered and stable.

# Execution mode request
Use autoloop with plan → implement → test pairs and iterate until complete.
