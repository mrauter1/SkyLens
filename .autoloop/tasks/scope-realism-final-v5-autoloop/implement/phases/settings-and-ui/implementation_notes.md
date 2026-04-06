# Implementation Notes

- Task ID: scope-realism-final-v5-autoloop
- Pair: implement
- Phase ID: settings-and-ui
- Phase Directory Key: settings-and-ui
- Phase Title: Settings migration and telescope diameter control
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/lib/viewer/settings.ts`
- `SkyLensServerless/components/settings/settings-sheet.tsx`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/viewer-settings.test.tsx`
- `SkyLensServerless/tests/unit/settings-sheet.test.tsx`

## Symbols touched
- `SCOPE_LENS_DIAMETER_PCT_RANGE`
- `ViewerSettings.scopeLensDiameterPct`
- `normalizeScopeLensDiameterPct`
- `SettingsSheet` props for `scopeLensDiameterPct` and `onScopeLensDiameterPctChange`
- `viewer-shell.tsx` `settingsSheetProps`

## Checklist mapping
- Phase 1: Added persisted `scopeLensDiameterPct` defaults/read/write normalization with backward-compatible reads.
- Phase 1: Added `SettingsSheet` telescope diameter slider and immediate callback delegation.
- Phase 1: Wired `viewer-shell` state/props for the new setting.
- Deferred intentionally: runtime lens px computation changes remain in later scope-realism phases.

## Assumptions
- The authoritative implementation surface for this turn is the nested `SkyLensServerless/` app referenced by the PRD/ARD.

## Preserved invariants
- Storage key unchanged.
- Older payloads without `scopeLensDiameterPct` still load safely.
- Existing `scope.verticalFovDeg` / `scopeOptics.magnificationX` migration semantics unchanged.
- Normalized values remain the source of truth for persisted settings.

## Intended behavior changes
- Viewer settings now persist `scopeLensDiameterPct`, default `75`, clamped `50..90`.
- Settings sheet exposes `Telescope diameter` as `% of screen height`.
- Viewer-shell accepts sheet updates immediately and persists normalized values.

## Known non-changes
- No scope lens px/runtime optics math changes in this phase.
- No storage key change.
- No catalog, deployment, or `.bin` artifact changes.

## Expected side effects
- Newly normalized settings writes add `scopeLensDiameterPct` to stored payloads.

## Validation performed
- Ran `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/settings-sheet.test.tsx` in `SkyLensServerless/` and all tests passed.

## Deduplication / centralization
- Kept range/default/clamp logic centralized in `lib/viewer/settings.ts` and reused that normalizer from `viewer-shell.tsx`.
