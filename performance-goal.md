# Codex goal: restore SkyLens desktop Chrome responsiveness

## Objective

Fully diagnose, fix, verify, and deploy the SkyLens production performance regression that makes the desktop viewer freeze or appear to ignore navigation and controls in Google Chrome. Work from the canonical repository root. This is an implementation goal, not another audit: make the necessary architectural changes, add durable performance coverage, preserve the existing permission and viewer behavior, and continue until the acceptance criteria below pass.

Production URL: `https://skylens-serverless-static.onrender.com`

Do not stop after changing defaults, clearing local storage, reducing visual quality, or making a single click work in a clean profile. Existing Chrome profiles with persisted settings, slower CPUs, power-saving conditions, and worst-case supported viewer states must remain responsive.

## Verified baseline and diagnosis

Reproduce the measurements before editing so the final result has a comparable before/after record. The July 10 production investigation found:

| Production desktop state | Stable Chrome renderer main-thread time |
| --- | ---: |
| High motion + deep stars | 42.7% |
| Balanced motion + deep stars (default) | 29.7% |
| Low motion + deep stars | 4.3% |

Under 4x CPU throttling, Balanced + deep stars consumed about 84% of the renderer main thread; Settings took up to 885 ms to respond. Controlled throttled comparisons measured approximately:

| State | Renderer main-thread time |
| --- | ---: |
| Balanced + deep stars | 83.8% |
| Low + deep stars | 13.9% |
| Balanced + no deep stars | 41.4% |
| Low + no deep stars | 5.3% |

Routing, Render, and production data delivery were healthy during the reproduction: direct routes returned 200, landing links navigated, R2 requests completed, and Chrome reported no page or console errors. The apparent navigation failure is main-thread starvation plus the lack of an explicit in-view Home/Back action.

The current hot path is known:

- `components/viewer/viewer-shell.tsx` commits `sceneTimeMs` through React at 15 Hz in Balanced and 30 Hz in High.
- The entire `ViewerShell` function and both responsive shell trees are reconciled on those updates.
- `buildSceneSnapshot()` synchronously recomputes celestial, satellite, aircraft, and bundled-star astronomy during render.
- Deep-star proper motion, equatorial-to-horizontal conversion, projection, filtering, ranking, label candidates, and canvas point arrays are invalidated by every `sceneTimeMs` update.
- `StarPointCanvas` clears and redraws whenever the newly allocated points array changes.
- Desktop and compact shells are both rendered; CSS only hides the inactive one.
- The `skylens-serverless.viewer-settings.v1` record preserves expensive legacy combinations such as High motion, Scope, deep stars, and label modes across deployments. There is no performance-safe migration or adaptive runtime governor.

Treat these findings as the starting hypothesis, not permission to patch blindly. Re-profile after each material change and retain evidence that the identified causes were actually removed.

## Non-negotiable constraints

1. Preserve astronomy correctness, object selection, alignment, scope optics, canvas visuals, accessibility, demo determinism, and the current camera/motion/location lifecycle.
2. Preserve the production scope dataset and local development fallback. Do not solve CPU pressure by repeatedly fetching fewer-but-incomplete data or silently dropping requested objects.
3. Camera frames, raw sensor readings, and precise location remain private under the existing contracts. Performance diagnostics must not record them.
4. Reduced-motion behavior must remain meaningful and must not be used as the only path to an operable viewer.
5. Keep React state for semantic application state. Do not drive the full React tree from a video-frame, animation-frame, or high-rate sensor clock.
6. Do not permanently remove Scope, deep stars, labels, satellites, or aircraft. If a temporary safe default is required, retain an explicit opt-in and finish the underlying architecture before declaring the goal complete.
7. Do not mask performance failures by weakening tests, using arbitrary sleeps, ignoring long tasks, blanket memoization without stable inputs, or suppressing errors.

## Required work

### Phase 1 — Add a reproducible performance and navigation harness

1. Add a production-build Playwright/CDP diagnostic that can run against the local static export and an explicitly supplied live URL. Prefer installed stable Google Chrome when available, with a documented Chromium fallback.
2. Measure at least:
   - landing page idle;
   - landing -> live and landing -> demo navigation;
   - live viewer before an observer exists;
   - demo/default viewer after R2 data settles;
   - Low, Balanced, and High motion modes;
   - deep stars on/off;
   - persisted High + Scope + deep stars state;
   - `prefers-reduced-motion`;
   - visible and background/foreground states.
3. Capture renderer `TaskDuration`, `ScriptDuration`, style/layout duration, long tasks, event-loop delay, JS heap, resource counts, navigation time, and latency for Settings, Sky details, Home/Back, and a representative viewer toggle.
4. Make results machine-readable and print a concise table. Separate deterministic regression assertions from informational hardware-sensitive metrics so CI remains useful rather than flaky.
5. Record the verified before/after results in a durable performance report under `docs/`.

### Phase 2 — Ship a safe recovery path for existing Chrome profiles

1. Introduce an explicit viewer-settings schema/storage migration. Preserve safe user preferences, but migrate legacy performance combinations to a responsive baseline when they have no evidence of running safely under the new renderer.
2. Until the optimized default meets all budgets, use a safe initial configuration: Low cadence, main-view deep stars off, Scope off, and center-only labels. The final optimized release may restore richer defaults only if the performance harness proves they pass.
3. Add a clearly labeled “Reset performance settings” action that restores the safe baseline without clearing permission history, observer data, or unrelated site data.
4. Prevent corrupt or stale settings from causing startup failure. Migration must be idempotent, typed, unit tested, and must not repeat on every load.
5. Avoid a load-then-freeze migration: determine the safe settings before starting expensive scene work or dataset requests.

### Phase 3 — Decouple clocks and remove React from the frame loop

1. Split the current overloaded scene clock into distinct responsibilities:
   - a coarse astronomical ephemeris clock, normally no faster than 1 Hz;
   - live orientation/camera-pose sampling;
   - lightweight moving-object interpolation;
   - canvas drawing.
2. Do not call `setSceneTimeMs` at 15/30 Hz. Astronomy positions may be calculated from a stable coarse time bucket while smooth pose and moving-object presentation interpolate independently.
3. Keep high-rate orientation and frame metadata in refs or a narrowly subscribed external store. Only semantic changes should rerender the application shell.
4. Pause animation, projection, polling, and canvas work when the document is hidden. Resume from current time without replaying missed frames or producing request storms.
5. Keep Low/Balanced/High as visual-fidelity policies, not multipliers for full React renders. High mode must still satisfy responsiveness budgets.
6. Ensure camera `requestVideoFrameCallback` or `requestAnimationFrame` updates only the necessary visual layer and does not increment a token that rerenders unrelated panels.

### Phase 4 — Cache and partition astronomy/deep-star work

1. Move `buildSceneSnapshot()` out of the unconditional component render path. Memoize or externalize it using stable inputs and a coarse time key.
2. Partition calculations by their real invalidation rate:
   - ephemeris and bundled-star horizon positions;
   - constellation construction;
   - satellite/aircraft source updates;
   - deep-star tile loading and decoding;
   - observer/time coordinate transforms;
   - pose-dependent projection;
   - label ranking and selected-object summaries.
3. Cache deep-star proper-motion and horizontal conversions by dataset version, tile, observer, and justified time bucket. A pose change should not redo equatorial astronomy; a one-second time change should not refetch or decode tiles.
4. Keep point buffers stable. Redraw a canvas only when its dimensions, visual options, or projected points actually change. Cap backing resolution adaptively when device-pixel-ratio cost would violate the frame budget.
5. Bound interactive/label candidate work independently from the number of rendered deep stars. Canvas-only background stars must not create thousands of React objects or DOM candidates.
6. If main-thread calculations still exceed the budgets after correct caching, move pure astronomy/tile transformation work to a Web Worker with request-generation cancellation and transferable typed arrays. Do not introduce a worker unless profiling shows it is needed.
7. Confirm R2 manifest, names, indexes, and tiles are cached for the intended lifetime and are not re-requested by clock or pose changes.

### Phase 5 — Render only the active responsive shell

1. Replace CSS-only desktop/compact branching with a hydration-safe capability/viewport abstraction that mounts only the active interaction shell after the breakpoint is known.
2. Do not instantiate duplicate Settings, warning, details, alignment, and control trees for a shell that is hidden.
3. Preserve the audited desktop, tablet, and compact breakpoints, pointer/hover capability behavior, focus restoration, portal dialogs, safe areas, and zero-overflow guarantees.
4. Avoid resize thrash. Debounce or coalesce shell changes and preserve state when crossing the breakpoint.

### Phase 6 — Repair navigation UX and interaction resilience

1. Add a visible, keyboard-accessible Home/Back action inside the desktop and compact viewers. Leaving the viewer must stop camera tracks, orientation providers, timers, polls, animation frames, and pending requests through normal cleanup.
2. Verify landing -> viewer, viewer -> landing, browser Back/Forward, direct/deep links, and demo scenario replacement under default and throttled CPU conditions.
3. Controls must provide immediate pressed/pending feedback when an asynchronous action is unavoidable. Do not allow stacked invisible overlays or onboarding to intercept unrelated desktop controls.
4. Treat Next.js prefetch cancellation as normal, but fail tests on genuine route, chunk, R2, or hydration errors.

### Phase 7 — Add regression coverage and production budgets

Add unit/integration coverage for:

- scene/ephemeris cadence independent from pose/render cadence;
- no full-shell state update on every animation/video frame;
- cache invalidation boundaries for bundled and deep stars;
- no duplicate R2 fetch/decode on stable tile selection;
- hidden-document pause/resume;
- viewer-settings migration, corruption recovery, and reset;
- active-shell-only mounting and breakpoint transitions;
- viewer cleanup on navigation/unmount;
- Home/Back and browser history behavior;
- reduced-motion and all motion-quality modes.

Add production Chrome performance checks with these release budgets, measured after data has settled over a minimum 10-second window:

| Metric | Normal Chrome | 4x CPU throttle |
| --- | ---: | ---: |
| Default viewer renderer `TaskDuration` | <= 10% | <= 30% |
| High + deep stars renderer `TaskDuration` | <= 25% | <= 60% |
| Low safe mode renderer `TaskDuration` | <= 5% | <= 15% |
| Settings / Sky details / Home interaction | <= 100 ms | <= 250 ms |
| Event-loop delay p95 | <= 25 ms | <= 75 ms |
| Long tasks > 100 ms during steady state | 0 | 0 |

Additionally require:

- no steady heap growth greater than 20% across a 60-second viewer soak after garbage collection opportunities;
- no repeated manifest/index/tile fetch for unchanged inputs;
- no page errors, hydration errors, uncaught promise rejections, or unexpected request failures;
- no horizontal overflow at 360x640, Pixel-class mobile, 768x1024 touch tablet, 1366x768 desktop, and 1440x960 desktop;
- navigation and core controls remain operable throughout the soak.

If a fixed percentage is unreliable in shared CI, retain the absolute target for local/stable-Chrome release evidence and add a deterministic relative assertion: the optimized default must consume no more than twice the Low/no-deep-stars baseline on the same run. Do not remove the release budgets merely because CI hardware varies.

## Verification requirements

Run from the canonical repository root:

- `npm ci`;
- lint with zero warnings/errors;
- TypeScript checking;
- complete unit suite;
- production build/static export;
- complete Playwright suite across all configured viewports;
- the new local production performance matrix in stable Chrome and 4x CPU throttle;
- a 60-second memory/resource/interaction soak;
- live contract checks for routes and `Permissions-Policy`;
- post-deploy live performance/navigation smoke tests against Render.

Inspect `git diff`, `git status`, generated artifacts, and production configuration before completion. Preserve unrelated user work. Commit and deploy only after repository-side tests and local production budgets pass; then verify the exact deployed commit is live.

## Final acceptance criteria

The goal is complete only when:

1. The root cause is removed: high-rate animation, video, and sensor clocks no longer rerender the complete React viewer or recompute full astronomy.
2. Default, High/deep-star, safe-mode, persisted worst-case, reduced-motion, and background/resume states meet their budgets.
3. Existing Chrome profiles are migrated before expensive work begins and can recover through a UI reset action.
4. Deep stars and Scope remain available and correct without dominating interaction latency or causing repeated network/decode work.
5. Exactly one responsive interaction shell is mounted, with audited accessibility and viewport behavior preserved.
6. Landing, viewer, Home/Back, browser history, direct URLs, Settings, details, and representative toggles remain responsive under throttling.
7. Camera, orientation, location, alignment, and cleanup behavior retain their existing correctness and privacy contracts.
8. All automated correctness and performance checks pass, including the live production smoke test.
9. The deployed Render service reports the intended commit live, and independent public probes confirm the result.

Finish with an evidence-based handoff containing the before/after Chrome table, architectural changes, settings migration behavior, functional and performance test results, deployed commit/deploy ID, live checks, and any genuinely external hardware-specific verification that remains.
