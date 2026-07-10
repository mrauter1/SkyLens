# SkyLens UX/UI audit

Date: 2026-07-09
Audited product: `SkyLensServerless/`
Live verification: `https://skylens-serverless-static.onrender.com`

## Executive summary

The maintained application has a coherent visual language, a solid mobile overlay foundation, and unusually good focus restoration for a custom full-screen viewer. The production build succeeds, core mobile fallback flows work, and the live R2 scope dataset is correctly CORS-enabled for the deployed Render origin.

The most important current defect is the Settings presentation on desktop and tablet. Settings uses `position: fixed`, but it is rendered inside an ancestor with `backdrop-filter`. That ancestor establishes the containing block, so the dialog is centered against the viewer header instead of the viewport. In the live deployment, the top of the dialog is hundreds of pixels above the viewport and its title and Close button cannot be reached with a pointer.

The next most consequential issues are product clarity rather than styling: the UI promises a sequential permission order that the implementation does not follow; tablets switch to a dense desktop dashboard at only 640 px; viewer copy exposes engineering terminology and telemetry; and first-time users receive almost no guidance for interpreting or manipulating the sky view.

Repository cleanup is strongly recommended. `SkyLensServerless/` is the current app, but the repository root still contains a second runnable stale app, duplicate dependencies and locks, tracked build output, and 1,376 tracked `.autoloop` files. The safest end state is to make the maintained app the repository root in a dedicated cleanup PR.

## Scope and method

The audit covered:

- Landing page, demo viewer, live/free-navigation entry, viewer details, warnings, alignment, and Settings.
- Responsive behavior at 360×640, 412×915, 768×1024, 1366×768, and 1440×960.
- Keyboard focus, dialog semantics, focus trapping/restoration, hit areas, scrolling, overflow, and safe-area behavior.
- Source tracing in the maintained Next/React app.
- Production export, local static preview, the documented live Render deployment, and the R2 data origin.
- Existing unit and Playwright coverage.
- Repository layout and a safe stale-root cleanup path.

Validation performed:

- `npm run build`: passed. Next warns that `headers()` is not applied to static export; `public/_headers` remains the actual hosting contract.
- Selected unit suites: 29/29 passed.
- Permission-order unit probe: failed, confirming the implementation/copy mismatch.
- Playwright: 17/19 passed. The two failures are stale test expectations, described below.
- ESLint: 0 errors, 14 warnings, including several missing hook dependencies in the viewer.
- Live deployment: the responsive geometry and Settings defect reproduced.
- Production-origin R2 CORS: passed with `Access-Control-Allow-Origin: https://skylens-serverless-static.onrender.com`.

## What is working well

- The mobile viewer and alignment surfaces are real modal dialogs with accessible names.
- Focus moves into mobile dialogs, is trapped, closes with Escape/backdrop, and restores to the opener.
- The 360×640 mobile viewer panel fits the viewport and provides an internal scroll region.
- On 360×640, Settings can scroll to its final action; its lowest control was fully visible after scrolling.
- No horizontal document overflow was found at any audited viewport.
- Main mobile actions meet a 44 px minimum height; landing CTAs are 48 px high.
- Warnings are compact, expandable, and dismissible instead of permanently occupying a large rail.
- Demo data is deterministic enough for object selection to pass end-to-end testing.
- Production remote scope data works, with local assets available as fallback.
- Reduced-motion and battery-conscious modes are represented in the implementation.

## Prioritized findings

### P1 — Desktop and tablet Settings is positioned outside the viewport

Impact: users cannot see the Settings title or use the visible Close button with a pointer. The dialog appears to start midway through its content, which looks like data or controls are missing.

Measured results from both the local production export and the live deployment:

| Viewport | Settings panel top | Settings panel bottom | Viewport height |
|---|---:|---:|---:|
| 768×1024 | −315 px | 661 px | 1024 px |
| 1366×768 | −187 px | 533 px | 768 px |
| 1440×960 | −283 px | 629 px | 960 px |

Cause: `.shell-panel` applies `backdrop-filter: blur(18px)` in `app/globals.css`. Settings is mounted inside the desktop header's `.shell-panel`, while its shell is `position: fixed` in `components/settings/settings-sheet.tsx`. A filtered ancestor establishes the fixed-position containing block, so the dialog is not viewport-fixed.

Recommended fix: render all modal shells through a portal into `document.body`. As a secondary guard, make the overlay shell the scroll owner, cap the panel at `100dvh` minus safe spacing, and add an end-to-end geometry assertion that `panel.top >= 0` and `panel.bottom <= innerHeight` at laptop and tablet sizes.

### P1 — Permission behavior contradicts the trust copy

Impact: the landing page and startup status say permissions occur Motion → Camera → Location, but location starts before camera. Permission prompts may appear in a different order from the promise, weakening trust during the most sensitive part of onboarding.

Evidence:

- Landing page explicitly displays `Motion → Camera → Location`.
- Startup copy says motion is first, camera second, and location third.
- `handleRetryPermissions` creates both `orientationPromise` and `observerPromise` before awaiting `openLiveCamera`.
- The targeted unit test recorded `orientation, location, camera` and failed against the expected `orientation, camera, location`.

Recommended fix: either make the requests genuinely sequential, or rewrite the copy to describe parallel preparation accurately. Sequential prompts are preferable because the product deliberately presents the order as a trust feature.

### P1 — The 640 px breakpoint gives tablets the desktop dashboard

Impact: a 768 px portrait tablet—still a likely handheld AR device—gets the desktop header, warning stack, inline detail dashboard, and desktop Settings presentation. The open viewer becomes a 1,439 px page with 415 px of vertical overflow, separating controls and information from the sky stage.

Evidence at 768×1024:

- Warning plus closed header occupy the top 266 px.
- Opening Viewer expands the header to 395 px.
- The details panel is 928 px tall below it.
- The mobile bottom sheet and mobile actions disappear at Tailwind's `sm` breakpoint.

Recommended fix: choose the interaction shell using capability and layout needs, not `sm` alone. Keep the compact/touch shell through portrait tablet widths, or use a breakpoint closer to 1024 px combined with pointer/hover media queries. Add an iPad portrait Playwright project.

### P2 — Viewer content reads like an engineering console

Impact: users looking for “what is that in the sky?” encounter implementation language and telemetry before useful object interpretation.

Examples visible in production:

- “The live overlay shell is running against a non-camera demo backdrop…”
- “flowing through the normalized … object contract”
- “Center-lock still uses angular distance from the reticle, not pixel distance”
- Raw Yaw, Pitch, FOV, Sensor, Target, frame size, and visible-marker counts.
- “Scope controls” occupies a large card even when the scope is off.

The open desktop viewer adds 760–928 px of cards and turns the sky guide into a diagnostic dashboard. On mobile, the same technical content fills a 1,142 px scroll body at 360×640.

Recommended fix: make the primary detail surface answer three questions: object name/type, where it is, and what the user should do next. Move telemetry and pipeline diagnostics behind an explicit Advanced/Diagnostics disclosure enabled only in development or a debug mode. Hide scope tuning until Scope is enabled.

### P2 — First use has no effective viewer onboarding

Impact: the default demo stage shows a crosshair and small, mostly unlabeled markers, plus Aperture, Open viewer, and Scope. It does not explain drag/pan, tap a marker, center an object, what marker shapes mean, or why aperture matters.

The `onboardingCompleted` flag is set by landing CTAs and AR entry, but no viewer code reads it to decide whether to show guidance. In practice, the product marks onboarding complete before teaching the viewer.

Recommended fix: use the stored flag for a short, dismissible first-use sequence on the actual stage: “drag/point to move,” “center or tap a marker,” and “open details.” Do not mark it complete until the user dismisses or completes that sequence. Include a replay action in Settings.

### P2 — The action name “Open viewer” is self-contradictory

Impact: the user already entered the viewer from “Open live viewer,” then sees another “Open viewer” button. That second action actually opens details. Desktop compounds this with “Open Viewer / Details.”

Recommended fix: rename the in-view action to “Details,” “Sky details,” or “What’s in view.” Keep “Open live viewer” only for navigation from the landing page.

### P2 — Mobile header content collides at 360 px

Impact: in the 360 px viewer dialog, the status/header card receives only 115 px because Settings and Close consume the rest. “Demo viewer” truncates to almost nothing and the status badge crowds the SkyLens label.

Recommended fix: stack the header summary and actions at narrow widths, or replace Settings/Close text buttons with one compact overflow/settings control and a standard close icon with an accessible label. Do not place a non-shrinking badge in the same row as a truncating two-line title at 360 px.

### P2 — Privacy messaging omits location handling

Impact: the app requests precise location but the maintained landing page no longer tells users how location is used. Camera, aircraft queries, satellite catalogs, and frame upload are explained; location—the permission most likely to cause hesitation—is not.

Recommended fix: restore clear location reassurance near the CTA, for example: “Location is used on this device to calculate what is above you; it is not stored by SkyLens.” Confirm the statement against actual OpenSky/CelesTrak request construction before publishing it.

### P2 — Alignment offers unavailable targets

Impact: Sun and Moon buttons can be selected even when the target is unavailable. The component receives `available`, but does not use it for `disabled`, visual state, or accessible copy. The app then silently falls back, which makes alignment feel inconsistent.

Recommended fix: disable unavailable targets with an explanatory label, or keep them selectable but explicitly say “Moon unavailable—using [fallback].” Ensure `aria-disabled`/`disabled` and visual state agree.

### P3 — Landing badge overlaps its heading on small mobile

Impact: at 360 px, the absolutely positioned “PWA ready” badge overlaps “Privacy and fallback notes,” reducing legibility and making the card look broken.

Recommended fix: place the badge in normal flow with a wrapping header row, or reserve right padding equal to the badge width.

### P3 — Desktop warning controls are smaller than the rest of the system

Impact: Details and Dismiss are 34 px high at tablet and desktop sizes, while primary controls consistently use 44–48 px. This is not a WCAG 2.5.8 failure, but it is a weaker touch/low-dexterity target and inconsistent with the product's own sizing standard.

Recommended fix: use `min-h-11` for both warning actions and preserve the compact row through padding/gap adjustments.

### P3 — Settings is long and mixes basic, advanced, and mode-specific controls

Impact: the Settings content is about 1,632–1,832 px tall. Layer visibility, label policy, performance, calibration, camera, field of view, marker scale, telescope geometry, scenarios, and “Enter demo mode” all share one stream. In demo mode, “Enter demo mode” is redundant.

Recommended fix: group into Display, Motion & alignment, Camera, Telescope, and Demo. Keep common controls first; put calibration and optical tuning under Advanced. Replace the demo action with “Exit demo” or omit it when already in demo.

### P3 — Local development defaults conflict with the documented data policy

Impact: local preview attempts the production R2 origin first. R2 correctly rejects localhost, causing repeated console errors and failed requests before local fallback. The app still works, but development traces are noisy and startup does unnecessary network work.

`PARITY.md` says remote delivery is opt-in and local-only is the default, while `lib/config.ts` enables the production R2 URL by default.

Recommended fix: make the documented and implemented default agree. Prefer local assets unless a public remote URL is explicitly configured for that environment. Keep the production environment variable on Render.

## Test and maintainability gaps affecting UX

- Playwright currently has only a Pixel 7 project. A single test manually resizes to desktop; there is no persistent desktop, short-laptop, or tablet project.
- 17/19 end-to-end tests passed. The two failures are expectations for UI that no longer exists in that state: quick sliders while the mobile overlay is open, and a desktop next-action card while the desktop viewer is collapsed. This indicates tests and product behavior have drifted.
- The permission-order unit test correctly catches a real product mismatch and currently fails.
- No test asserts modal geometry relative to the viewport, which allowed the Settings containing-block defect.
- ESLint reports missing hook dependencies in viewer projection and side-effect logic. These may create stale UI state under observer/camera changes and deserve resolution before more UX work.
- Both npm and pnpm lockfiles are committed. Dependency installs also warn that TypeScript 6 is outside the current `typescript-eslint` peer range.

Recommended coverage additions:

1. Named Playwright projects for 360×640 mobile, Pixel 7, iPad portrait, 1366×768 laptop, and 1440×960 desktop.
2. Modal geometry and focus tests for Settings from every opener and state.
3. A permission-sequence test at the ViewerShell level that cannot pass with concurrent location startup.
4. Visual snapshots for the 360 px landing/privacy header and viewer dialog header.
5. A first-use test that starts with empty storage and verifies actionable stage guidance.

## Repository cleanup analysis

### Current state

- `SkyLensServerless/` contains the maintained app: 209 tracked files.
- Outside that directory are 1,529 tracked files, including the stale root app and 1,376 `.autoloop` artifacts.
- Root and maintained app each have their own `app`, `components`, `lib`, `public`, `tests`, scripts, Next/TypeScript/test configs, `package.json`, `package-lock.json`, and `pnpm-lock.yaml`.
- `SkyLensServerless/out/` has 60 tracked generated files. A normal build rewrites hashes and dirties the worktree.
- Both root and maintained `tsconfig.tsbuildinfo` files are tracked generated artifacts.
- Documentation is split between dozens of root task/plan files and maintained design documents.
- The Render service is configured externally; there is no repository `render.yaml` to make the build root and publish directory self-documenting.

This layout makes it easy to run, test, lint, or edit the wrong application—the initial audit did exactly that. It also makes root lint scan both apps, doubles dependency/security noise, and obscures which docs are authoritative.

### Recommended end state: flatten the maintained app to repository root

Do this in a dedicated cleanup PR, separate from UX fixes.

1. Record the current live Render commit and export artifact behavior.
2. Freeze feature work briefly or rebase the cleanup immediately before merge.
3. Remove generated artifacts from version control: `out/`, `.next/`, coverage, Playwright output, and `tsconfig.tsbuildinfo`; add them to the root `.gitignore`.
4. Choose one package manager. Render currently fits the npm lock workflow; keep `package-lock.json` unless the team intentionally standardizes on pnpm.
5. Remove or archive `.autoloop` run logs outside the product repository. Keep only durable ADRs or summaries that still inform the maintained design.
6. Remove the stale root application trees and stale root configs.
7. Move the contents of `SkyLensServerless/` to the repository root using `git mv` where practical so history remains traceable.
8. Consolidate documentation into `README.md`, `docs/architecture/`, and `docs/archive/`. Mark historical PRDs as superseded rather than leaving multiple apparent sources of truth.
9. Update Render's root/build/publish settings from `SkyLensServerless/...` to root paths. Preserve `public/_headers`; it is required for permissions on the static host.
10. Update any CI, local scripts, badges, and docs that use `SkyLensServerless` as the working directory.
11. Verify build, unit tests, all viewport projects, `_headers`, manifest/icons/data paths, direct `/view?...` loading, and the live production-origin R2 CORS path.
12. Deploy to a preview service before changing the production service settings.

### Lower-risk transitional alternative

If flattening cannot happen immediately, delete the stale root app and replace the root package with a very small workspace/delegation layer whose scripts explicitly call `npm --prefix SkyLensServerless ...`. Add a root README stating that `SkyLensServerless/` is canonical. This removes the wrong-app trap while deferring the deployment path change, but it should be temporary.

### Files that should not be deleted blindly

- `SkyLensServerless/public/_headers`: required by the static host permission contract.
- Maintained scope data and build scripts: confirm the local fallback remains complete before pruning root dataset tooling.
- Render deployment notes/API service identifiers: migrate the durable parts into deployment documentation first.
- Historical PRDs that capture still-active decisions: archive and label them; do not leave competing current specs.

## Recommended execution order

1. Fix Settings with a body-level portal and add viewport geometry tests.
2. Make permission behavior match the published sequence.
3. Correct the tablet shell breakpoint.
4. Rewrite viewer details around user tasks; move telemetry to Advanced/Diagnostics.
5. Add actual first-use viewer guidance and fix ambiguous action names.
6. Repair mobile header and landing badge collisions; restore location privacy copy.
7. Fix alignment availability and warning hit areas.
8. Realign Playwright coverage and resolve hook warnings.
9. Perform the stale-root flattening in its own reviewed cleanup PR.

## Overall assessment

SkyLens has a credible visual foundation and better accessibility behavior than the stale root suggested. The maintained app is not far from a good experience, but the desktop Settings defect is a release-level issue, and the current content model still exposes too much implementation detail. Fixing modal placement, permission trust, tablet shell selection, and first-use clarity will produce a much larger UX improvement than further visual polish.
