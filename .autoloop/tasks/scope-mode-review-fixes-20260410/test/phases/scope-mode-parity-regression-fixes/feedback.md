# Test Author ↔ Test Auditor Feedback

- Task ID: scope-mode-review-fixes-20260410
- Pair: test
- Phase ID: scope-mode-parity-regression-fixes
- Phase Directory Key: scope-mode-parity-regression-fixes
- Phase Title: Restore Scope-Mode Wide-Stage Parity
- Scope: phase-local authoritative verifier artifact

- TST-001 `blocking`: [SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx#L730) does not actually lock stage-marker sizing to the wide-stage baseline FOV. The new assertion only checks that the scope-lens marker is larger than the stage marker in one scope-mode render, so a regression that still shrinks or enlarges stage markers away from the wide baseline but leaves them smaller than the scope overlay would still pass. Minimal correction: compare the stage marker size in scope mode against the normal wide-stage baseline size for the same object, or assert against the expected baseline sizing helper directly.
- TST-002 `blocking`: [SkyLensServerless/components/viewer/viewer-shell.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx#L1266) changed both selected and hovered summary resolution to use `resolveInteractionSummaryObject`, but the new regression coverage only exercises selected stage-click motion alignment in [SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts#L720). There is no companion regression for the hovered path, even though `activeSummaryObject` prioritizes `hoveredObject` over `selectedObject` in [SkyLensServerless/components/viewer/viewer-shell.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx#L1292). A hover-surface mismatch could therefore regress the accepted behavior while all new tests still pass. Minimal correction: add a scope-mode hover regression that drives `pointerenter` on a stage marker and asserts the hovered summary or motion-affordance coordinates stay on that marker’s projection surface.
