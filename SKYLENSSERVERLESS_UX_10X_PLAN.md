# SkyLensServerless UX 10x Plan Intent

## Purpose
This document defines the **full UX improvement intent for SkyLensServerless** based on direct user feedback:
- Desktop banner feels too large/cluttered.
- Settings and overlays should use space better (**full-height**, not full-screen takeover).
- Clicking outside overlays should close them (where safe).
- The UI should show only the **next step**, not everything at once.

The goal is to produce a significantly clearer, faster, lower-cognitive-load experience while preserving mobile stability and accessibility.

---

## Product Intent (Non-negotiable outcomes)
1. **Clarity first**: user always sees a single primary instruction and primary action.
2. **Context preserved**: overlays are sheet-style, not full-screen hard takeovers.
3. **Space used efficiently**: overlays use near full viewport height with sticky structure.
4. **Predictable dismissal**: outside click and Escape behaviors are consistent and intentional.
5. **Desktop decluttered**: hierarchy emphasizes immediate action over decorative/promotional weight.
6. **Regression resistant**: UX behavior is protected by tests and a small UI contract.

---

## Scope
All implementation work for this plan is intended for:
- `SkyLensServerless/components/`
- `SkyLensServerless/lib/`
- `SkyLensServerless/tests/`
- Supporting documentation in repository root or `SkyLensServerless/`.

No unrelated refactors should be included.

---

## Plan Overview (3-phase rollout)

### Phase 1 — Overlay Foundation (layout + close behavior)

#### 1.1 Full-height sheet presentation (not full-screen)
Implement a shared overlay presentation mode that:
- Keeps overlay as a card/sheet with horizontal margins and rounded top.
- Uses near full viewport height (`100dvh` minus safe areas).
- Uses **sticky header**, **scrollable content body**, **sticky action/footer**.
- Supports compact mode for lightweight surfaces.

Primary files:
- `SkyLensServerless/components/ui/compact-mobile-panel-shell.tsx`
- Call sites in:
  - `SkyLensServerless/components/settings/settings-sheet.tsx`
  - `SkyLensServerless/components/viewer/viewer-shell.tsx`

#### 1.2 Unified dismiss policy
Standardize overlay dismissal rules via explicit policy:
- `dismissOnBackdrop`
- `dismissOnEscape`
- `showExplicitClose`

Expected behavior:
- Settings sheet: outside click closes.
- Alignment-critical flows: optional guarded backdrop close if accidental dismissal is risky.
- Escape closes where appropriate.
- Focus always restores to invoking control.

Primary files:
- `SkyLensServerless/components/settings/settings-sheet.tsx`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`

---

### Phase 2 — Cognitive Load Reduction (instruction architecture)

#### 2.1 Next-step decision engine
Create a single resolver for “what user should do now,” returning:
- title
- instruction
- primary CTA (label/handler/enabled)
- optional secondary CTA

Use this resolver to drive both overlay instruction card and top guidance.

Primary files:
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/lib/viewer/alignment-tutorial.ts`

#### 2.2 Banner prioritization and collapse
Prevent stacked warning clutter:
- Show one prioritized actionable banner by default.
- Rank by blocker severity, actionability, freshness.
- Expose additional issues in “More details” disclosure.

Primary file:
- `SkyLensServerless/components/viewer/viewer-shell.tsx`

#### 2.3 Progressive disclosure for advanced controls
Hide non-essential controls by default:
- Keep one primary action visible.
- Move reset, diagnostics, and fine calibration controls to expandable advanced section.

Primary files:
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/components/settings/settings-sheet.tsx`

---

### Phase 3 — Desktop Hierarchy + Durability

#### 3.1 Desktop landing declutter
Adjust desktop visual hierarchy so user immediately sees what to do:
- Reduce hero headline dominance and visual weight.
- Keep one strongest primary CTA.
- Compress trust/privacy content into compact summary with optional expansion.

Primary file:
- `SkyLensServerless/components/landing/landing-screen.tsx`

#### 3.2 UX contract + guardrails
Define and enforce a minimal UI contract:
- One primary CTA per state.
- One primary banner max in default view.
- Full-height sheet structure for major overlays.
- Dismiss behavior consistency.

Primary artifacts:
- New docs file (e.g., `OVERLAY_UX_CONTRACT.md`)
- Tests in `SkyLensServerless/tests/unit/` and targeted e2e updates.

---

## Implementation Rules
1. Do not break mobile behavior while simplifying desktop.
2. Keep accessibility first:
   - focus trap where needed
   - Escape/backdrop semantics
   - visible close affordance
   - keyboard navigability
3. Preserve existing test IDs where practical; if changed, update tests in same PR.
4. Prefer incremental PRs by phase to reduce risk.
5. Avoid adding additional visual noise while introducing new logic.

---

## Validation Strategy

### Unit tests (required)
- Settings sheet outside-click close behavior.
- Panel click should not close.
- Escape close and focus return.
- Next-step resolver returns exactly one primary instruction/action per state.
- Banner prioritization deterministic ordering.

### E2E tests (targeted)
- Mobile overlay open/close with backdrop.
- Settings sheet interaction continuity in compact and full-height sheet modes.
- Alignment flow shows one next step at a time.
- Desktop landing hierarchy smoke checks.

### Manual QA checklist
- Overlay uses full height but remains sheet-like (not full-screen takeover).
- User can always identify current state and next action in under 2 seconds.
- No multi-banner stack overload in normal operation.
- Closing behaviors are predictable across mobile and desktop.

---

## Rollout Order (recommended)
1. Phase 1 foundation (layout + dismissal) and associated tests.
2. Phase 2 instruction/banners simplification and tests.
3. Phase 3 desktop hierarchy + UX contract + regression pass.

This order gives immediate UX relief while preventing future regressions.

---

## Definition of Done
SkyLensServerless UX improvements are complete when:
- Overlays are **full-height sheets** (not full-screen takeover).
- Settings and relevant overlays close on outside click (policy-driven exceptions allowed).
- UI shows one primary next step and one primary CTA.
- Banner clutter is reduced to a single prioritized actionable banner by default.
- Desktop hero no longer dominates the action path.
- Tests protect the new behavior from regressions.
