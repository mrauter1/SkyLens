# Render Deployment Recovery Plan

## Objective
Identify the exact failure mechanism behind the recent Render deploys for service `srv-d72i29q4d50c738q0o10`, apply the smallest fix that resolves that mechanism, validate the corrected Render-equivalent build/start flow locally, and leave the repo ready for a clean redeploy.

## Confirmed Baseline
- Render’s repo-facing build/start contract is currently `next build` then `next start`, as defined in [package.json](/workspace/SkyLens/package.json).
- The current workspace succeeds on Node `v20.19.6`:
  - `npm run build` passes.
  - `npm run start -- --hostname 0.0.0.0 --port 3005` reaches a ready server.
- The same production build fails immediately on Node `18.20.8`:
  - `npx -y node@18 ./node_modules/next/dist/bin/next build`
  - failure: `You are using Node.js 18.20.8. For Next.js, Node.js version ">=20.9.0" is required.`
- The repo currently declares `next@^16.2.1` in [package.json](/workspace/SkyLens/package.json) but does not declare a project Node engine, `.node-version`, or checked-in Render config that would force a compatible runtime.
- [node_modules/next/package.json](/workspace/SkyLens/node_modules/next/package.json) declares `engines.node: ">=20.9.0"`, so a Render build using Node 18 would fail before any `ViewerShell` code executes.

## Root-Cause Hypothesis And Evidence Standard
- Leading hypothesis: the failing Render deploy is using Node 18.x or another Node version below `20.9.0`, which hard-fails `next build` because SkyLens now depends on Next 16.2.1.
- That hypothesis is strong local evidence, not yet the authoritative root cause for service `srv-d72i29q4d50c738q0o10`.
- The exact root cause must still be tied to the actual failing Render deploy evidence:
  - failing deploy id / commit
  - runtime version selected by Render
  - install/build/start commands actually run
  - first fatal log line and surrounding context
- The recent `ViewerShell` merge remains out of scope unless the Render log still shows an app-level failure after any runtime mismatch is corrected.

## Implementation Milestone
### Milestone 1: Capture exact Render evidence, then choose the fix surface
- Pull the failing Render deploy details for service `srv-d72i29q4d50c738q0o10` and confirm whether the log matches the reproduced Node-version gate or exposes a different concrete failure.
- Keep the fix surface evidence-driven:
  - if the deploy log confirms an unsupported Node runtime, fix the deployment/runtime contract with the smallest durable change
  - if the deploy log points to another concrete build/start defect, scope the fix to that exact repo or service-setting surface instead
- Preferred runtime-fix path if the hypothesis is confirmed:
  - declare a compatible `engines.node` range in [package.json](/workspace/SkyLens/package.json) that satisfies Next 16 (`>=20.9.0`)
  - add one more runtime hint only if Render ignores the package-level engine declaration
- Do not touch [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) or related tests unless the Render evidence, after any runtime correction, exposes a second concrete failure in that code path.
- Keep the change limited to the diagnosed failure mechanism. Avoid refactors, dependency churn, or lockfile reshaping unless the deploy log proves they are necessary.

## Interface / Config Notes
- Deployment/runtime contract:
  - SkyLens requires Node `>=20.9.0` because of Next 16.2.1.
  - This is a deployment and developer-environment compatibility constraint, not a user-facing feature change.
- Repo and service surfaces likely in scope:
  - [package.json](/workspace/SkyLens/package.json) for a canonical Node engine declaration if the runtime mismatch is confirmed
  - Render service settings if the fix belongs in external deploy configuration rather than repo metadata
- Repo files explicitly out of scope unless new evidence appears:
  - [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx)
  - viewer-shell unit/e2e suites, except as targeted regression checks when app code actually changes

## Regression / Safety Notes
- The safest path is to keep the first fix on the deployment contract if the Render log confirms the Node mismatch. That avoids reopening the recent mobile/desktop overlay behavior work when current Node 20 builds and starts already succeed.
- If any application code must be touched after the exact Render failure is identified, the impacted regression surface is the recent overlay merge:
  - mobile overlay open/close behavior
  - desktop overlay/action-row behavior
  - permission fallback and alignment flows

## Validation Plan
- Preserve the evidence path:
  - `npx -y node@18 ./node_modules/next/dist/bin/next build` fails with the Next Node-version gate.
- Required diagnosis validation before the fix is finalized:
  - capture the exact failing Render step, command, runtime version, and fatal log line
- Validate the corrected Render-equivalent happy path after the exact fix is chosen:
  - `npm run build`
  - `npm run start -- --hostname 0.0.0.0 --port 3005`
- If any app code is changed beyond deployment config, run targeted viewer-shell regression coverage:
  - `npx vitest run tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts`
- Prepare redeploy with an explicit summary of:
  - the exact failing Render evidence
  - the chosen fix surface and why it matches that evidence
  - the successful local build/start checks after the fix

## Compatibility / Rollout / Rollback
- Compatibility impact if the runtime mismatch is confirmed: contributors and deployment targets must use Node `>=20.9.0`; this aligns the repo with an already-required dependency floor rather than introducing a new product behavior break.
- Rollout:
  - apply the evidence-backed scoped fix
  - trigger a fresh deploy for service `srv-d72i29q4d50c738q0o10`
  - confirm Render runs the intended runtime/commands and clears the previously failing step
- Rollback:
  - if the first attempted fix does not remove the exact failing Render step, revert only that scoped change and continue from the preserved diagnosis evidence
  - do not revert recent viewer-shell behavior unless a post-diagnosis error directly implicates that code

## Risk Register
- Risk: treating the recent UI merge as the root cause could cause an unnecessary rollback and mobile/desktop regressions.
  Mitigation: require the exact Render log to match the locally reproduced Node-version failure before any app-level edits.
- Risk: the local Node mismatch reproduction is real, but the failing Render deploy could still have a different first fatal step.
  Mitigation: keep the phase contract evidence-first and choose the fix surface only after the actual deploy context is captured.
- Risk: a second failure may appear only after the first deploy blocker is removed.
  Mitigation: keep the plan staged so follow-on errors are handled as separate, evidence-backed steps rather than folded into the first fix blindly.
