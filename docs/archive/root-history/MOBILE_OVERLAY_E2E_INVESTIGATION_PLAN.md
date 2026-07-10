# Mobile Overlay E2E Investigation + Fix Plan

## Context
Recent mobile UI changes intentionally collapsed all non-stage viewer chrome behind a bottom trigger (`Open viewer`). Existing Playwright specs still assert direct visibility of content that is now hidden until the overlay opens.

## Observed Failures (from latest Playwright run)
1. `tests/e2e/demo.spec.ts`
   - Expects `Demo mode is active.` visible immediately after navigation.
   - Expects `Settings` button directly visible.
2. `tests/e2e/landing.spec.ts`
   - After demo navigation, expects `Demo mode is active.` directly visible.
3. `tests/e2e/permissions.spec.ts`
   - Expects blocking/fallback copy and actions directly visible without expanding overlay.

## Root-Cause Hypothesis
- **Primary:** E2E tests are stale relative to the new mobile overlay model.
- **Secondary:** Selectors are text-based and do not model required interaction state (collapsed vs expanded).
- **Validation artifact:** failure snapshots show only stage + `Open viewer` trigger visible by default.

## Investigation Steps
1. Confirm mobile overlay trigger is consistently present in affected routes.
2. Verify overlay expansion reveals expected sections for demo and permission states.
3. Identify all tests assuming directly-visible chrome and classify required updates.
4. Validate whether any truly functional regression exists after opening overlay.

## Fix Strategy
### A) Add robust helper utilities for E2E flows
- Introduce a helper (in e2e tests) to expand mobile overlay when needed:
  - click button by stable test-id `mobile-viewer-overlay-trigger` (preferred) or role fallback.
  - assert expanded state (`mobile-viewer-overlay`) before proceeding.

### B) Update failing specs
1. `demo.spec.ts`
   - Open overlay before asserting `Demo mode is active.` and before interacting with `Settings`.
2. `landing.spec.ts`
   - Open overlay after navigating to demo URL before checking demo banner text.
3. `permissions.spec.ts`
   - Open overlay before checking blocked/fallback copy and action buttons/links.

### C) Harden selectors
- Prefer `data-testid`-anchored queries for overlay container and trigger.
- Keep semantic role assertions for user-facing controls after overlay is open.

### D) Regression + integration validation
- Run full Playwright suite.
- Ensure all 8 e2e tests pass.
- Re-run focused unit tests touching viewer shell to ensure no local regressions.

## Acceptance Criteria
1. `npm run test:e2e` passes all tests.
2. No tests rely on hidden chrome in collapsed state.
3. Existing mobile UX remains unchanged (overlay collapsed by default).
4. Unit tests continue passing for viewer shell behavior.

## Risks / Notes
- If overlay trigger text changes again, role-name assertions may break; mitigate with test-id usage.
- Ensure checks remain valid if desktop assertions are ever added to e2e (current project emulates Pixel 7).
