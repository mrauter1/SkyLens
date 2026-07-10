# SkyLens viewer performance remediation

## Baseline

Production was measured on July 10, 2026 at
`https://skylens-serverless-static.onrender.com` using stable Google Chrome 146 at
1440x960 after network activity settled.

| Viewer state | Renderer TaskDuration |
| --- | ---: |
| High motion + deep stars | 42.7% |
| Balanced motion + deep stars | 29.7% |
| Low motion + deep stars | 4.3% |

At 4x CPU throttle, controlled A/B measurements were:

| Viewer state | Renderer TaskDuration |
| --- | ---: |
| Balanced + deep stars | 83.8% |
| Low + deep stars | 13.9% |
| Balanced + no deep stars | 41.4% |
| Low + no deep stars | 5.3% |

Under throttling, representative controls took 435-885 ms to respond. Direct routes,
landing navigation, R2 data delivery, hydration, and JavaScript execution completed
without application errors. The failure is sustained renderer main-thread starvation.

## Reproduction

Run the production matrix against the local static server or the live deployment:

```sh
npm run performance:viewer -- --url http://127.0.0.1:3100
npm run performance:viewer -- --cpu-throttle 4
npm run performance:viewer:assert -- --url https://skylens-serverless-static.onrender.com
```

Use `--cases` for the extended states, for example:

```sh
npm run performance:viewer -- --cases landing,live-pre-observer,default,high-deep-stars,low-safe,persisted-worst-case,reduced-motion
```

Pass `--output path.json` to retain the complete machine-readable CDP report. Fixed
release budgets live in `scripts/profile-viewer-performance.mjs` and the authoritative
implementation requirements live in `performance-goal.md`.

## After remediation

The final local measurements used the production static export, the production R2
`scope/v1` endpoint, stable Google Chrome 146, a 1440x960 viewport, a five-second
post-data warm-up, and a ten-second steady-state measurement window.

| Final viewer state | Normal TaskDuration | 4x TaskDuration | Normal max interaction | 4x max interaction |
| --- | ---: | ---: | ---: | ---: |
| Default safe baseline | 1.7% | 6.1% | 70.0 ms | 84.8 ms |
| High + deep stars | 2.5% | 9.1% | 65.2 ms | 97.9 ms |
| Low safe mode | 1.5% | 6.1% | 87.0 ms | 98.8 ms |

Every final headline case had zero tasks over 100 ms. Normal event-loop p95 was
0.2-0.4 ms; 4x event-loop p95 was 0.8-2.0 ms. The High/deep-star case loaded 11
unique R2 resources and made no duplicate request for an unchanged URL.

Compared with the production baseline, High + deep stars fell from 42.7% to 2.5%
at normal speed. Under 4x throttling, the previously default Balanced + deep-star
state used 83.8%; the final richer High + deep-star case uses 9.1%.

The final 60-second High/deep-star soak measured 2.2% TaskDuration, 0.3 ms
event-loop p95, no task over 100 ms, a 90.3 ms maximum interaction, 2.6% GC-normalized
heap growth, and the same 11 unique R2 requests with no duplicates.

## Implemented architecture

- The semantic ephemeris clock now runs at 1 Hz and stops while the document is
  hidden. Resume advances directly to current scene time without replaying missed
  frames.
- Camera video-frame callbacks update source dimensions only when dimensions change;
  they no longer increment a token that rerenders the viewer. Orientation samples
  are latest-value coalesced to at most 15 React commits per second.
- Scene, constellation, projection, and canvas inputs use stable memoized boundaries.
  Deep-star conversion constructs the observer/time rotation once per batch instead
  of once per star. Profiling after this change did not justify a Web Worker.
- Moving aircraft and satellites interpolate between coarse semantic positions with
  CSS, while reduced-motion keeps transitions disabled.
- Deep-star labels are bounded independently of canvas points, center-only mode does
  not construct label candidates, and large point sets use an adaptive canvas DPR.
- Only the capability-appropriate compact or desktop interaction shell mounts in
  production. Breakpoint selection uses a hydration-safe external media-query store.
- Layer controls paint their native checked state before the dependent astronomy
  invalidation runs in a later browser task.
- Health, satellite, camera-frame, scene-clock, and related polling work pause when
  hidden. Scope catalog session caches retain manifests, names, indexes, and tiles.

## Existing-profile recovery

Viewer settings moved from `skylens-serverless.viewer-settings.v1` to the typed `v2`
record. A legacy record is migrated once, before expensive work starts, to Low motion,
deep stars off, Scope off, and center-only labels while preserving unrelated safe
preferences. Corrupt records recover to typed defaults. Settings includes a
“Reset performance settings” action that does not clear permissions, observer data,
or unrelated storage.

## Navigation and responsive behavior

The active desktop or compact viewer has one visible Home action with immediate
Leaving… feedback. Normal unmount cleanup stops camera tracks, orientation providers,
timers, polls, and animation/video callbacks. Playwright verifies Home, browser Back
and Forward, active-shell-only mounting, focus behavior, dynamic viewport containment,
and no horizontal overflow at the audited 360 px, Pixel-class, tablet, laptop, and
desktop sizes.

## Local verification

- `npm ci`: passed.
- ESLint and TypeScript: passed with zero errors.
- Vitest: 40 files passed; 426 tests passed and one was intentionally skipped.
- Production build/static export: passed with production R2 configuration.
- Playwright: 37 applicable tests passed across all configured projects; 12
  viewport-conditional cases were intentionally skipped.
- Stable-Chrome normal, 4x, persisted-profile, reduced-motion, background/resume,
  navigation, and 60-second soak assertions: passed.

Live Render commit, deploy, route/headers, and post-deploy performance evidence are
recorded after deployment.
