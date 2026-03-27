# Test Strategy

- Task ID: implement-alignment-target-diagnosis-and-fix-pla-29e6230a
- Pair: test
- Phase ID: align-target-default-and-override-fix
- Phase Directory Key: align-target-default-and-override-fix
- Phase Title: Fix alignment target selection defaults and override behavior
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- Always-selectable target buttons:
  `tests/unit/settings-sheet.test.tsx` verifies an unavailable Moon target stays enabled, still shows fallback copy, and still fires the selection callback.
  `tests/unit/viewer-settings.test.tsx` verifies the alignment controls rendered through `ViewerShell` stay enabled in the settings-driven panel.
  `tests/unit/viewer-shell-celestial.test.ts` verifies the live on-screen alignment panel keeps Sun/Moon buttons enabled and switchable.
- Visibility-aware default target selection:
  `tests/unit/viewer-shell-celestial.test.ts` covers Sun-only, Moon-only, both-visible higher-elevation selection, daytime fallback with neither body visible, and nighttime fallback with neither body visible.
  First-render assertions inspect the earliest mocked `SettingsSheet` props for Moon-only, higher-elevation Moon, and night-fallback cases so post-effect correction regressions are caught.
- Sticky manual override:
  `tests/unit/viewer-shell-celestial.test.ts` verifies an explicit Moon selection survives rerendered scene changes and remains the selected preference while fallback metadata points to Sun when Moon is unavailable.
- Preserved fallback behavior:
  `tests/unit/viewer-shell-celestial.test.ts` verifies suppressed/unavailable preferred bodies still fall back through Moon, brightest planet, brightest star, and north marker without changing the existing resolution order.
  `tests/unit/settings-sheet.test.tsx` and `tests/unit/viewer-shell-celestial.test.ts` verify preferred-target-unavailable messaging remains wired.

## Preserved invariants checked
- `alignmentTargetAvailability` remains informational and no longer disables selection controls.
- Calibration target resolution order remains Sun -> Moon -> planet -> star -> north marker when the preferred body is unavailable.
- Manual override state is session-local and not persisted.

## Edge cases
- Neither Sun nor Moon visible in daytime versus nighttime.
- Moon selected while unavailable, including fallback-label propagation.
- Higher-elevation tie-break path for simultaneous Sun/Moon visibility.

## Failure paths
- Preferred Sun suppressed or absent.
- Preferred Moon unavailable after a manual override.

## Flake-risk controls
- Viewer-shell tests use mocked astronomy, settings, and sensor dependencies only; no live network or device APIs are exercised.
- First-render checks read the first mocked `SettingsSheet` props instead of relying on asynchronous effect timing.

## Known gaps
- No dedicated equal-elevation Sun/Moon assertion; the implementation notes and decisions ledger document the deterministic Sun tie choice, but the current tests focus on the requested higher-elevation behavior.
