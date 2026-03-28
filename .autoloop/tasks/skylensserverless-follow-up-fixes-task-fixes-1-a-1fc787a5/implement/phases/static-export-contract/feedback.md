# Implement ↔ Code Reviewer Feedback

- Task ID: skylensserverless-follow-up-fixes-task-fixes-1-a-1fc787a5
- Pair: implement
- Phase ID: static-export-contract
- Phase Directory Key: static-export-contract
- Phase Title: Enforce static-only deployment contract
- Scope: phase-local authoritative verifier artifact

- `IMP-001` `blocking` `[SkyLensServerless/scripts/serve-export.mjs]`: The new `start` workflow is currently broken because the runtime `.mjs` file contains TypeScript-only `as const` syntax. Running `node scripts/serve-export.mjs` exits immediately with `SyntaxError: Unexpected identifier 'as'`, so `package.json` now points production/start guidance at a command that cannot boot at all. Minimal fix: make the preview script valid JavaScript for direct Node execution (or switch `start` to a working preview command) and include a focused validation step for `npm run start`.
- `IMP-002` `blocking` `[SkyLensServerless/scripts/serve-export.mjs#createServer, SkyLensServerless/package.json, SkyLensServerless/PARITY.md]`: Even after the syntax issue is fixed, the custom preview server never reads or applies the emitted `out/_headers` rules, so `npm run start` cannot serve the preserved `Permissions-Policy` header that this phase explicitly moved into the repo-owned static-host artifact. That means the documented start/preview workflow does not actually match the exported deployment contract and cannot locally verify header parity. Minimal fix: use a preview mechanism that honors `_headers`, or teach the server to parse/apply the emitted header rules for matching routes and cover that contract in focused validation.
- Review pass `cycle=2 attempt=1`: no new findings. `IMP-001` and `IMP-002` are resolved by the current plain-JS preview server, the `_headers` application logic, the focused `serve-export` coverage, and the recorded `npm run start` header verification.
