# Test Strategy

- Task ID: desktop-ui-prd-ard-implementation
- Pair: test
- Phase ID: desktop-settings-dialog
- Phase Directory Key: desktop-settings-dialog
- Phase Title: Fix desktop settings clipping with a desktop dialog variant
- Scope: phase-local producer artifact

## Behavior-To-Test Coverage Map
- Desktop dialog shell selection and reachability:
  - `SettingsSheet` desktop presentation renders a centered dialog shell, desktop-sized max height, and an internal scroll region.
  - `ViewerShell` passes `presentation="desktop-dialog"` to the desktop settings trigger path.
- Desktop dismiss/focus contract:
  - Desktop dialog closes on `Escape` and restores focus to the trigger.
  - Desktop dialog ignores inner interaction but closes on backdrop click and restores focus.
- Preserved mobile behavior:
  - Mobile `SettingsSheet` keeps the compact shell classes and internal scroll region contract.

## Preserved Invariants Checked
- Settings content tree stays reachable after the desktop shell swap.
- Inner control interaction does not dismiss the desktop dialog.
- Trigger `aria-expanded` and focus restoration still reflect open/close state correctly.

## Edge Cases
- Desktop dismiss coverage exercises both supported close paths (`Escape`, backdrop).
- Inner checkbox interaction is asserted before backdrop close to catch accidental outside-click containment regressions.

## Failure Paths
- If `ViewerShell` stops passing the desktop presentation prop, the desktop header integration assertion fails.
- If the desktop shell loses its internal scroll container or close/focus wiring, the dedicated `SettingsSheet` tests fail.

## Flake Risks / Stabilization
- Jsdom emits expected canvas `getContext()` warnings from broader viewer rendering; assertions avoid canvas output and stay DOM/focus driven.
- All dialog interactions use direct DOM events under `act(...)` for deterministic focus and close sequencing.

## Known Gaps
- No visual snapshot coverage; layout assertions stay class/style based to avoid brittle rendering tests.
