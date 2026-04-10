# Test Author ↔ Test Auditor Feedback

- Task ID: scope-mode-parity-skylensserverless-20260410
- Pair: test
- Phase ID: restore-scope-mode-parity
- Phase Directory Key: restore-scope-mode-parity
- Phase Title: Restore scope marker and label parity
- Scope: phase-local authoritative verifier artifact

- Added/refined scope-parity coverage in `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts` and `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx` for non-bright scope center-lock/highlight parity, scope label/top-list parity, daylight-suppression override parity, scope-only sizing, and preserved main-view deep-star behavior.
- Validation run: `npm test -- --run tests/unit/viewer-shell-celestial.test.ts -t "keeps non-bright scope center-lock winners and lens markers aligned with normal-view classes|uses the widened scope marker set for on-object labels in scope mode|keeps scope daylight-suppression overrides aligned with the centered label path|includes non-bright scope objects in scope-mode top-list candidates"` and `npm test -- --run tests/unit/viewer-shell-scope-runtime.test.tsx -t "sizes non-bright scope lens markers with scope optics instead of the wide-stage fov|lets main-view deep stars participate in center-lock and on-object labels without scope mode|renders visible normal-view deep stars on canvas while preserving center-lock and label membership"` both passed.

## Test additions

- Added explicit scope daylight-suppression override coverage for a daylit focus-only planet in `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`.
- Verified the widened scope marker, label/top-list, center-lock, and sizing coverage by rerunning:
  - `npm test -- tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`
- Result: `2` files passed, `65` tests passed.

## Audit findings

- `TST-001` `blocking`: The targeted regression suite is not currently reliable enough to serve as an accepted guardrail. On the independent audit run of `npm test -- tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`, `tests/unit/viewer-shell-celestial.test.ts` timed out in `renders a trail for balanced motion quality` and `renders the satellite detail-card contract and ISS badge state`, leaving the suite red (`1` failed file, `2` failed tests). This means the phase cannot claim stable regression protection yet, because unrelated timeouts can mask or block parity regressions. Minimal fix direction: stabilize those long-running `viewer-shell-celestial` cases for this targeted run path by isolating timing-sensitive waits or increasing per-test stability/timeout control so the full parity command passes deterministically.
- `TST-002` `blocking`: The reliability issue also reproduces directly inside the new scope-parity coverage. On the independent audit rerun of `npm test -- --run tests/unit/viewer-shell-celestial.test.ts -t "keeps non-bright scope center-lock winners and lens markers aligned with normal-view classes|uses the widened scope marker set for on-object labels in scope mode|keeps scope daylight-suppression overrides aligned with the centered label path|includes non-bright scope objects in scope-mode top-list candidates"`, the changed test `includes non-bright scope objects in scope-mode top-list candidates` timed out at 5s while the same overall file later passed on a broader rerun. That nondeterminism means the new regression guardrail itself is timing-sensitive and can intermittently fail before asserting the intended parity behavior. Minimal fix direction: remove timing sensitivity from the new scope top-list case by reducing async work in its setup or giving the parity-focused cases an explicit timeout/stabilized wait path consistent with the rest of the suite.
