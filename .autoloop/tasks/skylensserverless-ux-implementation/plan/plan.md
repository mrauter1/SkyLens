# SkyLensServerless UX implementation plan

## Scope
- In scope: `SkyLensServerless/components/viewer/viewer-shell.tsx` and directly touched unit/e2e coverage under `SkyLensServerless/tests/`.
- Out of scope: landing/settings/mobile-shell refactors unless required by a viewer-shell fix, route/storage/config changes, new modal infrastructure, and unrelated visual cleanup.
- Treat `/workspace/SkyLens/SkyLensServerless` as the authoritative package. The duplicated root-level app tree remains comparison-only.

## Current codebase state
- The requested UX foundation is already landed: compact full-height mobile sheets, outside-click dismissal for allowed overlays, shared next-step guidance, shared banner resolution, and reduced desktop hierarchy.
- The current run intent is narrower than the earlier completion slice: review the five viewer-shell review comments, keep only the valid ones, and implement only those fixes.
- Current code inspection shows the likely valid review items are:
  - banner selection can hide critical non-primary warnings inside overflow because any actionable item becomes primary
  - the desktop primary-action `kind` uses redundant nullish coalescing after an `actionId` guard
  - the focus-trap helper uses a narrow selector and only filters `[hidden]`, so hidden or non-interactive nodes can still be considered focusable
  - alignment opener surface inference currently depends on `document.activeElement`, which is unreliable for mobile tap flows
  - focus-restore target validation only checks connection and `disabled`, so hidden or non-focusable nodes can still be chosen
- The authoritative package is not currently bootstrapped in this workspace snapshot: `/workspace/SkyLens/SkyLensServerless/node_modules/.bin/vitest` and `./node_modules/.bin/playwright` are both absent and must be restored before implement/test phases treat runner failures as product failures.

## Execution target for this run
- Preserve the existing UX contract and scope fixes to the validated review items inside `viewer-shell.tsx` plus direct regression coverage.
- Keep the single-primary-banner model, but preserve "No motion" or equivalent motion-loss/pending warnings as a separate always-visible compact notice rather than burying them in overflow.
- Replace inference-by-`document.activeElement` for alignment openers with explicit opener/surface capture from the invoking control so touch interactions restore focus predictably.
- Use one shared focusability/visibility predicate for both focus trapping and dismissal focus restore so hidden, inert, or non-focusable targets are excluded consistently.
- Treat package bootstrap as a prerequisite for later phases, not as the product fix itself.

## Single completion phase

### Finalize the review-validated viewer-shell fixes
- Bootstrap only the authoritative nested package before acceptance validation:
  - install JS dependencies in `/workspace/SkyLens/SkyLensServerless`
  - verify local `vitest` and `playwright` binaries resolve from `./node_modules/.bin/`
  - provision Playwright Chromium assets only if the package-local command reports them missing
- Apply only the review findings that remain valid after code inspection:
  - protect critical motion-related warnings from disappearing behind banner overflow by keeping one compact persistent notice visible alongside the single primary banner
  - remove the redundant nullish coalescing in the guarded desktop primary-action `kind`
  - tighten focusable-element discovery to actual tabbable/focusable, visible elements used by the overlay panels
  - pass explicit opener/surface context into alignment-opening paths instead of relying on `document.activeElement`
  - tighten focus-restore eligibility so dismiss paths never target hidden or non-focusable nodes
- Keep all changes local to the existing seams:
  - `resolveViewerBannerFeed(...)` for banner priority and any pinned compact-warning metadata if needed
  - `viewer-shell.tsx` for alignment opener plumbing, compact warning presentation, and focus restore/trap integration
  - direct regression tests in `SkyLensServerless/tests/unit/viewer-shell*.test*` and touched e2e flows only if the viewer rendering contract changes
- Do not reopen retired fullscreen mobile overlays, add new shared infrastructure, or split banner logic back into separate desktop/mobile decision trees.

## Interfaces and local contracts
- `resolveViewerBannerFeed(...)`
  - Remains the shared banner-priority source for desktop and mobile.
  - May grow one local optional field for a compact persistent warning if that is the smallest way to keep motion-loss/pending warnings always visible without reintroducing multiple primary banners.
  - Must stay deterministic for identical inputs.
- `viewer-shell.tsx`
  - Continues to own overlay dismiss policy, focus restoration, and layout-specific rendering.
  - Alignment openers should accept explicit opener context or derive it from the invoking event target, not from ambient document focus alone.
  - Focus trap and focus restore should use the same visibility/focusability rules.
  - Preserve stable selectors already used by tests, especially `mobile-viewer-overlay*`, `mobile-alignment-overlay*`, `settings-sheet-*`, `alignment-start-action`, `viewer-top-warning-stack`, `desktop-open-viewer-action`, and `mobile-align-action`.

## Compatibility and regression notes
- No public route, config, storage, or workflow contract change is planned.
- The only intentional behavior adjustment in this run is visibility handling for compact motion warnings and focus-target correctness; the one-primary-action banner model remains intact.
- The main regression surfaces are mobile tap alignment flows, overlay focus restoration after close, and banner visibility parity across desktop/mobile.

## Validation approach
- Environment prerequisite
  - Bootstrap `/workspace/SkyLens/SkyLensServerless` first so `./node_modules/.bin/vitest` and `./node_modules/.bin/playwright` exist locally.
  - If Playwright Chromium is missing after dependency install, provision it in the same package context before reading e2e failures as product behavior.
- Unit
  - `./node_modules/.bin/vitest run tests/unit/viewer-shell-resolvers.test.ts`
  - `./node_modules/.bin/vitest run tests/unit/viewer-shell.test.ts`
- E2E
  - Rerun only if the final viewer-shell change affects rendered viewer behavior beyond unit coverage:
    `./node_modules/.bin/playwright test tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts tests/e2e/landing.spec.ts --project=chromium`
- Required assertions
  - one primary banner remains actionable by default while motion-loss or motion-pending warnings stay visible in a compact form
  - critical non-primary warnings do not silently disappear behind collapsed overflow when the UX contract requires them to remain visible
  - alignment opened from mobile controls or touch-driven banner/actions restores focus to the correct surviving mobile control
  - focus trapping ignores hidden/non-visible nodes and focus restoration rejects hidden/non-focusable targets
  - outside-click and `Escape` dismissal behavior for the existing overlays remains unchanged

## Risk register
- Scope-drift risk: the current request is review-validation, not a general UX refresh. Control by limiting edits to the five reviewed behaviors and direct regression tests.
- Banner-clutter risk: fixing hidden warnings could accidentally reintroduce stacked banners. Control by keeping one primary banner and using only a very compact persistent warning for required motion visibility.
- Mobile misclassification risk: using ambient document focus for opener inference can still misroute restore targets on touch devices. Control by plumbing explicit opener/surface context from the invoking control.
- Focus-regression risk: separate trap and restore predicates can diverge again. Control by sharing one DOM-level visibility/focusability rule.
- Workspace/setup risk: missing package-local binaries can still produce false product failures. Control by bootstrapping `/workspace/SkyLens/SkyLensServerless` before implement/test validation.
