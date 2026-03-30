# Implementation Notes

- Task ID: skylensserverless-ux-implementation
- Pair: implement
- Phase ID: desktop-hierarchy-and-regression
- Phase Directory Key: desktop-hierarchy-and-regression
- Phase Title: Desktop hierarchy reduction and regression hardening
- Scope: phase-local producer artifact
- Files changed:
  `SkyLensServerless/components/landing/landing-screen.tsx`
  `SkyLensServerless/components/viewer/viewer-shell.tsx`
  `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  `SkyLensServerless/tests/e2e/landing.spec.ts`
  `SkyLensServerless/tests/e2e/demo.spec.ts`
- Symbols touched:
  `LandingScreen`
  `ViewerShell`
  `DesktopActionButton`
  `CompactTopBanner`
- Checklist mapping:
  Milestone 3 / landing hierarchy reduction: completed.
  Milestone 3 / desktop viewer warning and header hierarchy reduction: completed.
  Milestone 3 / touched regression coverage updates: completed for desktop unit assertions and desktop-facing e2e expectations; existing dismissal/focus/banner/mobile suites remain the regression surface.
- Assumptions:
  Keeping all existing privacy/build facts on landing is preferable to deleting them, as long as the live-viewer CTA remains the dominant path and the support chrome is visually quieter.
- Preserved invariants:
  Live and demo entry paths remain `/view` and the existing demo route.
  Existing mobile overlay, settings-sheet, and alignment test ids remain unchanged.
  `desktop-open-viewer-action` remains queryable for focus restoration even though the header now resolves one dominant next action first.
- Intended behavior changes:
  Landing now presents a smaller hero with one clear primary CTA card and a quieter privacy/build support column.
  Desktop viewer header now emphasizes a compact current-status summary plus one dominant next-action card, with the remaining controls demoted to a secondary row.
  Desktop top banners use a slightly reduced width/weight so the prioritized primary banner does not overpower the header.
- Known non-changes:
  No mobile overlay layout changes in this phase-local turn.
  No changes to settings-sheet dismissal/focus behavior in this phase-local turn.
  No new resolver logic beyond desktop consumption and hierarchy presentation.
- Expected side effects:
  Desktop tests that previously expected `Open viewer` inside the secondary actions row must now read that CTA from the new dominant next-action card when opening the viewer is the recommended step.
- Validation performed:
  `npx vitest run tests/unit/viewer-shell-resolvers.test.ts tests/unit/alignment-tutorial.test.ts tests/unit/settings-sheet.test.tsx --reporter verbose`
  `npx vitest run tests/unit/viewer-shell.test.ts -t "keeps desktop chrome compact until the viewer panel is explicitly opened|uses hover for desktop summary focus without clearing explicit selection details" --reporter verbose --testTimeout 15000`
  `npx eslint components/landing/landing-screen.tsx components/viewer/viewer-shell.tsx tests/unit/viewer-shell.test.ts tests/e2e/landing.spec.ts tests/e2e/demo.spec.ts`
  `npx playwright test tests/e2e/landing.spec.ts tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts` failed in this environment because Playwright Chromium could not start: missing shared library `libatk-1.0.so.0`.
- Deduplication / centralization decisions:
  Kept the desktop hierarchy changes local to `viewer-shell.tsx` by deriving the next-action card from the existing shared banner/alignment state instead of introducing a new cross-file desktop resolver.
