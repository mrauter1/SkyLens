# SkyLensServerless Telescope Scope Overlay — Product Requirements Document (PRD)

Version: 1.1  
Status: Approved for implementation  
Audience: Autonomous coding agent with access to the current SkyLensServerless codebase  
Normative language: MUST, MUST NOT, SHOULD, MAY are binding.

---

## 1. Purpose

This document defines the product requirements for adding a **virtual telescope scope overlay** to the existing SkyLensServerless viewer.

This document is standalone and normative for the scope feature. If the current codebase and this document disagree, this document wins for the scope feature.

The implementation target is the current repository and deployment model:
- Next.js app-router static export
- Render static-site hosting
- Existing wide-field AR viewer, demo mode, and fallback modes
- Existing DOM/SVG selection model, settings persistence, and automated tests

---

## 2. Product summary

Add a **separate scope mode** to SkyLensServerless that overlays a **fixed centered circular telescope lens** on top of the existing viewer.

When scope mode is enabled:
- the existing wide AR scene remains visible outside the lens
- the lens shows a telescope-style view of the same direction
- the lens uses a **virtual telescope field of view** that is independent from the base viewer field of view
- the lens renders **deeper stars than the wide AR scene**
- the lens remains driven entirely by the app’s virtual sky projection
- no hardware camera zoom is used

The feature MUST work in:
- live mode with camera
- live mode without camera
- demo mode
- manual-pan fallback mode

The feature MUST NOT require any server runtime. All assets required by the feature MUST be loadable as static files.

---

## 3. Locked product decisions

The following decisions are already made and MUST NOT be reopened:

1. **Scope mode is a mode inside `/view`, not a separate route.**
2. **The base viewer and the scope overlay remain visually layered together.** Outside the circle, the normal viewer continues to render.
3. **The base viewer FOV and the scope FOV are independent.**
4. **No hardware camera zoom is used.**
5. **The source of truth is the virtual telescope projection.**
6. **The lens is circular, fixed, and centered in v1.**
7. **The lens uses a second projection pass.** Existing wide projected coordinates MUST NOT be CSS-scaled and reused as telescope coordinates.
8. **Dense faint scope stars are non-directly-interactive in v1.** They may carry optional names when the dataset provides them.
9. **Bright/named scope objects and named deep scope stars are scope-eligible for center-lock and detail precedence, but are NOT directly clickable inside the lens in v1.**
10. **The scope layer MUST block click-through to underlying wide markers inside the lens.**
11. **Constellations, aircraft, and generic satellites are not rendered inside the lens in v1.**
12. **ISS-in-lens behavior is deferred.**
13. **Canvas 2D is the required dense-star renderer in v1.**
14. **WebGL and WebGPU are out of scope in v1.**
15. **The production architecture must support a larger static scope dataset, but implementation MUST NOT block on an unavailable external source catalog.** If no production source catalog is present in the repo, the implementation MUST still ship a fully working end-to-end feature with a committed development dataset in the same runtime schema.
16. **The development dataset MUST contain deeper stars than the existing wide bright-star layer.** Reusing the same 200-star wide dataset without deeper augmentation is not acceptable.

---

## 4. Goals

### 4.1 Primary goals

1. Add a believable telescope experience without replacing the current wide AR viewer.
2. Keep the current UX, fallbacks, focus behavior, and accessibility semantics intact.
3. Make the telescope overlay feel optically distinct from the base scene.
4. Increase visible star density **inside the lens only**.
5. Keep the implementation compatible with static hosting on Render free tier.
6. Keep the feature fully testable in unit tests and Playwright.

### 4.2 Secondary goals

1. Prepare the repo for a larger future static catalog without a renderer rewrite.
2. Encapsulate the scope feature behind clear interfaces so the lens renderer can evolve independently.
3. Keep the shipped dataset versioned and swappable without code changes.

---

## 5. Non-goals

The following are explicitly out of scope for v1:

1. Real optical simulation such as coma, field curvature, diffraction spikes, or realistic bokeh.
2. Hardware camera zoom.
3. Telescope mount control or external telescope integration.
4. Telescope communication protocols.
5. Full renderer rewrite of the entire stage.
6. WebGL implementation.
7. WebGPU implementation.
8. User-draggable or user-resizable scope lens.
9. Split-screen or multiple simultaneous lenses.
10. Deep-sky object catalogs beyond the current scene model.
11. Direct selection of faint lens stars.
12. Pointer interaction inside the lens.

---

## 6. User stories

### 6.1 Casual user
As a user, I want to turn on a telescope mode so I can keep the normal sky view while inspecting the center of the screen as if looking through a handheld scope.

### 6.2 Astronomy-curious user
As a user, I want to see deeper stars in the telescope lens than in the normal AR overlay so the lens actually feels more powerful.

### 6.2b Named deep-star user
As a user, when a deeper scope star has a known name and I center it in the telescope, I want the centered scope readout to show that name.

### 6.3 Demo user
As a user in demo mode, I want scope mode to work without the live camera so I can test the feature and see denser sky rendering.

### 6.4 Fallback user
As a user whose camera or motion permissions are unavailable, I want scope mode to keep working with the app’s virtual sky so the feature still adds value in fallback modes.

### 6.5 Maintainer
As a maintainer, I want the scope overlay to be implemented with minimal disruption to the current viewer architecture so current tests and interactions remain trustworthy.

---

## 7. Functional requirements

## FR-1 — Scope mode availability

Scope mode MUST be available whenever the viewer is active and not in a blocked startup state.

Allowed:
- live viewer with sensor mode
- live viewer with manual-pan fallback
- live viewer without camera
- demo viewer

Not allowed:
- blocked startup states before viewer activation
- secure-context unsupported startup blocker

If scope mode is unavailable, no scope toggle may be shown.

## FR-2 — Scope mode entry points

The user MUST be able to enable and disable scope mode from all of the following:
1. Mobile quick actions
2. Desktop quick actions/header actions
3. Settings sheet

The state MUST stay synchronized across all entry points.

## FR-3 — Scope lens placement and geometry

When scope mode is enabled, a circular lens MUST appear centered on the existing crosshair.

v1 geometry:
- center: exact stage center
- diameter: `clamp(min(viewport.width, viewport.height) * 0.58, 220, 320)` pixels
- radius: half the computed diameter
- border/chrome: visible
- subtle vignette: visible
- lens root: pointer-event blocker active
- focusable descendants: none

The lens MUST NOT be draggable or resizable in v1.

## FR-4 — Base view preservation

Outside the circular lens, the existing viewer MUST behave exactly as before:
- same wide background/video
- same wide object markers
- same label display mode
- same constellations
- same bottom dock/detail behavior

Scope mode MUST NOT replace the base scene.

## FR-5 — Lens interior occlusion and interaction shielding

Inside the circular lens:
- wide markers, wide labels, and wide constellation lines MUST be fully visually occluded by the lens rendering stack
- underlying wide markers inside the lens MUST NOT receive pointer events while scope mode is enabled
- the lens MUST NOT introduce any new keyboard focus stop

The user must never see or click both a wide object and a scope object in the same lens interior.

## FR-6 — Independent FOV systems

The implementation MUST model two independent FOVs:

1. **Base viewer FOV**
   - current wide-view projection
   - continues to drive the normal stage

2. **Scope FOV**
   - telescope-only projection
   - used only for the lens overlay

Changing scope FOV MUST NOT modify the base viewer FOV.  
Changing base viewer FOV MUST NOT modify scope FOV.

## FR-7 — Virtual telescope is the source of truth

The telescope overlay MUST be driven by the virtual telescope projection only.

This means:
- object positions inside the lens are computed from scope FOV, not CSS scaling of wide coordinates
- the telescope overlay MUST NOT depend on hardware camera zoom
- the camera image inside the lens may be visually magnified, but astronomy object placement MUST come from the virtual telescope model

## FR-8 — Lens camera/background presentation

When the live rear camera is active, the lens MUST show a magnified presentation of the same video feed, clipped to the circle.

The visual magnification factor MUST be derived from the ratio between base effective vertical FOV and scope vertical FOV:

`lensVisualScale = clamp(baseEffectiveVerticalFovDeg / scopeVerticalFovDeg, 1, 12)`

If the camera is unavailable, the lens MUST still render over the same stage background used by the current viewer mode.

## FR-9 — Lens object content

The lens MUST render:
- Sun
- Moon
- planets
- bright/named stars already represented by the existing wide bright-star layer
- deeper non-interactive scope stars from the scope dataset
- optional deep-star names, when the scope dataset provides them

Deep-star names, when available, MUST surface only through centered scope readout/detail behavior. They MUST NOT appear as free-floating labels inside the lens in v1.

The lens MUST NOT render in v1:
- constellations
- aircraft
- generic satellites
- ISS-specific lens behavior

## FR-10 — Interactive vs non-interactive scope content

Inside the lens:
- faint/deep stars are non-interactive canvas points
- named deep scope stars may surface their names through scope center-lock/detail when centered
- named deep scope stars are not directly clickable/tappable
- bright/named scope objects are **scope-eligible** only for center-lock and detail precedence
- no direct clicking/tapping inside the lens is supported in v1

Explicit object selection remains on the existing viewer interaction model outside the lens.

## FR-11 — Scope center-lock behavior

When scope mode is OFF:
- existing center-lock behavior remains unchanged

When scope mode is ON:
- center-lock source of truth becomes the scope-projected bright-object set plus named deep scope-star candidates
- precedence order is:
  1. explicit selected object
  2. bright scope object
  3. named deep scope star
  4. none
- explicit selected object state still overrides center-lock in detail panels
- if a named deep scope star wins center-lock, the centered readout/detail MUST show:
  - label = the available deep-star name
  - type = `Star`
  - magnitude = the deep-star display magnitude
- if no bright scope-eligible object or named deep scope star is within the center-lock region, no scope center-lock target is selected

Unnamed deep scope stars MUST NOT become selectable or named center-lock candidates in v1.

## FR-12 — Scope depth bands

The scope overlay MUST support these discrete maximum-magnitude bands:
- 6.5
- 8.0
- 9.5
- 10.5

These bands are implementation-facing and MUST exist in the dataset manifest.

## FR-13 — Adaptive depth policy

The runtime MUST select the active depth band using this exact policy:

- if `scopeVerticalFovDeg > 15`: band `6.5`
- else if `scopeVerticalFovDeg > 10`: band `8.0`
- else if `scopeVerticalFovDeg > 5`: band `9.5`
- else:
  - use band `10.5` only if all of the following are true:
    - viewer camera pose mode is `sensor`
    - route orientation status is `granted`
    - latest orientation sample exists
    - latest orientation sample age is `<= 300 ms`
    - current camera pose alignment health is `good`
  - otherwise use band `9.5`

No user setting may bypass this rule in v1.

## FR-14 — Daylight gating and `likelyVisibleOnly`

The scope overlay MUST obey the existing `likelyVisibleOnly` daylight behavior.

Exact rule:
- if `likelyVisibleOnly` is `true` and `sunAltitudeDeg > -6`, deep scope stars MUST be suppressed
- if `likelyVisibleOnly` is `true` and `sunAltitudeDeg > -6`, bright scope objects of type `star` MUST also be suppressed
- Sun, Moon, and planets continue to follow the existing wide-scene celestial behavior

Scope mode MUST NOT introduce a second daylight policy independent from the current viewer policy.

## FR-15 — Scope settings persistence

The following scope settings MUST be persisted through the existing viewer-settings path:

- `scope.enabled` (boolean)
- `scope.verticalFovDeg` (number)

Defaults:
- `enabled = false`
- `verticalFovDeg = 10`

Allowed range:
- minimum `3`
- maximum `20`
- step `0.5`

## FR-16 — Settings UI

The settings sheet MUST expose:
- a scope mode toggle
- a scope FOV range control

The UI MUST NOT expose:
- hardware zoom
- lens radius
- lens position
- deep-band override
- direct click mode for scope objects

## FR-17 — Scope mode in demo and fallback modes

Scope mode MUST work in:
- demo mode
- non-camera fallback
- manual-pan fallback

In these modes, the astronomy overlay remains the source of truth and the lens still renders a scope projection.

## FR-18 — Dataset loader behavior

The scope dataset loader MUST:
- fetch static assets from `/data/scope/v1/...`
- lazy-load the manifest on first scope enable
- cache the manifest for the session lifetime
- cache decoded tiles in memory
- request only the tiles required for the current band and current lens pointing
- ignore or discard stale tile responses after band/pointing/toggle changes
- degrade gracefully if a tile fetch or decode fails

If scope dataset assets are unavailable:
- the app MUST keep running
- the lens MUST still render magnified camera/background and scope bright objects
- the app MUST NOT crash or block viewer startup

## FR-19 — Development dataset requirement

If a full production source catalog is not present in the repository, the implementation MUST still ship a committed development dataset under `/public/data/scope/v1/` that exercises the full runtime path.

This development dataset MUST:
- use the exact same manifest and tile schema as production
- contain stars deeper than the existing wide bright-star layer
- guarantee that at least one scope band deeper than 6.5 visibly adds stars compared with the wide scene
- be sufficient for unit tests, Playwright tests, and manual verification

The development dataset MUST be generated deterministically with this exact fallback recipe if no production catalog input is present:

### Required deterministic fallback recipe
Source: `public/data/stars_200.json`

For each source star entry:
- do **not** copy the named source star into deep scope tiles
- generate exactly 6 synthetic scope stars
- if the source star has a non-empty name, exactly one synthetic deep scope star MUST carry that name deterministically
- use these fixed offset pairs in degrees, indexed `0..5`:

```text
[(+0.08,+0.03), (-0.09,+0.05), (+0.04,-0.11), (-0.05,-0.08), (+0.12,-0.02), (-0.13,+0.01)]
```

- use these fixed magnitudes:

```text
[6.8, 7.6, 8.4, 9.2, 10.0, 10.5]
```

- set `pmRaMasPerYear = 0`
- set `pmDecMasPerYear = 0`
- set `bMinusV = 0`
- wrap RA into `[0, 360)`
- clamp Dec to `[-89.9, +89.9]`

A production dataset MUST be swappable later without code changes.

## FR-20 — Dataset versioning

The dataset path MUST be versioned under `/data/scope/v1/`.

A future dataset revision MUST be introducible by changing the path and manifest version without changing the runtime loader interface.

## FR-21 — Performance and responsiveness

The implementation MUST preserve the current scene-clock model.

Additional scope requirements:
- enabling/disabling scope mode MUST NOT visibly freeze the UI
- scope rendering MUST run on the same scene update cadence used by the current viewer mode
- canvas star rendering MUST be limited to stars from currently loaded tiles only
- no full-catalog in-memory load is allowed in normal runtime

## FR-22 — Accessibility and focus behavior

Scope mode MUST NOT break current keyboard, focus-restore, settings-sheet, or overlay-trap behavior.

The lens itself is display-only in v1 and MUST NOT add a new keyboard focus stop.

## FR-23 — Alignment interaction rule

During explicit mobile alignment focus mode, the scope overlay MUST NOT render.

Reason: alignment focus already uses the center area as a special interaction mode and the scope lens would create conflicting visual guidance.

---

## 8. Dataset requirements

## 8.1 Runtime dataset format

The scope dataset MUST be static and manifest-driven.

The manifest MUST describe:
- schema version
- dataset kind (`dev` or `prod`)
- supported magnitude bands
- positional tile configuration for each band
- file naming/path template
- binary row format version

Each tile file MUST contain fixed-size binary rows.

## 8.2 Required per-row fields

Each scope star record MUST contain:
- right ascension
- declination
- proper motion in RA
- proper motion in Dec
- display magnitude
- color term
- optional name reference

Deep-scope-star names, when available, MUST be retrievable through the optional name reference. Unnamed stars MUST use the unnamed sentinel.

## 8.3 Coordinate epoch

The runtime dataset epoch MUST be **J2000 / EQJ**.

If proper-motion fields are missing in fallback generation, they MUST be normalized to zero.

---

## 9. UX requirements

## 9.1 Visual design

The lens MUST visually read as a telescope/scope overlay.

Required:
- circular chrome/ring
- clipped interior
- subtle vignette or edge darkening
- independent scope star field inside lens

Optional:
- mild edge glow
- faint glass highlight

Not allowed in v1:
- extreme blur
- fake distortion that changes astronomy alignment
- simulated image inversion or mirror flip

## 9.2 Quick actions

Mobile quick actions MUST include a scope toggle when the viewer is active.  
Desktop actions MUST include a scope toggle when the viewer is active.

Behavior:
- off -> turns scope mode on
- on -> turns scope mode off

## 9.3 Detail behavior

When scope mode is enabled:
- detail panels continue to work
- explicit selection still wins over center-lock
- center-lock uses scope bright-object projection plus named deep scope stars when available
- if a named deep scope star wins center-lock, the centered readout/detail MUST show that name
- direct clicking inside the lens is still unsupported

---

## 10. Acceptance criteria

Implementation is complete only when all of the following are true:

1. Scope mode can be toggled from mobile actions, desktop actions, and settings.
2. The lens is centered, circular, fixed, and clipped.
3. The lens uses an FOV independent from the base viewer FOV.
4. The lens shows deeper stars than the wide scene.
5. Wide markers/labels/constellations are not visible or clickable inside the lens.
6. Dense scope stars are canvas-only and non-directly-interactive.
7. Bright scope objects and named deep scope stars can drive scope center-lock/detail but are not directly clickable inside the lens.
8. If a deep scope star has a name and wins scope center-lock, the centered scope readout shows that name.
9. Scope mode works in demo, non-camera, and manual-pan fallback modes.
10. Scope mode is hidden during explicit mobile alignment focus.
11. If scope tiles fail to load, the viewer still works and the lens still shows magnified background plus bright scope objects.
12. A committed development dataset exists and exercises deeper-than-wide rendering, including at least one named deep scope-star path.
13. No hardware zoom code, WebGL code, or WebGPU code is added.

---

# SkyLensServerless Telescope Scope Overlay — Architecture and Requirements Design (ARD)

Version: 1.1  
Status: Approved for implementation  
Audience: Autonomous coding agent with access to the current SkyLensServerless codebase  
Normative language: MUST, MUST NOT, SHOULD, MAY are binding.

---

## 1. Purpose

This document defines the exact implementation architecture for the scope-overlay feature described in the PRD.

It is intended to be sufficient for a coding agent to modify the current SkyLensServerless codebase without follow-up clarification.

---

## 2. Current codebase analysis

## 2.1 Current viewer responsibilities

The current implementation centers almost all runtime viewer behavior in:
- `components/viewer/viewer-shell.tsx`

That file currently owns:
- startup gating and route-state transitions
- camera lifecycle
- observer lifecycle
- orientation lifecycle
- scene time updates
- object projection into screen coordinates
- selection, hover, center-lock, detail panels
- overlay UI, banners, mobile/desktop controls, alignment flows

Therefore the scope feature MUST integrate with `ViewerShell`, but the new rendering logic MUST be extracted enough to avoid making `ViewerShell` even more monolithic.

## 2.2 Current projection seam

The current projection logic lives in:
- `lib/projection/camera.ts`

This is the correct seam for the scope feature because object projection already flows through:
- `projectWorldPointToScreen(...)`
- `projectWorldPointToImagePlane(...)`
- `getEffectiveVerticalFovDeg(...)`
- `getHorizontalFovDeg(...)`

The current limitation is architectural: the file assumes a single wide-view FOV model with a small adjustment range. That is sufficient for the wide viewer and insufficient for a virtual telescope.

## 2.3 Current astronomy layers

The current astronomy split is:
- `lib/astronomy/celestial.ts`
- `lib/astronomy/stars.ts`
- `lib/astronomy/constellations.ts`
- moving object logic in `lib/viewer/motion.ts`

The existing star pipeline is intentionally small and DOM-friendly:
- bundled bright catalog
- per-star horizon normalization
- marker/label path

That path MUST remain the wide-view bright-label layer and MUST NOT be repurposed as the deep scope-star renderer.

## 2.4 Current settings seam

Viewer settings are normalized and persisted in:
- `lib/viewer/settings.ts`

Settings UI lives in:
- `components/settings/settings-sheet.tsx`

This is the correct persistence seam for scope settings.

## 2.5 Current deployment seam

The repo is already configured for static export and static serving:
- `next.config.ts` uses `output: 'export'`
- `scripts/serve-export.mjs` previews static output
- static assets under `public/` are already a first-class pattern

Therefore the scope dataset MUST be implemented as static assets and MUST NOT introduce a server dependency.

---

## 3. Design principles

1. **Do not rewrite the whole renderer.**
2. **Add a second projection system, not a zoom hack.**
3. **Keep the wide scene outside the lens unchanged.**
4. **Use Canvas 2D only where dense star count makes DOM a bad fit.**
5. **Keep all current accessibility/focus semantics intact.**
6. **Keep the implementation static-host friendly.**
7. **Make the dataset pluggable and versioned.**
8. **Block click-through inside the lens.**
9. **Keep direct object selection outside the lens in v1.**

---

## 4. Chosen architecture

## 4.1 High-level architecture

The chosen implementation is a **hybrid two-layer renderer**.

### Wide layer
Keep the existing viewer architecture for the wide scene:
- live or fallback background/video
- DOM/SVG markers
- SVG constellation lines
- label layout
- current selection and detail behavior

### Scope layer
Add a new centered overlay made of four sublayers:

1. **Lens interaction shield / occlusion disc**
   - clipped circle
   - blocks pointer-through
   - ensures wide markers/labels/constellations are visually and interactively suppressed inside the lens

2. **Lens video/background layer**
   - clipped circle
   - visually magnified
   - driven by the base camera/background

3. **Lens dense-star canvas**
   - Canvas 2D
   - deep scope stars only
   - non-interactive
   - optional names are resolved out-of-band for centered readout only

4. **Lens bright-object overlay**
   - scope-projected Sun/Moon/planets/bright stars
   - used for scope center-lock and detail precedence only
   - non-clickable in v1

This preserves the repo’s DOM-first interaction model while solving the only local performance problem: dense faint stars in the lens.

## 4.2 Scope interaction model

Direct interaction inside the lens is not supported in v1.

Rules:
- the lens root MUST intercept pointer events
- the lens MUST have no focusable descendants
- underlying wide markers inside the circle MUST NOT receive pointer events
- scope bright objects contribute to center-lock/detail only
- named deep scope stars may contribute to centered readout/detail only when `displayName` exists
- explicit `selectedObjectId` remains driven by the existing viewer interaction model outside the lens

---

## 5. Rejected alternatives

## 5.1 Rejected: CSS-scaling existing markers inside a circle
Rejected because telescope projection must be independent of the wide-view projection.

## 5.2 Rejected: full WebGL/WebGPU rewrite of the viewer
Rejected because the repo is heavily DOM/SVG, accessibility, and test oriented, and the new high-density problem is local to the lens deep-star layer.

## 5.3 Rejected: hardware camera zoom
Rejected because the product decision is locked and the source of truth must remain the virtual telescope projection.

## 5.4 Rejected: introducing a HEALPix runtime dependency in v1
Rejected because a regular RA/Dec positional tile grid is simpler for an autonomous agent to implement in the current repo while still satisfying the magnitude+position sharding requirement.

---

## 6. Required file-level changes

The coding agent MUST create or modify the following files.

### New files

#### `lib/scope/contracts.ts`
Must define:
- manifest types
- names-table types
- decoded scope-star row type
- load state/result types

#### `lib/scope/depth.ts`
Must define:
- scope FOV clamp helpers
- adaptive magnitude-band selection logic
- lens geometry helpers if not placed elsewhere

#### `lib/scope/catalog.ts`
Must define:
- manifest loader
- names-table loader
- tile URL resolution
- tile fetch/decode
- in-memory cache
- stale-request protection helpers

#### `lib/scope/position-tiles.ts`
Must define:
- positional tile indexing
- RA wraparound handling
- bounds intersection helpers

#### `components/viewer/scope-star-canvas.tsx`
Must render:
- deep scope stars only
- Canvas 2D only
- no interactivity

#### `components/viewer/scope-lens-overlay.tsx`
Must compose:
- interaction shield / occlusion disc
- magnified camera/background layer
- scope star canvas
- bright-object overlay
- ring/chrome/vignette

#### `scripts/build-scope-dataset.mjs`
Must build:
- `public/data/scope/v1/manifest.json`
- positional binary tiles for all bands
- deterministic fallback development dataset if no production source exists

### Files to modify

#### `lib/projection/camera.ts`
Add profile-based projection helpers.

#### `lib/viewer/settings.ts`
Add persisted scope settings and normalization.

#### `components/settings/settings-sheet.tsx`
Add scope controls.

#### `components/viewer/viewer-shell.tsx`
Integrate:
- scope state
- scope rendering
- scope center-lock
- tile loading
- daylight gating
- new controls

#### Tests
Add and extend tests described in section 17.

---

## 7. Required interfaces

## 7.1 Projection profile

Add this interface to `lib/projection/camera.ts` or a nearby shared type location:

```ts
export interface ProjectionProfile {
  verticalFovDeg: number
  overscanRatio?: number
}
```

Add new helpers:

```ts
export function projectWorldPointToScreenWithProfile(
  pose: Pick<CameraPose, 'quaternion'>,
  worldPoint: ProjectWorldPointInput,
  viewport: ProjectViewport,
  profile: ProjectionProfile,
): ProjectedWorldPoint

export function projectWorldPointToImagePlaneWithProfile(
  pose: Pick<CameraPose, 'quaternion'>,
  worldPoint: ProjectWorldPointInput,
  frame: Pick<CameraFrameLayout, 'sourceWidth' | 'sourceHeight'>,
  profile: ProjectionProfile,
): ProjectedImagePlanePoint
```

Requirements:
- existing wide-view helpers MAY remain and delegate internally
- all scope rendering MUST use the profile-based helpers
- no scope code may rely on the old vertical-adjustment-only path

## 7.2 Scope settings

Extend viewer settings with:

```ts
export interface ScopeSettings {
  enabled: boolean
  verticalFovDeg: number
}
```

Embed in `ViewerSettings` as:

```ts
scope: ScopeSettings
```

Defaults:

```ts
scope: {
  enabled: false,
  verticalFovDeg: 10,
}
```

Normalization:
- `enabled` boolean
- `verticalFovDeg` clamped to `[3, 20]`

## 7.3 Manifest schema

Implement the manifest schema exactly as follows:

```ts
export interface ScopeBandManifest {
  maxMagnitude: 6.5 | 8.0 | 9.5 | 10.5
  raStepDeg: number
  decStepDeg: number
  pathTemplate: string
}

export interface ScopeCatalogManifest {
  version: 1
  kind: 'dev' | 'prod'
  epoch: 'J2000'
  rowFormat: 'scope-star-v2-le'
  namesPath: string
  bands: ScopeBandManifest[]
}
```

`pathTemplate` MUST support placeholders:
- `{band}`
- `{raIndex}`
- `{decIndex}`

Example path output:
- `/data/scope/v1/mag9p5/r3_d4.bin`

## 7.4 Runtime decoded scope star

Use this decoded shape:

```ts
export interface ScopeStar {
  raDeg: number
  decDeg: number
  pmRaMasPerYear: number
  pmDecMasPerYear: number
  vMag: number
  bMinusV: number
  nameId: number
  displayName?: string
}
```

Rules:
- `nameId = 0` means unnamed
- `displayName` is populated only after resolving `nameId` through the manifest-declared names table
- named deep scope stars remain canvas-rendered and non-clickable

---

## 8. Dataset format and build pipeline

## 8.1 Binary row format

Every tile MUST use fixed 20-byte little-endian rows in this exact order:

1. `uint32 raMicroDeg`
2. `int32 decMicroDeg`
3. `int16 pmRaMasPerYear`
4. `int16 pmDecMasPerYear`
5. `int16 vMagMilli`
6. `int16 bMinusVMilli`
7. `uint32 nameId`

Decode rules:
- `raDeg = raMicroDeg / 1_000_000`
- `decDeg = decMicroDeg / 1_000_000`
- `vMag = vMagMilli / 1000`
- `bMinusV = bMinusVMilli / 1000`
- `nameId = 0` means unnamed

## 8.2 Name table format

The manifest-declared `namesPath` MUST resolve to a UTF-8 JSON file with this exact shape:

```ts
export type ScopeNameTable = Record<string, string>
```

Rules:
- keys are positive integer `nameId` values serialized as strings
- `0` is reserved and MUST NOT appear in the table
- values are display names exactly as they should appear in scope centered readout/detail
- if no names are available, the file MUST still exist and MAY be `{}`

## 8.3 Build modes

The dataset builder MUST support two modes.

### Production mode
Input: external source catalog if present in the repo or otherwise made available during implementation.

Expected source fields:
- RA
- Dec
- proper motion RA
- proper motion Dec
- display magnitude or convertible magnitudes
- color term or convertible magnitudes
- optional display name when available

Output:
- `public/data/scope/v1/manifest.json`
- `public/data/scope/v1/names.json`
- positional tile binaries for all supported bands

### Development mode
If no production source catalog is present, the builder MUST still produce a committed runtime dataset.

Source in this case:
- `public/data/stars_200.json`

The resulting development dataset MUST still use the exact same manifest, names-table, and tile schema.

## 8.4 Required deterministic development fallback

If no production source catalog is present, the coding agent MUST implement this exact deterministic fallback:

### Constants

```ts
const DEV_SYNTHETIC_OFFSETS_DEG: ReadonlyArray<readonly [number, number]> = [
  [ 0.08,  0.03],
  [-0.09,  0.05],
  [ 0.04, -0.11],
  [-0.05, -0.08],
  [ 0.12, -0.02],
  [-0.13,  0.01],
]

const DEV_SYNTHETIC_MAGS: ReadonlyArray<number> = [
  6.8, 7.6, 8.4, 9.2, 10.0, 10.5,
]
```

### Rules

For every source star in `public/data/stars_200.json`:
- do **not** emit the original named star into scope deep tiles
- emit exactly 6 synthetic stars, one per offset/magnitude index
- `raDeg = wrap360(source.raDeg + offsetRaDeg)`
- `decDeg = clamp(source.decDeg + offsetDecDeg, -89.9, 89.9)`
- `pmRaMasPerYear = 0`
- `pmDecMasPerYear = 0`
- `vMag = DEV_SYNTHETIC_MAGS[index]`
- `bMinusV = 0`
- `nameId = 0` for every synthetic row **except** index `5`
- if `index === 5` and `source.name` is a non-empty string, allocate a deterministic positive `nameId` and store `source.name` in the names table for that id

This fallback is required so the scope tiles are visibly deeper than the wide bright-star layer and so the named-deep-star centered-readout path is exercised deterministically.

## 8.5 Required tile-band grids

The builder MUST produce these band grids:

| Band | raStepDeg | decStepDeg |
|---|---:|---:|
| 6.5 | 90 | 45 |
| 8.0 | 45 | 30 |
| 9.5 | 22.5 | 22.5 |
| 10.5 | 11.25 | 11.25 |

## 8.6 Tile id computation

Given normalized RA/Dec:

```ts
const normalizedRaDeg = ((raDeg % 360) + 360) % 360
const raIndex = Math.floor(normalizedRaDeg / raStepDeg)
const decIndex = Math.floor((decDeg + 90) / decStepDeg)
```

Filename:

```ts
`r${raIndex}_d${decIndex}.bin`
```

The builder MUST clamp `decIndex` to a valid range.

---

## 9. Runtime tile loading and selection

## 9.1 Scope center

The lens always points at the camera center.

Therefore the current scope center horizontal coordinates are:
- `azimuthDeg = cameraPose.yawDeg`
- `elevationDeg = cameraPose.pitchDeg`

## 9.2 Tile selection radius

To decide which tiles to load, compute:

```ts
const verticalFovDeg = scopeProfile.verticalFovDeg
const horizontalFovDeg = getHorizontalFovDeg(
  verticalFovDeg,
  viewport.width / viewport.height,
)
const halfDiagonalDeg =
  Math.sqrt(verticalFovDeg * verticalFovDeg + horizontalFovDeg * horizontalFovDeg) / 2
const selectionRadiusDeg = halfDiagonalDeg + 1
```

Use `selectionRadiusDeg` to select all tiles whose RA/Dec bounds intersect the padded view bounds.

## 9.3 Manifest and tile cache lifecycle

`lib/scope/catalog.ts` MUST:
- lazy-load the manifest when scope mode first becomes enabled
- cache the manifest for the session lifetime
- cache decoded tiles in memory, keyed by band + tile id
- track the latest tile-load generation or request token
- ignore stale tile responses after:
  - scope disabled
  - scope FOV band changed
  - lens pointing changed enough to select a different tile set

The implementation MAY use `AbortController`, but stale-response ignoring is required even if abort is not used.

---

## 10. Coordinate transformation rules

## 10.1 Dataset coordinate system

Tiles store stars in **EQJ / J2000**.

## 10.2 Proper motion rule

The runtime MUST support proper motion linearly when the tile fields are non-zero.

Required rule:

```ts
const yearsFromJ2000 = observationJulianYear - 2000.0
const adjustedRaDeg = raDeg + (pmRaMasPerYear / 1000 / 3600) * yearsFromJ2000
const adjustedDecDeg = decDeg + (pmDecMasPerYear / 1000 / 3600) * yearsFromJ2000
```

If PM fields are zero, the adjustment is a no-op.

## 10.3 Required transform path

Preferred path:
- use the installed `astronomy-engine` package
- use `Rotation_EQJ_HOR` plus vector rotation if those functions are exported by the installed package version
- derive altitude/azimuth from the rotated horizontal vector

Fallback path if the preferred low-level helpers are not exported in the installed JS package:
- encapsulate the transform behind a scope-coordinate utility
- use the same package’s `Horizon(...)` path per star after converting RA degrees to RA hours, matching the current repo’s style in `lib/astronomy/stars.ts`

The coding agent MUST NOT introduce a second astronomy library for this conversion.

---

## 11. Lens rendering pipeline

## 11.1 Render order

When scope mode is enabled, the render order MUST be:

1. existing base background/video stage
2. existing wide markers/labels/constellations
3. lens occlusion/interceptor layer, clipped to circle
4. lens video/background layer, clipped to circle
5. scope star canvas, clipped to circle
6. scope bright-object overlay, clipped to circle
7. lens ring/chrome/vignette

This order is required so wide markers are not visible or clickable inside the lens.

## 11.2 Pointer behavior

The lens overlay root MUST use pointer-event interception so underlying wide markers inside the circle do not receive pointer events.

The lens overlay MUST NOT add any focusable descendants.

## 11.3 Lens video/background layer

When camera is active:
- reuse the same video source
- clip to the circular lens
- apply a scale derived from base-vs-scope FOV ratio
- center the transform on the stage center

When camera is inactive:
- render no special video sublayer
- allow the lens background plus star canvas and bright overlay to render over the current stage background

## 11.4 Scope star canvas

Responsibilities:
- receive decoded scope stars from active tiles only
- apply PM adjustment when fields are non-zero
- convert to current horizontal coordinates
- obey `likelyVisibleOnly` daylight gating
- frustum-cull to the scope profile
- draw points to Canvas 2D only

Rendering rules:
- unnamed deep stars are points only
- named deep stars are still points only in the canvas layer
- size derived from magnitude
- color tint may be derived from `bMinusV`
- no free-floating text labels
- no pointer events

## 11.5 Scope bright-object overlay

The scope bright-object overlay MUST be driven from the existing scene object inventory, not from deep tiles.

Input object set:
- Sun
- Moon
- planets
- bright/named stars from the existing wide bright-star layer

Rules:
- project with `scopeProfile`
- clip visually to the lens
- obey the same daylight suppression behavior already used by the current scene model
- use this set as the first-priority scope center-lock pool
- do not attach direct pointer handlers in v1

---

## 12. Scope center-lock and detail behavior

## 12.1 Scope center-lock source

When scope mode is enabled, compute a separate center-lock candidate from:
1. scope-projected bright objects
2. named deep scope stars with `displayName`

Rules:
- reuse the current ranking logic where practical
- bright scope objects outrank named deep scope stars
- named deep scope stars are eligible only when `displayName` exists
- unnamed deep canvas stars are excluded from center-lock naming

## 12.2 Detail precedence

The precedence order MUST be:

1. explicit `selectedObjectId`
2. scope bright-object center-lock object when scope mode is enabled
3. named deep scope-star center candidate when scope mode is enabled
4. wide center-lock object when scope mode is disabled
5. hover-only summary behavior where the current UI already supports it

## 12.3 Named deep-star centered readout contract

If a named deep scope star wins the scope center candidate:
- the centered chip/readout title MUST be `displayName`
- the type MUST resolve as `Star`
- the readout/detail rows MUST include magnitude from `vMag`
- the readout MUST NOT imply clickability or selection
- the star MUST remain canvas-rendered and pointer-inert

---

## 13. ViewerShell integration requirements

## 13.1 New state/derived state

`ViewerShell` MUST add the minimum state required for the feature, including:

- `scopeProfile`
- `scopeManifestLoadState`
- `scopeNameTableLoadState`
- `scopeTileLoadState`
- `scopeDecodedStars`
- `scopeCenterLockedObjectId` or equivalent derived object
- `scopeNamedCenterCandidate` or equivalent derived object
- `scopeLensDiameterPx`

The implementation SHOULD prefer derived state and memoized selectors over storing redundant arrays.

## 13.2 Required behavioral integrations

`ViewerShell` MUST:
- expose scope toggle actions
- expose scope FOV control persistence
- hide the scope lens during explicit mobile alignment focus mode
- keep scope working in demo/manual/non-camera modes
- keep wide-view behavior intact outside the lens
- keep selection model intact outside the lens
- ensure lens click shielding prevents underlying wide-object clicks inside the circle

---

## 14. Settings integration

## 14.1 `lib/viewer/settings.ts`

Required changes:
- extend schema
- keep backward compatibility with existing saved payloads
- normalize missing scope fields to defaults

## 14.2 `components/settings/settings-sheet.tsx`

Required controls:
- scope enable toggle
- scope FOV range input

The settings sheet MUST NOT own any scope business logic beyond invoking callbacks.

---

## 15. Deployment note for Render static hosting

The runtime MUST NOT depend on any deployment-specific code beyond static files existing under `public/data/scope/v1`.

Optional optimization:
- if the repo uses `render.yaml` / Blueprint deployment, the agent MAY add long-lived cache headers for `/data/scope/v1/*`
- if no Blueprint file exists, implementation MUST still work without it

---

## 16. Why Canvas 2D and not WebGL/WebGPU in v1

The codebase is currently optimized around:
- DOM/SVG overlays
- button-based accessibility
- keyboard/focus restoration
- snapshotable unit tests and Playwright tests

The new high-density problem exists only inside the lens for faint stars. Therefore the correct scope of change is:
- keep the current wide DOM/SVG renderer
- use Canvas 2D only for the dense faint-star subset in the lens

This is the required v1 architecture.

The implementation MUST NOT add a WebGL or WebGPU dependency.

However, `ScopeStarCanvas` MUST be structured so its internal renderer can be replaced later without changing `ViewerShell`, the settings interface, or the manifest/tile loader interface.

---

## 17. Testing plan

## 17.1 Unit tests to add

### `tests/unit/scope-depth.test.ts`
Validate:
- band thresholds
- deep-band gating logic
- scope FOV clamping

### `tests/unit/scope-catalog.test.ts`
Validate:
- manifest parsing
- names-table parsing
- tile key resolution
- binary decode
- `nameId` to `displayName` resolution
- cache reuse
- stale-response ignoring
- graceful failure paths

### `tests/unit/scope-position-tiles.test.ts`
Validate:
- RA normalization
- tile id assignment
- tile intersection logic
- RA wraparound near 0/360

### `tests/unit/scope-dev-dataset.test.ts`
Validate:
- deterministic dev dataset generation
- deep dataset contains more rows than the wide bright-star layer
- every configured band has at least one tile
- at least one deterministic fallback deep star carries a name when source names exist
- all fallback PM values are zero
- all fallback `bMinusV` values are zero

### `tests/unit/scope-lens-overlay.test.tsx`
Validate:
- lens appears/disappears
- lens diameter rule
- scope projection differs from wide projection
- alignment focus suppresses the lens
- lens blocks click-through inside the circle
- wide labels/constellation visuals are occluded inside the circle
- named deep scope star can surface through centered readout/detail without becoming clickable

## 17.2 Existing tests to extend

Extend viewer-shell tests to cover:
- settings persistence for scope mode
- mobile quick-action toggle
- desktop scope toggle
- scope behavior in demo mode
- scope behavior without camera
- scope center-lock precedence over wide center-lock when enabled

## 17.3 E2E tests to add

### `tests/e2e/scope-mode.spec.ts`
Cover:
- enable scope in demo mode
- enable scope in live non-camera fallback
- scope settings persist across reload
- lens hidden during explicit alignment focus
- no click-through on markers under the lens

---

## 18. Implementation sequence

The coding agent MUST implement in this order.

## Phase 1 — Projection refactor

1. Add `ProjectionProfile`
2. Add profile-based projection helpers
3. Preserve existing wide behavior through wrappers
4. Add unit tests for projection-profile correctness

## Phase 2 — Settings and control surfaces

1. Extend viewer settings with scope settings
2. Add settings UI controls
3. Add mobile and desktop scope toggles
4. Add tests for settings persistence and controls

## Phase 3 — Lens shell without deep dataset

1. Add `ScopeLensOverlay`
2. Add lens geometry and ring/chrome
3. Add occlusion/interceptor layer
4. Add lens-local video/background magnification layer
5. Add scope projection pass for existing bright objects only
6. Add scope center-lock switching
7. Verify behavior in demo and non-camera fallback modes

## Phase 4 — Dataset system

1. Add manifest schema and loader
2. Add binary tile decoder
3. Add position-tile selector
4. Add build script
5. Commit a development dataset under `/public/data/scope/v1/`
6. Add tests for decode, cache, selection, and dev fallback generation

## Phase 5 — Dense scope canvas

1. Add `ScopeStarCanvas`
2. Draw faint stars from currently loaded tiles only
3. Add adaptive band selection
4. Add deep-band gating logic
5. Add likely-visible daylight gating
6. Add tests for render state and failure handling

## Phase 6 — Final polish

1. Ensure alignment focus hides the lens
2. Ensure no scope regressions in manual/demo/live modes
3. Ensure no hardware zoom code was added
4. Ensure no WebGL/WebGPU code was added
5. Ensure all tests pass

---

## 19. Required code-level decisions

The coding agent MUST follow these decisions exactly.

1. Scope lens is centered and fixed in v1.
2. Scope lens blocks click-through and has no focusable descendants.
3. Scope lens supports no direct pointer interaction in v1.
4. Wide view remains DOM/SVG-driven.
5. Faint scope stars use Canvas 2D.
6. Scope bright objects are derived from existing scene objects.
7. Named deep scope stars may surface names through centered readout/detail only when `displayName` exists.
8. Scope dataset uses manifest + binary positional tiles plus a manifest-declared names table.
9. Scope dataset path is `/data/scope/v1/`.
10. A committed development dataset MUST exist if no production source is available.
11. The development dataset MUST be deeper than the existing wide bright-star layer.
12. No hardware camera zoom code is added.
13. No WebGL/WebGPU code is added.

---

## 20. Completion checklist

Implementation is complete only when all items below are true.

- [ ] Projection profile API exists and is covered by tests
- [ ] Scope settings persist and normalize correctly
- [ ] Scope controls exist in mobile, desktop, and settings UI
- [ ] Scope lens renders centered and clipped
- [ ] Base view remains unchanged outside the lens
- [ ] Wide markers/labels/constellations are not visible or clickable inside the lens
- [ ] Scope projection is independent from base projection
- [ ] Deep stars render in canvas only inside the lens
- [ ] Bright scope objects drive first-priority scope center-lock
- [ ] Named deep scope stars can surface names through centered readout/detail when available
- [ ] No direct clicking inside the lens is supported
- [ ] Scope works in demo and fallback modes
- [ ] Scope obeys `likelyVisibleOnly` daylight gating
- [ ] Scope is hidden during explicit alignment focus mode
- [ ] A deterministic committed dev dataset exists if no production source is available
- [ ] The dev dataset is deeper than the wide bright-star layer and exercises at least one named deep-star path
- [ ] No hardware zoom code exists
- [ ] No WebGL/WebGPU code exists
