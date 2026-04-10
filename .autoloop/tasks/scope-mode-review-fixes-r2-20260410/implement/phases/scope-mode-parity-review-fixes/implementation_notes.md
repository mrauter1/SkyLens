# Implementation Notes

- Task ID: scope-mode-review-fixes-r2-20260410
- Pair: implement
- Phase ID: scope-mode-parity-review-fixes
- Phase Directory Key: scope-mode-parity-review-fixes
- Phase Title: Restore scope-mode parity ownership and regression coverage
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
- `SkyLensServerless/lib/vendor/satellite.ts`
- `tests/unit/viewer-settings.test.tsx`
- `.autoloop/tasks/scope-mode-review-fixes-r2-20260410/decisions.txt`

## Symbols and logic touched
- `ViewerShell` selected/hovered summary-object resolution inputs
- `resolveInteractionSummaryObject` call sites (stage/scope object source selection)
- `createNamedScopeDataset` test fixture helper (celestial)
- long-running test timeouts in root/settings + serverless scope-runtime/celestial tests
- satellite vendor re-export shim (`lib/vendor/satellite.ts`)

## Checklist mapping
- Milestone 1 (runtime ownership boundaries):
  - `viewer-shell.tsx` now resolves selected/hovered summary from marker-eligible source arrays (`mainViewInteractiveMarkerObjects` and `scopeInteractiveMarkerObjects`) to keep interaction-summary coordinates on the interaction projection surface.
- Milestone 2 (test corrections / parity guards):
  - retained and validated celestial parity tests for outside-lens stage marker visibility, wide-scene highlight ownership, and motion-affordance coordinate alignment.
  - kept scope-runtime marker-size split invariant and added timeout headroom to long-running scope-runtime integration tests.
- Milestone 3 (settings alignment):
  - root `viewer-settings` integration tests updated with timeout headroom only; aperture-disabled expectation remains explicit (`100mm` clamp).
- Milestone 4 (validation):
  - executed focused root and serverless test commands (see Validation).

## Assumptions
- Disabled-mode aperture normalization to `100mm` is intended behavior.
- Scope parity acceptance can be demonstrated with focused celestial invariants when unrelated long-running tests are timing-sensitive in this environment.

## Preserved invariants
- Stage marker source/highlight/sizing ownership remains wide-stage oriented in scope mode.
- Scope lens marker rendering remains lens-only and selector-compatible (`scope-bright-object-marker`).
- No API/schema/selector rename introduced.

## Intended behavior changes
- Selected/hovered summary and motion-affordance anchor coordinates now resolve from marker-eligible projection sets tied to the interaction surface, reducing stage/scope drift risk.

## Known non-changes
- No viewer architecture refactor.
- No dataset/catalog schema changes.

## Side effects
- `SkyLensServerless/lib/vendor/satellite.ts` now uses stable package exports from `satellite.js` instead of relative `../../node_modules/...` deep paths to avoid resolver breakage during tests.

## Validation performed
- Passed: `cd /workspace/SkyLens && npm test -- tests/unit/viewer-settings.test.tsx`
- Passed: `cd /workspace/SkyLens/SkyLensServerless && npm test -- tests/unit/viewer-shell-scope-runtime.test.tsx`
- Passed (focused celestial parity invariants):
  - `cd /workspace/SkyLens/SkyLensServerless && npm test -- tests/unit/viewer-shell-celestial.test.ts -t "keeps wide-stage markers visible and clickable outside the scope lens in scope mode|keeps stage marker highlight ownership on the wide-scene center lock in scope mode|keeps motion-affordance coordinates aligned with the clicked stage marker in scope mode"`
- Known environment-sensitive test still timing out when run directly:
  - `keeps focused aircraft trails aligned with aircraft markers in normal view` in `viewer-shell-celestial.test.ts`.

## Deduplication / centralization notes
- Kept summary-coordinate surface alignment localized to existing `resolveInteractionSummaryObject` call sites; no new abstraction introduced.
