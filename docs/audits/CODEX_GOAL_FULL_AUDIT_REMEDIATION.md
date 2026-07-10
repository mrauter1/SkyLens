# Codex goal: complete SkyLens audit remediation

> Historical execution brief: during remediation the maintained nested application was
> flattened into the repository root. Audit paths below describe their location when the
> work began; the retained reports now live beside this file in `docs/audits/`.

## Objective

Fully implement, verify, and finish every actionable issue in these two audits:

- `SkyLensServerless/UX_UI_AUDIT_2026-07-09.md`
- `SkyLensServerless/IOS_PERMISSION_FLOW_AUDIT_2026-07-09.md`

The maintained product is currently `SkyLensServerless/`; the application in the repository root is stale. Do not use stale-root behavior as the product specification. This is an implementation goal, not another analysis pass: inspect current code, make the changes, add regression coverage, exercise the resulting UX, and continue until all locally actionable acceptance criteria pass. Do not leave TODOs, knowingly failing tests, placeholder copy, or silent error paths.

Audit line numbers are evidence, not immutable instructions. Re-trace the current implementation before editing and choose coherent architecture over narrow patches. Preserve existing strengths: accessible modal semantics and focus restoration, manual/demo fallbacks, secure-context checks, `audio: false`, `playsInline`, orientation provider arbitration, cancellation IDs, reduced-motion behavior, deterministic demo data, and local scope-data fallback.

## Required execution order

### Phase 1 — Repair permission and runtime lifecycle architecture

Treat this as release-blocking and complete it before visual/content work.

1. Remove the fresh motion circular dependency. Orientation providers must start while readiness is unknown after a successful or indeterminate supported prompt; they must not require orientation to already be granted. Separate at least:
   - permission decision;
   - provider/subscription state;
   - first-sample readiness;
   - calibration/absolute quality;
   - interruption/unavailability.
2. Stop treating URL query values as document-lifetime permission truth. A bookmarked, restored, shared, or stale `camera=granted`/`orientation=granted` URL must not bypass runtime validation. Preserve backward-compatible route parsing only as a non-authoritative hint if needed; prefer removing permission results from canonical URLs.
3. Make the user-facing flow deterministic: initiate the iOS `DeviceOrientationEvent` and `DeviceMotionEvent` permission calls synchronously/concurrently inside the activating click so both capture transient activation, then complete Motion -> Camera -> Location in the order promised by the UI. Do not start geolocation beside the motion prompt.
4. Preserve structured motion errors internally. Distinguish explicit denial, missing transient activation, policy/security failure, unsupported APIs, provider no-sample, delayed/stalled samples, hidden/interrupted state, and implementation failure. Never infer denial merely because APIs exist and no sample arrived.
5. Replace the camera-ready boolean contract with explicit lifecycle state such as requesting, stream-acquired, playing/first-frame-ready, muted/interrupted, ended, denied, busy/not-readable, unavailable, and error.
6. Preserve original camera `DOMException.name` and failed constraint information. Retry looser camera constraints only for appropriate selection/constraint errors, not denial, inactive-document, or hardware contention errors.
7. Do not swallow `video.play()` failure. Require real readiness—successful playback plus metadata/nonzero dimensions or a first-frame callback—before displaying Ready.
8. Make `enumerateDevices()` non-fatal after capture succeeds. On every fatal activation failure, stop and clear the acquired stream.
9. Observe camera track `mute`, `unmute`, `ended`, `readyState`, stream activity, `visibilitychange`, `pagehide`, and `pageshow`. On iOS resume, either revalidate/recover safely or present an accurate user-activated resume action. Never leave black video labeled active.
10. Keep timeouts cancellable and request-ID-safe. Use a distinct no-sample/interrupted state and a measured readiness window; only an explicit denied result may produce denial copy or persisted denial state.
11. Ensure retry paths restart validation even when permission was previously granted. Saved manual observers and live geolocation observers must follow the same motion readiness path.
12. Add privacy-safe diagnostics useful for support/tests: transition reason, request ID, elapsed prompt-to-first-sample/frame, provider/candidate, error name, and lifecycle event. Do not log location, raw sensor readings, frames, or other sensitive values.

### Phase 2 — Fix release-level responsive and modal UX

1. Render Settings and all modal shells through a body-level portal so filtered/backdrop ancestors cannot become fixed-position containing blocks.
2. Make the overlay the scroll owner, constrain panels to the dynamic viewport and safe areas, and preserve focus trap, Escape/backdrop close, accessible naming, scroll locking, and focus restoration from every opener.
3. Keep the compact touch/mobile interaction shell through portrait-tablet layouts. Select desktop versus compact shell using appropriate width plus pointer/hover/capability signals rather than Tailwind `sm` alone. A 768x1024 iPad-style viewport must not receive the dense desktop dashboard or excessive document overflow.
4. Fix the 360 px viewer header collision by allowing a stacked/wrapping layout or compact accessible icon actions. No meaningful title may truncate to nothing.
5. Put the landing “PWA ready” badge in non-overlapping normal flow at 360 px.
6. Raise desktop/tablet warning Details and Dismiss controls to the system's 44 px target baseline without making the rail unnecessarily tall.

### Phase 3 — Make the viewer user-centered

1. Rewrite primary viewer/details content around: what the object is, where it is, and what the user should do next. Remove engineering-contract prose and raw telemetry from the normal experience.
2. Move yaw, pitch, FOV, frame sizes, marker counts, normalized-pipeline details, and similar telemetry behind an explicit Advanced/Diagnostics disclosure that is development/debug-only unless there is a justified user need.
3. Hide scope tuning when Scope is off.
4. Rename the in-view “Open viewer” action to an unambiguous Details/Sky details/What's in view label. Reserve “Open live viewer” for navigation into the viewer.
5. Implement a short, dismissible, accessible first-use stage onboarding that teaches move/point or drag, center/tap a marker, and open details. Read the stored onboarding flag; do not mark completion on the landing CTA. Complete it only on dismissal/completion and add a Settings replay action.
6. Restore clear, accurate location privacy copy near live entry. Verify actual request construction first; do not claim data is only local or not stored unless code and upstream requests support that statement.
7. Make unavailable alignment targets visibly and accessibly unavailable, or clearly announce the fallback target. `disabled`/`aria-disabled`, visual treatment, and behavior must agree.
8. Reorganize Settings into clear sections: Display, Motion & alignment, Camera, Telescope, Demo, and Advanced as appropriate. Keep common controls first, hide mode-irrelevant actions, and do not show “Enter demo mode” while already in demo.

### Phase 4 — Resolve test, quality, data-policy, and deployment gaps

1. Add stable Playwright projects/coverage for 360x640 mobile, Pixel-class mobile, 768x1024 portrait tablet, 1366x768 short laptop, and 1440x960 desktop. Add desktop WebKit automation if supported, while documenting that it is not a physical-iPhone substitute.
2. Add viewport geometry assertions for every Settings opener/state: panel top and bottom must remain within the viewport and its final action must be scroll-reachable.
3. Add regression tests for:
   - clean motion startup with no saved manual observer;
   - deterministic Motion -> Camera -> Location order;
   - transient-activation expiry/concurrent motion requests;
   - stale/deep-link granted values after runtime access is absent;
   - explicit denial versus delayed/no sample;
   - every relevant camera DOMException class;
   - play rejection, zero dimensions, enumeration rejection after acquisition;
   - track mute/unmute/ended and page background/resume;
   - manual versus geolocation observers;
   - onboarding empty-storage, completion, persistence, and replay;
   - unavailable alignment targets;
   - 360 px header/badge and portrait-tablet shell.
4. Update the two stale Playwright expectations identified in the UX audit to assert current intended behavior rather than removed UI.
5. Resolve all ESLint errors and warnings, including hook dependency warnings, by fixing ownership/stale-closure behavior—not by blanket disabling rules.
6. Make the scope-data policy match documentation: local data by default in development; production R2 only when explicitly configured. Preserve production CORS behavior and local fallback.
7. Make the live static host actually return the intended `Permissions-Policy` for camera, geolocation, accelerometer, gyroscope, and magnetometer. Because static Next export does not apply `headers()`, use a Render-supported deployment configuration rather than assuming `_headers` is honored. Add a live-origin smoke check that fails when the header is absent. Preserve explicit iframe delegation and verify top-level and embedded routes.
8. If production configuration or a physical iPhone is unavailable, finish all repository-side work and automated simulations, then report the exact remaining external action and evidence needed. Do not falsely claim live-header or physical-device success.

### Phase 5 — Clean the stale repository layout

The user has identified the root app as stale and authorized cleanup. Do this after product fixes are green so failures are attributable.

Preferred end state: move the maintained `SkyLensServerless` application to the repository root while preserving history where practical.

1. Inventory and preserve unique maintained assets, durable deployment information, current ADR/PRD decisions, audit reports, and complete local scope-data fallback before deleting anything.
2. Remove the stale root application/config duplication and archived `.autoloop` run artifacts that have no durable product value. Archive still-useful historical documents under a clearly labeled `docs/archive/` rather than leaving competing current specifications.
3. Remove generated output from version control (`out`, `.next`, coverage, Playwright/test results, `tsconfig.tsbuildinfo`) and ignore it.
4. Standardize on one package manager/lockfile. Prefer npm/`package-lock.json` unless repository/deployment evidence requires pnpm.
5. Move the maintained app to root with history-preserving moves where practical; consolidate current docs into `README.md` and `docs/architecture/`.
6. Update all paths in scripts, CI, tests, documentation, deploy checks, static headers, data tooling, and Render instructions. Add a declarative Render configuration if supported so root/build/publish/header settings are reviewable.
7. If flattening would destroy unique data or requires an unavailable production setting change, implement the lower-risk transitional state: remove the stale root app and make root scripts explicitly delegate to `SkyLensServerless`, with a prominent canonical-app README. Record the exact blocker to flattening. Do not retain two runnable apps.
8. Keep the two audit files and this goal brief as historical verification artifacts, relocating them into docs if the app is flattened.

## Verification requirements

Run from the final canonical repository root and make all applicable checks green:

- clean dependency install using the chosen lockfile;
- production build/export;
- complete unit suite;
- complete Playwright suite across the viewport projects;
- ESLint with zero warnings/errors;
- TypeScript checking if separate from build;
- generated/export header and embed-contract tests;
- direct `/view` and legacy query URL loading;
- manifest, icons, local datasets, remote-production dataset/CORS, and demo assets;
- keyboard-only modal/onboarding/recovery flows;
- screenshots or measured geometry at all audited viewports;
- live production HTTPS, direct-route health, and `Permissions-Policy` response, when deployment access exists.

Inspect `git diff` and `git status` before completion. Do not overwrite unrelated user changes. Ensure generated artifacts are not left dirty or newly tracked.

## Final acceptance criteria

The goal is complete only when:

1. A clean iPhone-style session can accept motion, start its provider, receive a usable sample, and reach ready without a saved manual observer.
2. Permission denial, unsupported hardware, no sample, camera busy, camera interrupted, and playback failure produce distinct truthful states and recovery actions.
3. Stale URLs cannot claim runtime readiness.
4. Camera Ready means a live/unmuted track is producing visible frames; background/resume is handled.
5. Motion -> Camera -> Location behavior matches trust copy and tests.
6. Settings is wholly reachable at every audited viewport and keeps its accessibility behavior.
7. Portrait tablets use an appropriate touch shell; no audited viewport has horizontal overflow or control collisions.
8. Normal viewer content is user-facing, onboarding actually teaches the stage, location copy is accurate, and diagnostics are gated.
9. Alignment, scope, demo, and Settings controls reflect availability/mode accurately.
10. All automated checks pass with zero lint warnings, including new lifecycle, responsive, onboarding, and permission regressions.
11. The production header contract is implemented and verified, or the exact external deployment step is the sole clearly documented blocker.
12. There is one unmistakable canonical runnable application, with stale/generated repository clutter removed and deployment paths updated.

Finish with a concise evidence-based handoff listing architectural changes, user-visible changes, tests/viewport results, live checks, repository cleanup, and any genuinely external physical-device or deployment verification still required.
