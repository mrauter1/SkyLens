# Implement ↔ Code Reviewer Feedback

- Task ID: desktop-ui-prd-ard-implementation
- Pair: implement
- Phase ID: shared-dismiss-contract
- Phase Directory Key: shared-dismiss-contract
- Phase Title: Standardize outside-click, Escape-close, and focus restore
- Scope: phase-local authoritative verifier artifact

- IMP-000 (`non-blocking`): No review findings. The implementation matches the phase contract: the settings sheet, mobile viewer overlay, and mobile alignment overlay now share the same dismiss/focus primitives, the targeted Escape/backdrop/inside-click/focus-restore tests pass, and the helper extraction stays within the accepted "minimal shared dismiss/focus handling" scope.
