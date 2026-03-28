# Implement ↔ Code Reviewer Feedback

- Task ID: autoloop-task-star-marker-minimum-stage-scale-sl-436d95b6
- Pair: implement
- Phase ID: marker-scale-stage-controls
- Phase Directory Key: marker-scale-stage-controls
- Phase Title: Implement marker scale setting and star minimum sizing
- Scope: phase-local authoritative verifier artifact

- IMP-001 | non-blocking | No blocking findings in the corrected checkout. `components/viewer/viewer-shell.tsx:getMarkerSizePx` now preserves the legacy scale-1 star size whenever the old computation already produced more than `6px`, while allowing only previously floor-clamped stars to relax down to `1px`. [tests/unit/viewer-shell-celestial.test.ts](/workspace/SkyLens/tests/unit/viewer-shell-celestial.test.ts) now asserts the dim-star `1px` case, a mid-bright star preserving its former `7px` size at scale `1`, the non-star `6px` minimum, and the scale=`4` slider persistence/update path. Re-ran `npm test -- --run tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell.test.ts tests/unit/viewer-settings.test.tsx`: 3 files passed, 96 tests passed.
