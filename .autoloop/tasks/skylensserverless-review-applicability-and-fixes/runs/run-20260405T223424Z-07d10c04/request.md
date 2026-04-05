# Autoloop Task: Analyze Review Applicability/Correctness and Apply Correct Suggestions

Scope: `SkyLensServerless`

## Objective
Analyze the review feedback below for applicability and technical correctness, then apply only the correct suggestions and validate with tests.

## Review items to evaluate and act on
1. **Memoize `scopeProjectionProfile` in `ViewerShell`**
   - Current pattern:
     ```ts
     const scopeProjectionProfile = createProjectionProfile({
       verticalFovDeg: viewerSettings.scope.verticalFovDeg,
     })
     ```
   - Suggested change: use `useMemo` keyed on `viewerSettings.scope.verticalFovDeg`.

2. **Use lens viewport dimensions for scope tile selection radius**
   - Reported issue: `getScopeTileSelectionRadiusDeg` currently uses full stage viewport (`viewport.width/height`) instead of lens viewport (`scopeLensDiameterPx × scopeLensDiameterPx`), causing underfetch on portrait and overfetch on wide screens.
   - Suggested correction: compute tile selection radius from lens dimensions / 1:1 aspect that matches scope rendering.

## Requirements
- First determine if each review is correct/applicable in current code.
- Apply only correct suggestions.
- Keep behavior parity and avoid regressions.
- Update/add focused tests to cover both decisions and outcomes.
- If a suggestion is not applicable, document why in task artifacts.

## Execution constraints
- Use autoloop with **plan, implement, test** pairs.
- Use **full-auto answers**.
- Do **not** set max iterations.
- Do **not** kill or stop the process even if it appears stalled.
- Do **not** implement manually outside autoloop.

## Done criteria
- Review suggestions have been evaluated for correctness and applicability.
- Correct changes are applied in code.
- Relevant tests pass and guard against regressions.
- Task artifacts clearly record decisions.
