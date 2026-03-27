# Test Author ↔ Test Auditor Feedback

- Task ID: fix-viewer-and-alignment-overlays-on-mobile-1-op-f01d6bdb
- Pair: test
- Phase ID: mobile-viewer-overlay-and-alignment-actions
- Phase Directory Key: mobile-viewer-overlay-and-alignment-actions
- Phase Title: Fix mobile viewer overlay scrolling and first-use alignment actions
- Scope: phase-local authoritative verifier artifact

## Test additions

- Refined `tests/unit/viewer-shell.test.ts` with an extra mobile regression case for the granted-but-pre-sample state so `Align` stays visible but disabled even after camera and motion permissions are already granted.
- Confirmed the existing mobile viewer-shell tests already cover the safe-area scroll wrapper, explicit alignment-focus entry, first-use permission CTA visibility, and the actionable focus-first align path.
- Test execution remains blocked in this workspace because `vitest` is unavailable and `node_modules` is missing.

- Added/confirmed `viewer-shell.test.ts` coverage for:
  the safe-area mobile overlay scroll-region contract,
  disabled first-use `Align` visibility before a live sample exists,
  actionable closed-footer `Align` entering focus without calibrating on the first tap,
  and explicit mobile alignment focus hiding nonessential chrome.
- Documented the full AC-to-test mapping, edge cases, failure paths, preserved invariants, and the current local test-execution gap in `test_strategy.md`.

## Audit findings

- TST-001 (`non-blocking`) `decisions.txt`, `test_strategy.md`: the tests now correctly enforce the visible-but-disabled pre-sample contract plus the focus-first actionable path, but `decisions.txt` still contains an older conflicting implementer note (`block_seq=4`) that says the closed-footer `Align` CTA should stay clickable before a live sample exists. That ledger inconsistency does not make the current tests incorrect, but it is drift risk for future test updates.

## Audit status

- No blocking test-coverage findings.

## Current audit pass

- No new findings. The current viewer-shell tests and test strategy cover the safe-area overlay contract, explicit alignment-focus behavior, pre-sample visible-but-disabled align states, and the actionable focus-first align path without normalizing the conflicting implementer-only ledger note.
