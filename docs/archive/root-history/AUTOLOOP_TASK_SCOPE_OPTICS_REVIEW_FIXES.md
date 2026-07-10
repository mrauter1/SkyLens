# Autoloop Task: Scope optics review fixes (SkyLensServerless)

## Objective
Analyze the provided PR review comments for correctness and applicability, then apply all applicable suggestions to the codebase while preserving agreed product behavior.

## Required process
- Use plan, implement, and test pairs.
- Use full auto answers.
- Do NOT set max_iterations.
- Apply only applicable suggestions; explicitly reject non-applicable ones with rationale in task artifacts.

## Review items to analyze and apply when applicable
1. **Robustness in `lib/viewer/scope-optics.ts`**
   - Normalize scope optics inputs inside exported functions (`computeLimitingMagnitude`, `computeStarPhotometry`, and any public helper that depends on optics values) so invalid values cannot produce NaN via `Math.log10`.
   - Reuse normalization from settings domain (`normalizeScopeOpticsSettings`) or equivalent safe boundary normalization.

2. **Extract large inline JSX scope star marker rendering in `components/viewer/viewer-shell.tsx`**
   - Refactor the large conditional JSX block into a dedicated component (e.g. `ScopeStarMarker`) or clear helper render function(s) to improve readability and maintainability.

3. **Metadata validation for scope render data in `viewer-shell.tsx`**
   - Evaluate using Zod schema for `scopeRender` extraction/parsing.
   - Apply if it improves robustness and consistency with existing project patterns.

4. **Remove type duplication**
   - Replace inline scope optics shape types with shared `ScopeOpticsSettings` type where applicable.

5. **Centralize scope optics range constants**
   - Define and export shared constants (e.g., `SCOPE_OPTICS_RANGES`) in `lib/viewer/settings.ts` near defaults.
   - Reuse these constants in normalization, settings UI sliders, and viewer quick-control sliders to avoid drift.

6. **Address functional gap from review bot**
   - Ensure aperture/magnification controls are available in non-mobile/desktop path as well, not only mobile quick actions.
   - Keep agreed placement semantics: quick controls context should allow tuning in both mobile and desktop experiences when scope mode is on.

## Constraints to preserve
- Keep existing likely-visible logic unchanged.
- Scope optics remains a separate additional stage.
- Marker-scale remains in Settings (not mobile quick controls).
- Transparency remains in Settings.
- Backward compatibility for persisted settings.

## Testing requirements
- Add or update unit/integration tests covering:
  - optics normalization robustness against invalid inputs,
  - centralized range reuse,
  - desktop and mobile availability of aperture/magnification controls when scope mode is enabled,
  - refactor parity for scope star rendering,
  - any schema validation behavior changes.
- Run targeted tests and then full relevant suite for touched areas.

## Deliverables
- Code changes implementing applicable suggestions.
- Updated tests.
- Autoloop artifacts documenting applicability decisions.
