# Implement ↔ Code Reviewer Feedback

- Task ID: autoloop-task-star-marker-minimum-stage-scale-sl-436d95b6
- Pair: implement
- Phase ID: marker-scale-stage-slider
- Phase Directory Key: marker-scale-stage-slider
- Phase Title: Add persisted marker scale and star minimum sizing
- Scope: phase-local authoritative verifier artifact

- IMP-001 | blocking | `components/viewer/viewer-shell.tsx:getMarkerBaseSizePx`
  The new star base-size curve (`1 + magnitudeBoost * 2`) materially shrinks normal stars at scale `1`, which contradicts the request that sizes stay unchanged at scale `1` except for the new star-minimum behavior. Example: a star with `magnitude: 0.7` used to render from `6 + 2.64 * 0.75 = 7.98` (about `8px` before FOV scaling/floor), but now renders from `1 + 2.64 * 2 = 6.28` (about `6px`). That is a broad visual regression for common stars, not just the new dim-star minimum. Keep the existing star sizing curve as the scale-1 baseline and only relax the lower end enough for dim stars to reach `1px`; add a regression test covering a representative non-dim star at scale `1` so this does not drift again.
- IMP-002 | non-blocking | `tests/unit/viewer-shell-celestial.test.ts`
  The current celestial coverage proves the new dim-star floor and `scale=4` multiplier, but it does not explicitly lock the required "unchanged at scale 1 except dim-star minimum" behavior for a representative normal star. After fixing `IMP-001`, add one scale-1 assertion for a typical visible star so the intended baseline sizing contract is protected from future drift.

- Cycle 2 re-review: `IMP-001` is resolved by preserving the legacy scale-1 rendered size for stars that were already above the old floor in `getScaleOneStarMarkerSizePx`, and `IMP-002` is resolved by the added representative non-dim star assertion in `tests/unit/viewer-shell-celestial.test.ts`. No remaining findings.
