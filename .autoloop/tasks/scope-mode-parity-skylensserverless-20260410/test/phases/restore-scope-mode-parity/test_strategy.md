# Test Strategy

- Task ID: scope-mode-parity-skylensserverless-20260410
- Pair: test
- Phase ID: restore-scope-mode-parity
- Phase Directory Key: restore-scope-mode-parity
- Phase Title: Restore scope marker and label parity
- Scope: phase-local producer artifact

## Behavior to coverage map
- Scope non-bright parity:
  `viewer-shell-celestial.test.ts` covers non-bright aircraft participation in scope center-lock, lens marker rendering, and active styling.
- Scope label/top-list parity:
  `viewer-shell-celestial.test.ts` covers on-object labels and top-list candidates including aircraft and satellites in scope mode.
- Scope daylight suppression parity:
  `viewer-shell-celestial.test.ts` covers a daylight-suppressed planet remaining eligible when center-locked in scope mode and verifies both wide-stage and scope-lens marker paths for the shared override behavior.
- Scope optics-specific sizing:
  `viewer-shell-scope-runtime.test.tsx` covers a non-bright satellite receiving larger scope-lens sizing than the wide-stage marker under magnified scope optics.
- Preserved normal-view deep-star behavior:
  `viewer-shell-scope-runtime.test.tsx` covers main-view deep stars continuing to participate in center-lock, on-object labels, and canvas rendering while scope mode is off.

## Edge cases
- Mixed-class scope marker sets with aircraft, star, and satellite inputs.
- Daylight-suppressed celestial objects that should still surface through center-lock override semantics.
- Lens-only sizing differences for non-bright motion objects under high scope magnification.

## Failure paths / stabilization
- Scope parity tests use demo-mode fixtures and mocked fetch/catalog responses to avoid live timing and network nondeterminism.
- Validation is focused on request-scoped examples because the broader celestial suite has an unrelated intermittent timeout in one satellite detail-card test; isolated reruns were used to confirm no scope-parity regression was normalized.

## Known gaps
- No separate selected-object override test was added for a non-centered daylit scope object because the current viewer test harness does not expose a deterministic preselection hook for an object that is intentionally hidden until selected.

## Behavior-to-test coverage map
- AC-1 marker-class parity + shared override semantics:
  - `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
  - Covers non-bright aircraft participation in scope center-lock/lens markers.
  - Covers scope-mode daylight suppression override via a daylit focus-only planet that still reaches center-lock and the lens marker path.
- AC-2 scope-projection-derived lens markers + labels/top-list:
  - `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
  - Covers scope on-object labels using the widened scope marker set.
  - Covers scope top-list membership including aircraft, satellite, and star entries.
- AC-3 non-bright active lens styling:
  - `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
  - Covers a non-bright aircraft winning scope center-lock and receiving the active lens marker class.
- AC-4 preserved wide-context / normal-view behavior:
  - `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
  - Confirms wide-stage marker highlighting remains on the wide winner while scope lens behavior changes.
  - `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Reuses existing main-view deep-star participation tests to ensure normal-view behavior remains intact.
- AC-5 profile-specific sizing + deep-star regression guard:
  - `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Covers non-bright scope lens marker sizing against the wide-stage FOV baseline.
  - Reuses existing non-scope deep-star center-lock / label / top-list tests as regression coverage.

## Preserved invariants checked
- Scope lens overlay still uses scope projection and scope-FOV sizing.
- Wide-stage rendering remains separate from scope lens rendering.
- Normal-view deep-star participation remains covered when scope mode is off.

## Edge cases
- Non-bright in-lens aircraft center-lock winner.
- Daylit focus-only object surviving via center-lock override in scope mode.
- Mixed-class scope top-list candidates with aircraft, satellite, and star entries.

## Failure-path / regression coverage
- Prevent regression to the prior bright-only scope marker gate.
- Prevent regression where non-bright scope winners lose active lens styling.
- Prevent regression where scope lens sizing silently reuses the wide-stage FOV for non-bright markers.

## Stabilization notes
- Tests use deterministic mocked celestial, aircraft, and satellite objects rather than live catalogs.
- Scope dataset fetches are mocked or intentionally rejected to avoid network flake and keep assertions local to viewer-shell behavior.

## Known gaps
- No pixel-diff coverage for the visual appearance of the scope overlay; tests stay at deterministic DOM/class/size assertions.
