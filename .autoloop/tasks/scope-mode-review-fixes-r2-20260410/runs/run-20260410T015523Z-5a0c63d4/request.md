# Autoloop Task: Scope-mode review fixes (SkyLensServerless)

## Goal
Apply the review fixes for scope-mode parity regression while preserving the intended product behavior:
- Scope lens should include parity object classes.
- Wide stage should retain wide-context rendering/interaction semantics.
- Scope optics (magnified sizing/projection) should remain confined to lens rendering.

## Required fixes from review
1. **Restore wide-stage marker set in scope mode**
   - Do not restrict stage `interactiveMarkerObjects` to `scopeInteractiveMarkerObjects`.
   - Wide stage should continue using full wide-stage eligible marker set so objects outside lens remain visible/interactive.

2. **Restore wide-stage sizing baseline in scope mode**
   - Stage marker size calculation must not use scope-magnified effective FOV when scope mode is active.
   - Ensure stage markers remain scaled to wide-stage baseline/FOV behavior.

3. **Restore wide-stage highlight ownership**
   - Stage marker highlight/active style should follow wide-scene center-lock logic, not scope center-lock winner.

4. **Fix selected/hovered projection consistency in scope mode**
   - Prevent drift where selected/hovered summary/motion-affordance coordinates come from wide projection while marker interaction source is scope-space.
   - Ensure active summary object coordinates align with the marker projection surface driving interaction.

5. **Correct tests that currently encode regressions**
   - Update `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx` so scope-lens vs stage marker-size expectations reflect intended split (lens magnified; stage baseline unchanged).
   - Update/add tests in `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts` to lock in:
     - stage markers remain visible outside lens during scope mode,
     - stage highlighting follows wide-scene center lock,
     - motion-affordance/selection coordinates remain aligned.

6. **Settings test/doc alignment**
   - Reconcile `tests/unit/viewer-settings.test.tsx` expectation with intended business logic for aperture when scope mode disabled.
   - If clamping to 100 when disabled is intended, keep tests/docs consistent and clearly scoped.
   - If not intended, revert test-only adaptation and align code + tests accordingly.

## Constraints
- Keep changes focused to the reviewed regressions and related tests.
- Avoid unrelated refactors.
- Preserve existing selector compatibility (`scope-bright-object-marker`) unless tests and behavior explicitly require change.

## Validation
Run focused and relevant tests at minimum:
- root tests affected by settings changes
- SkyLensServerless viewer scope/celestial tests
- any additional targeted tests needed to prove regression closure

## Execution mode
Use autoloop with:
- full-auto answers enabled
- pairs: plan, implement, test
- no max-iterations override
