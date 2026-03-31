# Implementation Notes

- Task ID: skylensserverless-ux-implementation
- Pair: implement
- Phase ID: guidance-and-banner-resolution
- Phase Directory Key: guidance-and-banner-resolution
- Phase Title: Deterministic next-step and banner resolution
- Scope: phase-local producer artifact
- Files changed:
  `SkyLensServerless/lib/viewer/alignment-tutorial.ts`
  `SkyLensServerless/components/viewer/viewer-shell.tsx`
  `SkyLensServerless/tests/unit/alignment-tutorial.test.ts`
  `SkyLensServerless/tests/unit/viewer-shell-resolvers.test.ts`
  `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- Symbols touched:
  `buildAlignmentTutorialModel`
  `resolveViewerBannerFeed`
  `AlignmentInstructionsPanel`
  `AlignmentInstructionsContent`
  `FallbackBanner`
  `BannerOverflowDisclosure`
- Checklist mapping:
  Milestone 2 / shared next-step and banner resolution: completed for alignment guidance contract, shared banner prioritization, deterministic overflow ordering, and mobile/desktop consumption.
  Milestone 3 desktop hierarchy work: not changed in this phase-local turn.
- Assumptions:
  Keeping `alignment-start-action` visible but disabled in the waiting-for-motion state is part of preserving the existing mobile alignment path while reducing guidance to one primary step.
- Preserved invariants:
  Existing overlay/alignment test ids remain stable.
  Mobile and desktop still differ by layout, not by resolver logic.
  Manual observer panel and blocked-startup panels remain separate from the prioritized banner feed.
- Intended behavior changes:
  Alignment instructions now render one status line, one optional supporting note, and one explicit primary step instead of a multi-notice stack.
  Banner surfaces now show one primary banner by default with deterministic overflow disclosure instead of parallel desktop/mobile condition trees.
  Live non-camera states preserve the camera fallback banner for both `denied` and `unavailable` camera statuses.
  Alignment reset/fine-adjust controls are visually de-emphasized under a secondary calibration-tools section.
- Known non-changes:
  No landing-screen edits in this phase.
  No settings-sheet contract changes in this phase.
- Expected side effects:
  Demo/location/calibration informational banners can move into overflow when a higher-priority actionable banner exists.
- Validation performed:
  `npx vitest run tests/unit/alignment-tutorial.test.ts tests/unit/viewer-shell-resolvers.test.ts`
  `npx vitest run tests/unit/viewer-shell.test.ts -t "surfaces live-panel blocker copy and a disabled start action before the first motion sample"`
  `npx vitest run tests/unit/viewer-shell.test.ts -t "surfaces the relative-sensor warning state and calibration target guidance"`
  `npx vitest run tests/unit/viewer-shell-resolvers.test.ts`
  `npx vitest run tests/unit/viewer-shell.test.ts -t "keeps desktop chrome compact until the viewer panel is explicitly opened"`
  `npx eslint components/viewer/viewer-shell.tsx lib/viewer/alignment-tutorial.ts tests/unit/alignment-tutorial.test.ts tests/unit/viewer-shell-resolvers.test.ts tests/unit/viewer-shell.test.ts`
  `npx eslint components/viewer/viewer-shell.tsx tests/unit/viewer-shell-resolvers.test.ts tests/unit/viewer-shell.test.ts`
  `npx playwright test tests/e2e/permissions.spec.ts` failed before test execution because the configured web server did not start within Playwright's 120000 ms timeout.
  `npx tsc -p tsconfig.json --noEmit` is blocked by existing generated `.next/dev/types/*` parse errors unrelated to these edits.
- Deduplication / centralization decisions:
  Kept banner resolution local to `viewer-shell.tsx` per phase scope, but moved it into one exported pure helper so both surfaces and the new unit tests share the same decision logic.
