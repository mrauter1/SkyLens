# IMPLEMENTATION TARGET: SkyLensServerless (mandatory)

All implementation work in this task MUST be applied to the `SkyLensServerless/` app subtree and its tests/configs. Do not implement in repo-root SkyLens app unless explicitly required for shared tooling.

# SkyLens Scope Realism — PRD + ARD (SkyLensServerless)

## Locked decisions
1. Scope mode toggle in quick controls, with optional mirrored settings toggle.
2. Aperture + magnification in quick controls when scope mode is ON.
3. Transparency + marker scale in Settings.
4. Sky quality/Bortle removed (assume best-sky baseline).
5. Preserve existing likely-visible logic unchanged.
6. Add separate scope optics filtering and photometric rendering logic.

## PRD
### Goals
- Telescope-realistic star visibility based on aperture, magnification, transparency, and altitude.
- Photometric dimming/intensity response based on star magnitude and conditions.
- Keep stars compact; no linear 10x zoom => 10x star diameter behavior.
- Ensure desktop/mobile quick-controls parity for scope optics controls in SkyLensServerless.

### Functional requirements
- Canonical persisted state: `scopeModeEnabled`.
- Quick controls (desktop + mobile): scope toggle + aperture + magnification when enabled.
- Settings: transparency + marker scale (settings-only).
- Scope optics filter applies after existing gates.
- Scope render metadata produced only when scope mode is enabled.

### Acceptance criteria
- Scope controls visible in quick actions on both desktop and mobile in SkyLensServerless.
- Marker scale only in Settings (not mobile quick controls).
- Aperture/magnification sliders visible when scope mode ON.
- Malformed optics inputs cannot produce NaN/Infinity in exported helper functions.
- Tests pass for normalization, slider placement, parity, and photometric behavior.

## ARD
### Scope
Implement in:
- `SkyLensServerless/lib/viewer/settings.ts`
- `SkyLensServerless/lib/viewer/scope-optics.ts`
- `SkyLensServerless/lib/astronomy/stars.ts`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/components/settings/settings-sheet.tsx`
- `SkyLensServerless/tests/unit/...`

### Data model
Add/ensure:
- `scopeModeEnabled: boolean`
- `scopeOptics: { apertureMm, magnificationX, transparencyPct }`
- Shared `SCOPE_OPTICS_RANGES` constants with min/max/step reused in settings normalization and UI sliders.

### Limiting magnitude formula
- `base = 2.2 + 2.0*log10(A) + 0.30*log10(M)`
- `transparencyAdj = 1.3*(T - 0.7)`
- `z = clamp(90-h, 0, 80)`
- `airmass = 1/cos(z)`
- `altPenalty = 0.22*(airmass - 1)`
- `effectiveLimit = clamp(base + transparencyAdj - altPenalty, 3.0, 15.5)`

### Photometric model
- `relativeFlux = 10^(-0.4*(m-mRef))`
- Transmission from transparency + altitude
- Bounded optics gain from aperture/magnification
- Nonlinear display mapping and bounded core/halo px sizes

### Pipeline order
1. Existing visibility gates unchanged.
2. If scope mode ON => limiting-magnitude filter.
3. If passes => attach scope render metadata.
4. Renderer consumes metadata with fallback for malformed values.

### Testing requirements
- Add/update tests in SkyLensServerless only:
  - invalid optics normalization robustness
  - shared range constants reuse
  - mobile+desktop quick-control parity
  - marker scale only in Settings
  - scope photometric rendering and fallback behavior

## Autoloop execution requirements
- Run with pairs: `plan,implement,test`.
- Use full auto answers.
- Do not set max iterations.
- Complete all enabled pairs.
