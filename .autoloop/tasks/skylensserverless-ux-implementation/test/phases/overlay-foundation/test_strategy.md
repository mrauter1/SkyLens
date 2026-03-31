# Test Strategy

- Task ID: skylensserverless-ux-implementation
- Pair: test
- Phase ID: overlay-foundation
- Phase Directory Key: overlay-foundation
- Phase Title: Overlay foundation and dismissal policy
- Scope: phase-local producer artifact

## Behavior coverage map
- AC-1 / `SettingsSheet` dismissal and focus restore:
  - `tests/unit/settings-sheet.test.tsx`
    - `closes on Escape and returns focus to the settings trigger`
    - `closes on backdrop click, ignores inner clicks, and restores focus to the trigger`
  - `tests/e2e/demo.spec.ts`
    - `settings sheet closes from its backdrop and restores focus to Settings`
- AC-2 / shared full-height sheet contract:
  - `tests/unit/viewer-shell.test.ts`
    - `matches compact alignment max height to the compact mobile viewer overlay contract`
    - existing non-live/shared overlay assertions keep `mobile-viewer-overlay*` and `mobile-alignment-overlay*` as the stable regression hooks
  - `tests/e2e/demo.spec.ts`
    - `mobile overlay keeps lower sections reachable on a short viewport`
  - `tests/e2e/permissions.spec.ts`
    - `compact alignment panel keeps lower controls reachable on a short viewport`
- AC-3 / guarded alignment-focus mode remains non-dismissible:
  - `tests/unit/viewer-shell.test.ts`
    - `hides mobile overlay chrome and the alignment panel during explicit alignment focus`
    - asserts the alignment instruction shell and backdrop are removed once focus mode starts, so there is no accidental backdrop-dismiss path
- AC-4 / opener or explicit same-surface fallback focus restore:
  - `tests/unit/viewer-shell.test.ts`
    - `closes the mobile viewer overlay on Escape and restores focus to the trigger`
    - `closes the alignment overlay on backdrop click and restores focus to mobile Align`
    - `falls back to the mobile Align action when alignment closes after its settings opener unmounts`
    - `prefers the visible mobile settings trigger when alignment closes over a reopened mobile viewer overlay`
  - `tests/e2e/demo.spec.ts`
    - `mobile overlay opens from the trigger and closes from the backdrop only`
  - `tests/e2e/permissions.spec.ts`
    - `alignment instructions close from the backdrop and restore focus to Align`

## Preserved invariants checked
- Existing mobile overlay, alignment overlay, and settings sheet selectors remain the regression anchors.
- Inner-panel interaction does not count as backdrop dismissal.
- Focus restoration stays on surviving controls that reopen the same surface.
- Explicit alignment focus does not reuse the dismissible instruction-sheet/backdrop contract.

## Edge cases and failure paths
- Settings-trigger opener unmount falls back to `mobile-align-action`.
- Reopened mobile viewer overlay while alignment remains open restores focus to the surviving mobile settings trigger.
- Short mobile viewport keeps both viewer and alignment sheet content internally scrollable.

## Known gaps
- Playwright coverage remains environment-blocked here because Chromium launch is missing `libatk-1.0.so.0`.
- Desktop landing/banner hierarchy changes are out of phase and intentionally not covered in this strategy.
