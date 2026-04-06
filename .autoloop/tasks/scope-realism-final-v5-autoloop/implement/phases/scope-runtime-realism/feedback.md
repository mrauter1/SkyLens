# Implement ↔ Code Reviewer Feedback

- Task ID: scope-realism-final-v5-autoloop
- Pair: implement
- Phase ID: scope-runtime-realism
- Phase Directory Key: scope-runtime-realism
- Phase Title: Scope runtime rendering realism
- Scope: phase-local authoritative verifier artifact

- IMP-001 | blocking | `SkyLensServerless/components/viewer/viewer-shell.tsx` `getScopeLensDiameterPx`: the new height-derived lens helper flat-clamps the full supported `50..90` setting range to the same diameter on the default portrait viewport (`390x844` => every supported value becomes `358px` because `viewport.width - 32` is the hard cap). That means the persisted telescope-diameter control does not actually “follow the persisted percentage input” or “immediately update scope lens diameter” on the common mobile layout the app defaults to, which misses AC-5 / FR-5. Minimal fix: keep viewport safety, but make the supported percentage range remain monotonic and user-visible on portrait layouts instead of hard-saturating the entire in-range interval to one size.
- IMP-002 | blocking | `SkyLensServerless/components/viewer/viewer-shell.tsx` validation / `tests/unit/viewer-shell-celestial.test.ts`: the implementation leaves the explicit broader regression watchlist red (`builds top-list mode from the full marker set instead of the suppressed on-object label set`, `renders a low-quality motion vector for a moving object as scene time advances`, `suppresses the trail polyline when prefers-reduced-motion is enabled`). The phase notes label these failures “pre-existing,” but no baseline proof was established in the verifier artifacts, and this phase changed `viewer-shell.tsx`, the same surface those tests exercise. Minimal fix: root-cause and clear the watchlist failures, or establish a clean pre-change baseline in the task artifacts before claiming compatibility/regression safety.

Closure note: cycle 2 addressed both blockers. `getScopeLensDiameterPx` now preserves a monotonic user-visible diameter range on tall portrait layouts, and the explicit broader watchlist (`viewer-shell.test.ts`, `viewer-shell-celestial.test.ts`, `scope-lens-overlay.test.tsx` plus adjacent scope tests) passed in the recorded validation run.
