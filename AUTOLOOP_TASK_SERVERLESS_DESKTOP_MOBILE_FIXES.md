# SkyLensServerless Desktop Declutter + Mobile Navigation + Direct API Task

## Scope
Apply all changes **only** inside `SkyLensServerless/` unless a shared test harness absolutely requires otherwise.

## Mandatory requirements
1. **Remove corsproxy usage**
   - Do not use `corsproxy.io` anywhere in SkyLensServerless.
   - Use direct API calls instead (target API supports CORS).
   - Update all affected code paths and tests.

2. **Desktop clutter reduction**
   - Current PC screen is extremely cluttered; simplify it.
   - Desktop should mimic the cleaner mobile-style control density and information hierarchy.

3. **Desktop mouse behavior parity with mobile crosshair**
   - On desktop, mouse/reticle interaction should behave like mobile cross semantics.
   - Hovering over an object should surface its information clearly.

4. **Compact warning banner at top**
   - Motion and related warning banners must be significantly more compact.
   - Place warning UI at the top of the screen.

5. **Desktop controls should mirror simplified mobile actions**
   - Ensure desktop prominently exposes streamlined controls:
     - Open Viewer
     - Enable Camera
     - Motion
     - Align

6. **Fix mobile navigation**
   - Resolve current mobile navigation issues.
   - Keep mobile UX stable and usable.

7. **Do not break mobile view**
   - Desktop improvements must not regress mobile layout or behavior.
   - Add or update tests to cover desktop changes and mobile regression protection.

## Execution requirements
- Use autoloop with **plan, implement, test** pairs.
- Iterate until complete.
- Prefer focused, minimal-risk edits and preserve existing behavior where not explicitly changed.

## Acceptance checklist
- [ ] No `corsproxy.io` usage remains in SkyLensServerless.
- [ ] Desktop UI is visibly less cluttered and aligned to mobile simplicity.
- [ ] Desktop hover over objects shows information.
- [ ] Warning banner is compact and top-positioned.
- [ ] Desktop has Open Viewer / Enable Camera / Motion / Align actions.
- [ ] Mobile navigation is fixed.
- [ ] Mobile view remains intact (no regressions).
- [ ] Relevant tests updated/added and passing.
