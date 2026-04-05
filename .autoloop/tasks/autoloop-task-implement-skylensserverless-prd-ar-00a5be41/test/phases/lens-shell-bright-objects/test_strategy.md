# Test Strategy

- Task ID: autoloop-task-implement-skylensserverless-prd-ar-00a5be41
- Pair: test
- Phase ID: lens-shell-bright-objects
- Phase Directory Key: lens-shell-bright-objects
- Phase Title: Lens Shell And Bright Scope Pass
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- AC-1 / centered circular lens geometry and alignment-focus suppression
  - `tests/unit/scope-lens-overlay.test.tsx`
    - verifies fixed frame sizing, circular `clip-path`, pointer-active hit area, and no focusable descendants
  - `tests/unit/viewer-shell.test.ts`
    - verifies the lens renders at the expected centered diameter and is removed when explicit mobile alignment focus starts

- AC-2 / inside-lens occlusion-shielding with outside-lens behavior preserved
  - `tests/unit/scope-lens-overlay.test.tsx`
    - verifies the interactive layer is clipped to the visible circle rather than the square frame
  - `tests/unit/viewer-shell-celestial.test.ts`
    - verifies scope markers render inside the lens while the wide aircraft marker outside the lens keeps its original focused styling when scope center-lock switches to a bright scope object
    - verifies `on_objects` label highlighting still stays on the wide aircraft winner even when the desktop active summary switches to the scope bright star
    - verifies the lens overlay renders after the wide constellation line, marker, and label nodes so the lens can visually occlude base-scene content inside the scope area

- AC-3 / bright-object second projection pass and scope center-lock precedence
  - `tests/unit/viewer-shell-celestial.test.ts`
    - verifies scope mode switches the centered readout from a wide-only aircraft winner to a bright scope star and still renders scope bright markers

## Preserved invariants checked

- Wide-scene highlight/order state remains tied to the wide center-lock candidate outside the lens.
- Wide-scene on-object label highlighting remains tied to the wide center-lock candidate even when scope readout precedence switches.
- The scope overlay stays non-focusable and display-only.
- Mobile alignment focus continues to suppress the scope lens.

## Edge cases covered

- Scope enabled with a wide-only candidate still centered outside the lens.
- Scope enabled with `labelDisplayMode: on_objects` while the scope bright-object pass wins the centered summary.
- Circular hit-region assertion after the square-hit-box regression fix.
- Lens-under-wide-stack regression coverage via DOM-order assertions on the rendered overlay versus wide scene nodes.
- Live/mobile alignment transition while scope is already enabled.

## Failure-path / stability notes

- Validation is intentionally targeted because `tests/unit/viewer-shell-celestial.test.ts` contains broader pre-existing failures outside this phase surface.
- All covered tests are deterministic, DOM-only unit tests with mocked sensor/camera dependencies and no network reliance.

## Known gaps

- No end-to-end browser hit-testing assertion for pointer shielding; unit coverage relies on the circular `clip-path` contract plus preserved outside-lens marker styling.
- Deep-scope tiles, dense star canvas, and named deep-star precedence remain out of scope for this phase.
