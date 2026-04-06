# Implementation Notes

- Task ID: scope-realism-v2
- Pair: implement
- Phase ID: canonical-scope-optics-and-compatibility
- Phase Directory Key: canonical-scope-optics-and-compatibility
- Phase Title: Make magnification canonical for scope zoom and preserve legacy settings compatibility
- Scope: phase-local producer artifact
- Files changed: `SkyLensServerless/lib/viewer/scope-optics.ts`; `SkyLensServerless/lib/viewer/settings.ts`; `SkyLensServerless/components/viewer/viewer-shell.tsx`; `SkyLensServerless/components/settings/settings-sheet.tsx`; `SkyLensServerless/tests/unit/scope-optics.test.ts`; `SkyLensServerless/tests/unit/scope-runtime.test.ts`; `SkyLensServerless/tests/unit/viewer-settings.test.tsx`; `SkyLensServerless/tests/unit/settings-sheet.test.tsx`; `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- Symbols touched: `SCOPE_VERTICAL_FOV_RANGE`; `SCOPE_APPARENT_FIELD_DEG_RANGE`; `normalizeScopeVerticalFovDeg`; `magnificationToScopeVerticalFovDeg`; `scopeVerticalFovDegToMagnificationX`; `getDefaultViewerSettings`; `readViewerSettings`; `normalizeViewerSettings`; `SettingsSheet`; `ViewerShell`
- Checklist mapping: M1 complete via shared magnification/FOV helpers plus legacy FOV migration in settings normalization; M2 complete for viewer-shell/runtime consumers and settings-sheet removal of direct FOV control; M3 intentionally deferred to later phase scope
- Assumptions: canonical target app is `/workspace/SkyLens/SkyLensServerless`; virtual apparent-field default may differ from physical eyepiece AFOV and is tuned for compatibility
- Preserved invariants: storage key unchanged; `scopeModeEnabled` still prefers canonical field over legacy `scope.enabled`; transparency and marker scale remain settings-sheet owned; quick controls remain aperture + magnification; legacy `scope.verticalFovDeg` still persists as compatibility output
- Intended behavior changes: runtime scope projection/band/tile/marker FOV now derives from `scopeOptics.magnificationX`; persisted payloads with only legacy scope FOV now seed canonical magnification; settings sheet no longer exposes a user-facing scope FOV slider
- Known non-changes: no deep-star render-profile or scope canvas contract changes in this phase; no storage-format/key migration; no scope dataset/depth threshold changes beyond feeding derived FOV into existing selectors
- Expected side effects: changing magnification updates effective scope FOV immediately in runtime and persisted compatibility FOV on write; payloads containing both magnification and legacy FOV resolve to magnification-derived compatibility FOV
- Deduplication / centralization: scope FOV normalization and forward/inverse conversion are centralized in `lib/viewer/scope-optics.ts`; viewer-shell now reuses one derived effective scope FOV across projection, band selection, tile selection, marker sizing, and action status text
- Validation performed: `npm test -- tests/unit/scope-optics.test.ts tests/unit/scope-runtime.test.ts tests/unit/viewer-settings.test.tsx tests/unit/settings-sheet.test.tsx tests/unit/viewer-shell.test.ts` passed in `SkyLensServerless`
- Validation notes: broader `npm test` run in `SkyLensServerless` still reports pre-existing/unrelated failures in `tests/unit/viewer-shell-celestial.test.ts` (`builds top-list mode...` timeout, `renders a low-quality motion vector...`, `suppresses the trail polyline...` missing 1000ms interval)
