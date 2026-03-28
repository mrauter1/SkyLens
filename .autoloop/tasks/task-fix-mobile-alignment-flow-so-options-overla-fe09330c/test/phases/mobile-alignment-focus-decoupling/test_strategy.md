# Test Strategy

- Task ID: task-fix-mobile-alignment-flow-so-options-overla-fe09330c
- Pair: test
- Phase ID: mobile-alignment-focus-decoupling
- Phase Directory Key: mobile-alignment-focus-decoupling
- Phase Title: Decouple mobile alignment options from active crosshair focus
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- AC-1 mobile two-step entry:
  - `shows first-use mobile actions for permissions and alignment while keeping viewer access`
  - `keeps Align visible as the entry point before a live sample exists even after permissions are granted`
  - `surfaces live-panel blocker copy and a disabled start action before the first motion sample`
  - `keeps Start alignment visible if the mobile viewer overlay is reopened while alignment is open`
- AC-2 focus mode hides overlapping chrome:
  - `routes the mobile align action through the panel before entering alignment focus`
  - `hides mobile overlay chrome and the alignment panel during explicit alignment focus`
- AC-3 cancel / close restores quick actions without calibrating:
  - `closes the alignment view explicitly and restores the mobile Align action`
- AC-4 apply alignment and preserve repeat behavior:
  - `allows repeated alignment without requiring reset first`
  - `exposes on-view manual nudges and gated reset controls in the alignment panel`

## Preserved invariants checked
- Calibration is not applied when the align panel opens or closes.
- Crosshair focus is entered only from `Start alignment`.
- The center crosshair is absent while the panel is open and present after focus begins.
- Reopening the mobile overlay while alignment is open does not hide the `Start alignment` CTA.

## Edge cases
- No live motion sample yet: `Start alignment` remains visible but disabled with blocker copy.
- Mobile overlay reopened during alignment: the same CTA remains visible in the overlay shell.
- Previously calibrated state: repeated alignment still works without requiring reset.

## Failure paths
- No motion sample available blocks focus activation via a disabled `Start alignment` CTA rather than removing the action.
- Close / cancel exits alignment safely without mutating calibration.

## Stabilization approach
- Tests mock orientation, camera, and location dependencies and drive DOM events through `act()` plus `flushEffects()` to keep async React updates deterministic.

## Known gaps
- Repo-wide `npx tsc --noEmit` remains red outside this task because `tests/unit/settings-sheet.test.tsx` has a stale `SettingsSheetProps` fixture; this phase does not normalize that unrelated failure.
