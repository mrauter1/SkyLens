# Implement ↔ Code Reviewer Feedback

- Task ID: skylensserverless-prd-ard-rerun
- Pair: implement
- Phase ID: scope-realism-slice
- Phase Directory Key: scope-realism-slice
- Phase Title: Scope realism settings, optics, and star rendering
- Scope: phase-local authoritative verifier artifact

- IMP-001 `blocking` — `SkyLensServerless/lib/viewer/settings.ts` (`SettingsSchema` / `readViewerSettings`): the new persisted `scopeOptics` path still routes through a strict Zod parse before normalization, so malformed stored values like `scopeOptics: { apertureMm: "120" }` or `scopeModeEnabled: "true"` throw and reset the entire viewer payload back to defaults instead of preserving unrelated settings and sanitizing the bad optics fields. That conflicts with AC-1 / the accepted plan’s backward-compatible malformed-input normalization goal and creates a concrete data-loss regression for partially corrupted or manually edited localStorage entries. Minimal fix: loosen the schema for the new scope fields to accept `unknown`/nullable compatibility input and sanitize them after parse via `normalizeScopeOptics` plus explicit boolean handling, rather than letting those fields invalidate the whole settings object.
- Review cycle 2: verified `IMP-001` is fixed in `SkyLensServerless/lib/viewer/settings.ts`, including a regression test for malformed persisted scope fields; no remaining blocking or non-blocking findings in scope.
