# Implement ↔ Code Reviewer Feedback

- Task ID: scope-mode-review-fixes-r2-20260410
- Pair: implement
- Phase ID: scope-mode-parity-review-fixes
- Phase Directory Key: scope-mode-parity-review-fixes
- Phase Title: Restore scope-mode parity ownership and regression coverage
- Scope: phase-local authoritative verifier artifact

- IMP-001 (`blocking`): AC-7 is not met because `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts` still contains a failing test (`keeps focused aircraft trails aligned with aircraft markers in normal view`) and the validation evidence relies on a filtered `-t` subset rather than a passing touched celestial suite. This leaves required regression closure incomplete for the requested scope-mode review fixes. Minimal fix direction: make the touched celestial suite deterministic and passing (or isolate/repair the hanging test with a clear root-cause fix) and rerun the full touched viewer celestial + scope-runtime commands.

- IMP-002 (`blocking`): [SkyLensServerless/lib/vendor/satellite.ts](/workspace/SkyLens/SkyLensServerless/lib/vendor/satellite.ts) was changed even though this file is outside the approved in-scope phase surfaces for scope-mode parity fixes. This introduces unrelated production-path risk (satellite propagation import surface) without dedicated motion-path regression validation in this phase. Minimal fix direction: revert this file in this phase, or explicitly scope/justify it as a separate change with targeted satellite motion tests.
