# SkyLens Scope Realism — Final Complete PRD + ARD

## Locked Decisions
1. Scope mode toggle is in quick controls with optional mirrored settings toggle.
2. Aperture + magnification are in quick controls when scope mode is ON.
3. Transparency and marker-scale are in Settings.
4. Sky quality/Bortle is out of scope (assume best-sky baseline).
5. Existing likely-visible logic is unchanged.
6. Add separate scope-optics filtering and photometric rendering logic.

## PRD
### Goals
- Add optics-driven limiting magnitude using aperture, magnification, transparency, and altitude.
- Add photometric dimmer/brightness realism based on magnitude and conditions.
- Keep stars compact; do not scale star diameter linearly with zoom/magnification.
- Persist settings and remain backward compatible.

### Functional Requirements
- Canonical state: `scopeModeEnabled` in viewer settings.
- Quick controls show aperture+magnification only when scope mode ON.
- Settings show transparency + marker-scale; marker-scale removed from quick controls.
- Scope optics filter is applied in addition to existing logic.
- Likely-visible/daylight behavior remains unchanged.

### Acceptance Criteria
- Toggle sync between quick controls and settings.
- Monotonic limiting magnitude behavior with A/M/T/altitude changes.
- Photometric intensity varies realistically with magnitude/transparency/altitude.
- 10x magnification does not produce 10x star diameter.
- Legacy settings payloads load safely.

## ARD
### New module
Create `lib/viewer/scope-optics.ts` with pure deterministic functions:
- `computeLimitingMagnitude(optics, altitudeDeg)`
- `isStarVisibleWithScopeOptics(starMagnitude, optics, altitudeDeg)`
- `computeStarPhotometry(starMagnitude, optics, altitudeDeg)`

### Settings schema
Add to `ViewerSettings`:
- `scopeModeEnabled: boolean`
- `scopeOptics: { apertureMm, magnificationX, transparencyPct }`

Clamps:
- aperture 50..400
- magnification 10..400
- transparency 40..100

Defaults:
- scopeModeEnabled false
- aperture 100
- magnification 40
- transparency 80

### Limiting magnitude formula
- `base = 2.2 + 2.0*log10(A) + 0.30*log10(M)`
- `transparencyAdj = 1.3*(T - 0.7)`
- `z = clamp(90-h, 0, 80)`
- `airmass = 1/cos(z)`
- `altPenalty = 0.22*(airmass - 1)`
- `effectiveLimit = clamp(base + transparencyAdj - altPenalty, 3.0, 15.5)`

### Photometric model constants (locked)
- `mRef=6.0`, `kExt=0.16`, `gamma=2.2`, `Imax=4.0`
- `coreMin=1.0`, `coreMax=3.8`, `haloBase=1.25`, `haloGain=1.6`
- `gAmax=1.35`, `gMmax=1.20`

### Photometric equations
- `relativeFlux = 10^(-0.4*(m-mRef))`
- `transparencyFactor = clamp(T,0.4,1.0)`
- `altitudeTransmission = exp(-kExt*(airmass-1))`
- `gA = clamp(1 + 0.18*log10(A/100), 0.85, gAmax)`
- `gM = clamp(1 + 0.10*log10(M/40), 0.90, gMmax)`
- `rawI = relativeFlux * transparencyFactor * altitudeTransmission * gA * gM`
- `displayIntensity = clamp(rawI,0,Imax)^(1/gamma)` then clamp 0..1
- `corePx = clamp(coreMin + 1.2*log10(1 + 6*displayIntensity), coreMin, coreMax)`
- `haloPx = corePx * (haloBase + haloGain*displayIntensity)`

### Pipeline order
1. Existing gates unchanged (enabled layer, likely-visible/daylight, horizon).
2. If scope mode ON: limiting magnitude filter.
3. If passes: compute `scopeRender {displayIntensity, corePx, haloPx}` metadata.
4. Render consumes metadata directly.

### Test plan
- Add `tests/unit/scope-optics.test.ts` with deterministic and monotonic checks.
- Update settings tests for defaults/clamps/legacy compatibility.
- Update viewer integration tests for control placement and toggle sync.
- Add non-regression tests proving likely-visible behavior is unchanged.

## Definition of Done
- All controls are in correct locations and synchronized.
- Scope optics filtering + photometric rendering active in scope mode.
- Marker-scale relocated to settings.
- Likely-visible logic unchanged.
- Tests pass and calibration envelopes are met.
