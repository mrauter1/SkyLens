# Test Strategy

- Task ID: skylensserverless-follow-up-fixes-task-fixes-1-a-1fc787a5
- Pair: test
- Phase ID: static-export-contract
- Phase Directory Key: static-export-contract
- Phase Title: Enforce static-only deployment contract
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- Static export contract:
  `tests/unit/next-config.test.ts` checks `output: 'export'` and verifies the checked-in `public/_headers` artifact matches the exported permissions-policy contract.
- Static preview workflow:
  `tests/unit/bootstrap-standalone-fork.test.ts` checks the repo-local `start` script contract and guards against reintroducing TypeScript-only syntax into the runtime preview file.
- Exported header parity happy path:
  `tests/unit/serve-export.test.ts` boots the preview server against a temporary `out/` fixture and asserts `/embed-validation` returns the preserved `Permissions-Policy` header.
- Exported file-serving failure path:
  `tests/unit/serve-export.test.ts` asserts path traversal attempts do not resolve outside the export directory.

## Preserved invariants checked

- The live permissions-policy value stays unchanged across `next.config.ts`, `public/_headers`, and the preview server.
- The preview workflow remains repo-local and does not rely on `next start`.

## Edge cases and stabilization

- Preview-server tests use temporary export directories instead of the repo-tracked `SkyLensServerless/out/` tree to avoid hash churn and keep setup deterministic.
- The preview server binds to an ephemeral port in tests and is explicitly closed in teardown to avoid port collisions and leaked handles.

## Known gaps

- The strategy relies on implementation-phase runtime validation for full `npm run build` and `npm run start` smoke coverage; this phase adds deterministic unit coverage around the preview-server contract rather than duplicating the full shell-level smoke flow.
