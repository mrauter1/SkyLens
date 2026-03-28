# Implementation Notes

- Task ID: skylens-serverless-migration-and-equivalence-tas-1962bcf4
- Pair: implement
- Phase ID: verify-parity-and-document
- Phase Directory Key: verify-parity-and-document
- Phase Title: Verify feature parity and document the migration
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/PARITY.md`
- `SkyLensServerless/lib/config.ts`
- `SkyLensServerless/tests/e2e/demo.spec.ts`
- `SkyLensServerless/tests/e2e/landing.spec.ts`
- `SkyLensServerless/tests/unit/config-contract.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`

## Symbols touched
- `PRIVACY_REASSURANCE_COPY`

## Checklist mapping
- Plan 3 parity documentation: added `SkyLensServerless/PARITY.md` mapping each original server-side surface to its serverless replacement and validation path.
- Plan 3 provider/path validation: updated the fork-local reassurance copy and assertions so the selected satellite relay path is explicitly disclosed to users.
- Plan 3 build/test verification: validated the fork with unit, e2e, and production-build commands.

## Assumptions
- The configured TLE template always represents a browser-safe relay in front of CelesTrak because the implementation requires a `{url}` placeholder and defaults to `corsproxy.io`.

## Preserved invariants
- Root-app files remain untouched.
- Aircraft privacy copy still reflects direct browser-to-OpenSky requests.
- Viewer and landing surfaces consume a single shared reassurance-copy export to avoid drift.

## Intended behavior changes
- The landing page and viewer now disclose that live satellite catalogs are fetched through a configured browser-safe relay before reaching CelesTrak.

## Known non-changes
- No UI layout, payload schema, or provider implementation changed in this phase.
- No new root-app documentation or tests were added.

## Expected side effects
- User-visible privacy/data-flow messaging is more explicit about the serverless satellite path.

## Validation performed
- `cd /workspace/SkyLens/SkyLensServerless && npm test`
- `cd /workspace/SkyLens/SkyLensServerless && npm run test:e2e`
- `cd /workspace/SkyLens/SkyLensServerless && npm run build`
- Installed the local Playwright Chromium bundle plus the missing Linux runtime libraries required by this container before rerunning `npm run test:e2e`.

## Deduplication / centralization decisions
- Kept the privacy/data-flow statement centralized in `lib/config.ts` so landing and viewer assertions both verify the same compatibility surface.
