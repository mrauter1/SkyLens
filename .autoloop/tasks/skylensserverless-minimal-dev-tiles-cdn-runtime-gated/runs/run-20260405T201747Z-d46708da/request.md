# Autoloop Task: Minimal Dev Tiles in Git + CDN/R2 Runtime Fetch with Env Gate and Offline Fallback

Project scope: `SkyLensServerless`.

Implement a new task to adjust scope data delivery strategy:

## Goal
- Keep only a minimal deterministic dev scope tile set in git.
- Fetch full scope tiles from CDN/R2 at runtime.
- Gate CDN/runtime fetch behavior behind env/config.
- Preserve offline fallback behavior.

## Required behavior
1. Keep committed in-repo dataset minimal but valid for local development and deterministic tests.
2. Add runtime config/env switches for remote tile base URL (CDN/R2) and enable/disable remote fetch mode.
3. Runtime should prefer remote full tiles when enabled/configured.
4. Runtime must fallback to local/offline dev data path when remote is disabled, unavailable, or fetch fails.
5. Keep existing PRD/ARD safety constraints where applicable (determinism in dev path, robust contracts, graceful degradation).
6. Update relevant docs/config references and tests.
7. Ensure CI/local tests cover:
   - remote-enabled path
   - remote-disabled fallback
   - error fallback when remote fetch fails.

## Data source context
R2/CDN source to reference:
- https://pub-566fb74233f3432ba4d47900577e552e.r2.dev/scope/v1/names.json

## Execution requirements
- Use autoloop with `plan,implement,test` pairs.
- Use full-auto answers.
- Do NOT set max iterations.
- Do NOT stop/kill process even if it appears halted.
- Do NOT manually implement outside autoloop.

## Definition of done
- Code/test/docs changes implement this delivery model.
- Minimal in-git dev tiles are retained and validated.
- Remote fetch + gated config + offline fallback are working and tested.
