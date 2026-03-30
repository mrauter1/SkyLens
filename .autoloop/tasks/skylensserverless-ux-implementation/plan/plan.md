# SkyLensServerless UX implementation plan

## Scope
- In scope: `SkyLensServerless/components/ui/compact-mobile-panel-shell.tsx`, `SkyLensServerless/components/settings/settings-sheet.tsx`, `SkyLensServerless/components/viewer/viewer-shell.tsx`, `SkyLensServerless/lib/viewer/alignment-tutorial.ts`, `SkyLensServerless/components/landing/landing-screen.tsx`, and touched tests under `SkyLensServerless/tests/unit` and `SkyLensServerless/tests/e2e`.
- Out of scope: route or storage schema changes, new modal infrastructure, unrelated viewer rendering refactors, and docs-only outputs.
- Treat `/workspace/SkyLens/SkyLensServerless` as the authoritative product package for this task. The duplicated root-level `app/`, `components/`, `lib/`, and `tests/` trees are comparison-only and must not absorb implementation scope.

## Current codebase state
- `CompactMobilePanelShell` already provides the full-height sheet frame with safe-area margins, internal scrolling, and stable shell/panel/scroll test hooks.
- `SettingsSheet` already owns its trigger, focus trap, focus restore, and backdrop dismissal locally.
- `viewer-shell.tsx` already uses the shared compact sheet for the mobile viewer and mobile alignment instructions, records opener/fallback focus targets, and guards alignment-focus mode from backdrop dismissal by removing the overlay shell entirely in that state.
- `buildAlignmentTutorialModel(...)` already resolves to one `primaryStep` plus at most one `supportingNotice`.
- `resolveViewerBannerFeed(...)` already drives both desktop top banners and mobile fallback banners from one prioritized resolver with deterministic overflow ordering.
- `landing-screen.tsx` already reduces hierarchy to one dominant live-viewer CTA plus a lighter support column.
- In the authoritative `/workspace/SkyLens/SkyLensServerless` package context, `tests/unit/settings-sheet.test.tsx`, `tests/unit/alignment-tutorial.test.ts`, `tests/unit/viewer-shell-resolvers.test.ts`, and the required Chromium Playwright specs already pass; the remaining active completion blocker is the full `tests/unit/viewer-shell.test.ts` file not exiting normally.

## Execution target for this run
- Treat the current implementation as the baseline contract and finish the task by validating it end to end, then fixing only the concrete gaps found during regression testing or focused review.
- Run validation and any required fixes from the nested `SkyLensServerless/` package context so unit and e2e evidence comes from the scoped app, not the duplicated root-level tree.
- Treat the active blocking implementation feedback as mandatory completion gates for this run:
  - `IMP-001`: the full `tests/unit/viewer-shell.test.ts` suite must complete and pass in the normal runner; subset-only evidence is not sufficient to close the phase.
  - `IMP-007`: the remaining work must land an actual package-scoped fix for the `viewer-shell` full-suite timeout or open-handle path before the phase can close.
- The earlier Chromium dependency blocker is cleared in the current workspace snapshot; preserve that passing Playwright baseline and rerun it after any scoped code or test changes that could affect the touched viewer/landing flows.
- Do not reopen the removed fullscreen mobile overlay path, reintroduce separate mobile banner decision trees, or add generic abstractions to solve issues that can stay local to the scoped files.

## Single completion phase

### Finalize and verify the UX contract
- Keep the currently passing resolver/settings/e2e evidence intact while isolating the one remaining blocker in the full `viewer-shell` unit file.
- Resolve the remaining completion blocker before claiming the phase complete:
  - make `tests/unit/viewer-shell.test.ts` finish successfully without narrowing to `-t` subsets or relying on external `timeout`
- Fix only the scoped regressions discovered in the current code path:
  - outside-click and `Escape` close behavior for settings and viewer-owned overlays
  - per-surface focus restoration, including opener-unmount fallbacks
  - single-next-step / single-primary-CTA resolver behavior
  - single-primary-banner prioritization and deterministic overflow ordering
  - desktop hierarchy reduction without re-expanding banner clutter
  - mobile short-viewport overlay stability
- Prefer the smallest package-scoped fix that eliminates the lingering open-handle or teardown leak in `tests/unit/viewer-shell.test.ts` or its directly exercised viewer code; do not broaden into unrelated product refactors if the issue is isolated to the test harness.
- Keep all behavior decisions anchored to the existing local seams:
  - `CompactMobilePanelShell` for shared sheet framing only
  - `SettingsSheet` for settings-trigger ownership and local dismissal
  - `buildAlignmentTutorialModel(...)` for alignment next-step wording
  - `resolveViewerBannerFeed(...)` for banner priority
  - `viewer-shell.tsx` for per-surface wiring, restore targets, and layout-specific presentation

## Interfaces and local contracts
- `CompactMobilePanelShell`
  - Remains presentational.
  - Preserve `COMPACT_MOBILE_PANEL_MAX_HEIGHT`, `shellTestId`, `panelTestId`, and scroll-region test hooks.
- `SettingsSheet`
  - Retains trigger ownership, focus trap, local backdrop dismissal, and upward `onOpenChange` reporting for viewer scroll lock.
  - Must always restore focus to the settings trigger on close.
- `buildAlignmentTutorialModel(...)`
  - Continues to return `{ status, primaryStep, supportingNotice }`.
  - `primaryStep` remains the single source for the dominant alignment instruction and CTA label.
- `resolveViewerBannerFeed(...)`
  - Continues to return `{ primary, overflow }`.
  - Must remain deterministic for identical inputs and stay shared across desktop/mobile surfaces.
- `viewer-shell.tsx`
  - Owns overlay open/close policy, focus-restore fallbacks, and layout-specific rendering.
  - Must preserve stable selectors already used by tests, especially `mobile-viewer-overlay*`, `mobile-alignment-overlay*`, `settings-sheet-*`, `alignment-start-action`, `viewer-top-warning-stack`, and `desktop-open-viewer-action`.

## Compatibility and regression notes
- No public route, config, storage, or developer-workflow contract change is planned.
- The intentional behavior change remains the requested UX simplification only: full-height sheet overlays, outside-click dismissal for non-guarded sheets, one dominant next step, one default actionable banner, and reduced desktop chrome.
- The highest regression surface is still mobile overlay/focus behavior because it depends on local restore-target wiring plus responsive layout branching.

## Validation approach
- Baseline already verified in the authoritative package context
  - `tests/unit/settings-sheet.test.tsx`, `tests/unit/alignment-tutorial.test.ts`, and `tests/unit/viewer-shell-resolvers.test.ts` pass.
  - `tests/e2e/demo.spec.ts`, `tests/e2e/permissions.spec.ts`, and `tests/e2e/landing.spec.ts` pass in the current Chromium-capable environment.
- Unit
  - `tests/unit/settings-sheet.test.tsx`
  - `tests/unit/alignment-tutorial.test.ts`
  - `tests/unit/viewer-shell-resolvers.test.ts`
  - `tests/unit/viewer-shell.test.ts`
- E2E
  - `tests/e2e/demo.spec.ts`
  - `tests/e2e/permissions.spec.ts`
  - `tests/e2e/landing.spec.ts`
- Completion gate
  - `tests/unit/viewer-shell.test.ts` must pass as a full suite in the default test runner from `/workspace/SkyLens/SkyLensServerless`; filtered subsets and external `timeout` kills are diagnostic evidence only.
  - If the eventual fix touches viewer/landing behavior, rerun the already-passing Playwright specs to confirm the preserved UX contract rather than assuming the earlier green run still covers the changed code.
- Required assertions
  - settings, mobile viewer, and mobile alignment overlays close correctly on backdrop and `Escape` where allowed
  - guarded alignment focus remains non-dismissible by backdrop because the overlay shell is absent in that mode
  - focus returns to the original opener or explicit surviving fallback control after each dismiss path
  - next-step and banner resolvers keep one dominant action path with deterministic output
  - short-viewport mobile overlays keep lower controls reachable without reverting to a fullscreen takeover

## Risk register
- Focus restoration risk: close-after-state-change can still target a detached element. Control with current fallback-target logic plus dismissal-path tests.
- Resolver drift risk: ad hoc JSX conditionals can reintroduce desktop/mobile banner or CTA divergence. Control by keeping decisions inside `buildAlignmentTutorialModel(...)` and `resolveViewerBannerFeed(...)`.
- Desktop/mobile style bleed risk: visual cleanup fixes can accidentally widen scope across breakpoints. Control by keeping layout adjustments local to the existing landing and desktop viewer containers.
- Selector churn risk: low-level markup cleanup can break deterministic regression coverage. Control by preserving current test ids unless the UX contract itself requires a rename.
- Validation-evidence risk: the phase can look source-complete while still failing the required completion proof if the full viewer-shell suite hangs or Playwright runs in an under-provisioned container. Control by treating those verifier findings as first-class blockers and closing them before phase completion.
- Workspace-targeting risk: the repository contains duplicated root-level and nested app trees plus missing local installs in the current snapshot, which can create false-negative runner failures or edits in the wrong package. Control by keeping implementation and validation anchored to `/workspace/SkyLens/SkyLensServerless` after dependency bootstrap.
- Over-fix risk: the remaining blocker may tempt unrelated product cleanup even though the currently failing evidence is isolated to the full `viewer-shell` suite exit path. Control by starting from the test teardown/open-handle path and only touching production viewer code when the leak is proven to originate there.
