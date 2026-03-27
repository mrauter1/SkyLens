# Implement ↔ Code Reviewer Feedback

- Task ID: skylens-alignment-ux-mobile-camera-hardening-tas-ebd05595
- Pair: implement
- Phase ID: viewer-alignment-ux-hardening
- Phase Directory Key: viewer-alignment-ux-hardening
- Phase Title: Harden live alignment flow and mobile viewer interaction
- Scope: phase-local authoritative verifier artifact

- IMP-001 | blocking | `components/viewer/viewer-shell.tsx` mobile live-overlay branch (`shouldUseCompactNonScrollingOverlay`): the live-camera overlay now flips the shell from `overflow-y-auto` to `overflow-hidden` but keeps the same full stack of sections (status badges, banners, alignment panel, celestial summary, center object, selected object, privacy copy). On shorter mobile viewports, the lower content becomes clipped and unreachable because there is no replacement compact layout or pagination. The task requires a non-scrolling AR flow, but not an inaccessible one. Minimal fix: redesign the live-camera overlay content for the non-scrolling shell so it fits within the viewport, or trim that branch down to only the essential controls/status that are meant to remain reachable during active AR use.
- IMP-002 | non-blocking | Cycle 2 re-review: `IMP-001` appears resolved. The live-camera overlay now renders a dedicated compact branch (`mobile-viewer-overlay-compact-content`) instead of the old long-form stack, while demo/blocked/non-camera overlay paths keep their fuller scrollable content. No additional findings in this pass.
