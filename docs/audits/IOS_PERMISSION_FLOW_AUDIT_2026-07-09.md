# SkyLens iOS camera and motion permission-flow audit

Date: 2026-07-09
Scope: maintained `SkyLensServerless` application only. The parent `code/SkyLens` implementation was treated as stale and was not used as product evidence.

## Executive summary

The intermittent iOS behavior is primarily an application state-machine problem, not simply Safari being unreliable.

The most severe defect is a circular gate in fresh motion startup. SkyLens deliberately changes a successful motion prompt to `orientation: unknown` until the first usable sensor sample arrives. However, the orientation subscription is allowed to start only after `hasLiveSessionStarted` becomes true, and that condition normally requires orientation to already be non-`unknown`. With a normal live geolocation observer and no saved manual observer, the listener never starts, no sample can arrive, and the 1.5-second timer rewrites the state to `denied`. A focused existing test reproduces this exact failure.

The behavior appears intermittent because other paths bypass the circular gate:

- a persisted manual observer makes `hasLiveSessionStarted` true;
- a URL containing `orientation=granted` is trusted as current browser truth;
- a prior/fallback state can enter a different branch;
- retry paths and deep links do not all execute the same state transitions.

Camera reliability has a separate cluster of problems. The application treats `getUserMedia()` resolution as equivalent to a visibly playing camera, ignores `video.play()` rejection, does not observe track `mute`, `unmute`, or `ended`, and trusts `camera=granted` from the URL on later sessions. iOS backgrounding, permission revocation, camera contention, or a failed resume can therefore leave the UI saying AR is active while the video is black or absent.

The combined startup also does not honor its tested Motion -> Camera -> Location order. It starts motion and geolocation together, then starts camera. The existing order test fails with `orientation, location, camera`. This increases native-prompt contention and makes the flow harder to reason about.

Recommended release posture: treat the fresh motion deadlock and runtime permission truth as release-blocking for iOS AR. Fix those before tuning sensor math or UX copy.

## Evidence and method

This audit used:

- static tracing of the maintained React permission, camera, route, and sensor lifecycle code;
- focused Vitest probes against the actual state machine;
- the production response headers at `https://skylens-serverless-static.onrender.com`;
- current primary specifications for device orientation and media capture;
- inspection of the test matrix and iOS/WebKit coverage.

No physical iPhone was connected in this environment. Findings marked “confirmed” are directly established by code and/or automated probes. iOS lifecycle impact is inferred where the browser condition itself requires a real device.

### Probe results

| Probe | Result | Meaning |
|---|---|---|
| `npx vitest run tests/unit/orientation.test.ts tests/unit/projection-camera.test.ts --reporter=verbose` | 42/42 passed | Low-level provider arbitration and the happy-path camera constraint fallback work in mocks. These tests do not exercise the ViewerShell deadlock, real user activation, playback, or iOS lifecycle. |
| Viewer startup order test | Failed: actual `orientation, location, camera`; expected `orientation, camera, location` | Confirms the implementation and intended permission order diverge. |
| “keeps route orientation unknown until the first usable sample arrives” | Failed because `subscribeToOrientationPose` was never called | Confirms the fresh motion circular gate. |
| Production header request | HTTP 200 over HTTPS/HSTS, but no `Permissions-Policy` response header | Confirms the `_headers` contract is not being applied by the live Render deployment. |

## Intended and actual flow

The standalone coordinator expresses the intended sequence at `lib/permissions/coordinator.ts:42-47`:

```text
user click
  -> request motion
  -> request camera
  -> request location
  -> start sensor providers
  -> first usable motion sample
  -> mark motion ready
```

The ViewerShell actually behaves like this on a fresh session:

```text
user click
  -> enable AR mode immediately
  -> start orientation permission promise
  -> start geolocation promise immediately
  -> request camera
  -> store camera result
  -> store location result
  -> successful orientation prompt becomes `unknown`
  -> startup state becomes `awaiting-orientation`
  -> orientation provider is blocked because orientation is `unknown`
  -> 1.5 seconds elapse
  -> API presence is interpreted as permission denial
  -> route is rewritten to `orientation=denied`
```

## Findings

### P0 — Fresh motion startup is circular and cannot produce its required sample

Status: **confirmed by code and failing focused test**.

Relevant code:

- `components/viewer/viewer-shell.tsx:1894-1900` converts both prompt `granted` and `unavailable` to `unknown`, correctly intending to wait for a real sample.
- `components/viewer/viewer-shell.tsx:807-822` makes `hasLiveSessionStarted` require all permission values to be known, unless the observer source is manual.
- `components/viewer/viewer-shell.tsx:3177-3192` refuses to subscribe when `hasLiveSessionStarted` is false.
- `components/viewer/viewer-shell.tsx:3227-3243` is the only path that upgrades orientation to `granted` from an actual sample.
- `components/viewer/viewer-shell.tsx:3297-3326` times out the unreachable sample after 1.5 seconds.

The dependency loop is:

```text
orientation unknown
  -> live session false
  -> provider not subscribed
  -> no sample
  -> orientation cannot become granted
```

Why it is intermittent: `hasManualObserverSession` bypasses the all-known condition. Users with a saved manual observer can start the provider; users with normal live geolocation cannot. A deep link with `orientation=granted` also bypasses it, even if that value is stale.

User impact:

- the user may accept the iOS motion prompt and immediately see “denied”;
- retrying can repeat the same result;
- support copy sends the user to iOS Settings even though the app never started its listener;
- the URL persists the false denial.

Required correction: sensor readiness must be allowed to run while orientation is `unknown`. Gate it on an active AR request plus successful/indeterminate prompt status, not on the aggregate “all permissions known” session flag. Permission prompt state and sensor readiness must remain separate.

### P0 — URL query parameters are treated as durable permission truth

Status: **confirmed by code**.

`lib/permissions/coordinator.ts:80-113` serializes and parses `location`, `camera`, and `orientation` in the URL. `components/viewer/viewer-shell.tsx:7595-7624` returns no recovery action when the URL says camera and motion are granted. `components/viewer/viewer-shell.tsx:4144-4156` then only enables AR; it does not re-prompt or revalidate.

On that path:

- camera is opened later from a microtask (`viewer-shell.tsx:2916-2935`), outside the explicit button workflow;
- a camera failure is swallowed and the route stays `camera=granted`;
- motion subscribes because the stale route makes the aggregate session “known”;
- because startup is already considered sensor-ready, the `awaiting-orientation` timeout is not armed if no samples arrive.

A bookmark, shared URL, reload, restored tab, permission reset, or changed browser setting can therefore claim capabilities that the current document does not have.

Required correction: never persist runtime permission results as authoritative URL state. URLs may carry requested mode or diagnostic hints, but each document lifetime needs fresh runtime validation. Keep “previously worked” distinct from “currently ready.”

### P1 — Permission requests compete and violate the intended order

Status: **confirmed by failing test**.

At `components/viewer/viewer-shell.tsx:1993-2000`, orientation and geolocation are started before camera. The actual observed order is:

```text
orientation -> location -> camera
```

The test and standalone coordinator require:

```text
orientation -> camera -> location
```

This means iOS can be handling motion, location, and camera permission work in an overlapping window. Even where Safari serializes its native sheets, application state is being committed in a different order from the copy and tests.

Within motion, `lib/sensors/orientation.ts:309-315` awaits `DeviceOrientationEvent.requestPermission()` before invoking `DeviceMotionEvent.requestPermission()`. Current Device Orientation specification algorithms check transient activation at method invocation and explicitly encourage user agents to bundle concurrent requests. Both calls should be initiated synchronously from the click handler, normally with `Promise.allSettled`, before awaiting either one. See the [W3C Device Orientation and Motion permission algorithms](https://www.w3.org/TR/orientation-event/#permissions).

This sequential motion call is a portability risk rather than the proven cause of the current fresh-flow failure: the two APIs share accelerometer/gyroscope permissions in the current specification, so a conforming browser may not need a second prompt. It should still be corrected and covered by an activation-expiry test.

### P1 — Camera “active” does not mean camera frames are visible

Status: **confirmed by code; iOS impact inferred from standard lifecycle behavior**.

At `components/viewer/viewer-shell.tsx:1739-1745` the application:

1. assigns the stream;
2. catches and discards any `video.play()` error;
3. immediately sets `liveCameraStreamActive(true)`;
4. only afterward enumerates devices.

It does not wait for `loadedmetadata`, nonzero `videoWidth/videoHeight`, or a first video frame. The video element does correctly use `autoPlay`, `muted`, and `playsInline`, which is the right iPhone baseline, but those attributes do not prove playback succeeded.

If `enumerateDevices()` fails after capture succeeds, the whole operation is reported as camera failure while the acquired stream remains in `cameraStreamRef`. On the stale-granted auto-open path, the catch is ignored, state remains granted, and the ref prevents another automatic open attempt.

Required correction: model at least `requesting -> stream-acquired -> playing`. Mark ready only after real frame readiness. Treat device enumeration as non-fatal metadata work and always stop/clear a stream on fatal activation failure.

### P1 — Camera interruption and resume are not observed

Status: **confirmed absence in code; platform impact is expected by the media standard**.

The orientation provider explicitly handles `visibilitychange`, `pagehide`, and `pageshow` at `lib/sensors/orientation.ts:1856-1900`. Camera has no equivalent lifecycle recovery and no listeners for track `mute`, `unmute`, or `ended`.

The Media Capture specification defines these states precisely: a muted video track can render black frames, an ended track never returns to live, and applications can observe `mute`, `unmute`, `readyState`, and `ended`. It also allows implementations to mute/relinquish capture while a document is not in view and to end the track if reacquisition fails. See [MediaStreamTrack media flow and lifecycle](https://www.w3.org/TR/mediacapture-streams/#mediastreamtrack) and [the `getUserMedia()` failure model](https://www.w3.org/TR/mediacapture-streams/#dom-mediadevices-getusermedia).

This is a direct match for “works, background the iPhone or switch apps, return to a black camera.” The boolean remains true because no event updates it.

Required correction: observe track lifecycle, update UI immediately, and on `pageshow`/visible verify `readyState`, `muted`, video playback, and real frame dimensions before either resuming or presenting an explicit tap-to-restart action.

### P1 — All camera failures are collapsed into “denied” and retried indiscriminately

Status: **confirmed by code**.

`lib/projection/camera.ts:146-158` catches every error for every constraint candidate and finally throws `Error('rear-camera-unavailable')`. The caller then maps all failures to `camera=denied`.

This discards distinctions that require different UX and retry behavior:

- `NotAllowedError`: user/policy denial;
- `NotFoundError`: no matching camera;
- `OverconstrainedError`: the exact rear-camera constraint failed and fallback is appropriate;
- `NotReadableError`: hardware/OS/browser lock or camera contention;
- `AbortError`: other capture startup failure;
- `InvalidStateError`: document is not fully active.

The W3C capture algorithm explicitly distinguishes these cases. Retrying a looser camera constraint is appropriate for constraint/device selection failures, but not for permission denial or an inactive document. See [Media Capture and Streams error handling](https://www.w3.org/TR/mediacapture-streams/#error-handling).

User impact: iOS contention or interruption looks like permanent denial, the recovery copy is wrong, and engineering receives no actionable reason.

### P1 — “No motion sample” is mislabeled as permission denial after 1.5 seconds

Status: **confirmed by code**.

`resolveOrientationTimeoutStatus()` returns `denied` whenever any orientation API exists. API presence cannot prove the user denied permission. No sample can also mean:

- the provider was never started (the current P0 defect);
- the document became hidden;
- events are delayed after the native sheet;
- a sample was incomplete or rejected by validation;
- policy blocked delivery;
- the sensor is temporarily unavailable;
- the browser implementation stalled.

The 1.5-second deadline is also the same order as provider arbitration/stall timing, leaving little margin for iOS prompt dismissal, React effects, and first-event delivery.

Required correction: use a distinct `no-sample`/`interrupted` state, do not persist it as denial, and use an evidence-based readiness window with retry. Only an explicit permission result of `denied` should produce denial copy.

### P2 — Motion permission errors lose their cause

Status: **confirmed by code**.

`lib/sensors/orientation.ts:1288-1310` maps every rejection except one `TypeError` fallback to `denied`. A `NotAllowedError` caused by missing transient activation is indistinguishable from a user choice; implementation errors and policy failures are also indistinguishable.

The prompt function returns only `granted | denied | unavailable`, so ViewerShell cannot show a useful recovery or record why the flow failed. Preserve a structured internal result even if the route-facing API remains simple.

### P2 — The production permissions header contract is not deployed

Status: **confirmed against the live origin on 2026-07-09**.

The repository intends to send:

```text
Permissions-Policy: camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)
```

`public/_headers` contains it, local tests validate it, and the embed route delegates all five features. The live Render response contained HSTS but no `Permissions-Policy` header. Next.js also cannot apply `headers()` to a static export; deployment must configure the static host itself.

This is not the primary top-level failure because the relevant features currently default to same-origin in the specifications. It is significant for the repository’s explicit embed contract and shows that local header tests do not validate production behavior.

Required correction: configure the header in Render’s supported response-header mechanism and add an unauthenticated live-origin smoke test.

### P2 — The browser test matrix does not test iOS/WebKit permission behavior

Status: **confirmed by configuration**.

`playwright.config.ts:16-21` defines only Chromium with a Pixel 7 profile. Unit mocks resolve permission promises immediately, do not model transient activation, do not model native prompt timing, and do not exercise real media-track lifecycle. Desktop Playwright WebKit would improve compatibility coverage but is still not Mobile Safari on a physical iPhone.

This gap allowed two explicit startup-contract tests to remain failing while lower-level orientation and camera suites passed.

## What is already sound

- Live AR checks for a secure context before requesting capabilities.
- Camera constraints request `audio: false`, avoiding an unnecessary microphone prompt.
- The video element uses `autoPlay`, `muted`, and `playsInline`.
- Motion prompt success is intentionally not equated with sensor readiness; the defect is the gate that prevents readiness validation.
- Orientation provider arbitration has lifecycle suspend/resume handling and source fallback.
- AR resource shutdown uses request IDs and stops camera/orientation resources on explicit mode exit.
- The UI includes manual navigation and observer fallbacks rather than hard-blocking the whole product.

These pieces should be preserved while replacing the aggregate permission state machine.

## Recommended implementation sequence

### 1. Remove the motion circular dependency

- Start orientation providers whenever AR is active and the prompt result is `granted` or indeterminate-but-supported.
- Do not require `orientation !== unknown` before subscribing.
- Keep `permissionDecision` and `sampleReadiness` as separate fields.
- Add a regression test for fresh startup with a live geolocation observer and no persisted manual observer.

### 2. Make document-lifetime runtime state authoritative

- Stop using URL `granted` values as permission truth.
- On every AR enable, validate a camera stream and a motion sample for the current document.
- Treat prior URL/local state only as a hint for copy, never as readiness.
- Arm readiness/recovery even when a legacy/deep-link route says granted.

### 3. Serialize the user-facing capability flow

- In the click stack, initiate all iOS motion permission calls concurrently so each captures transient activation.
- Await motion decision, then request camera, then location, matching the tested UX.
- Do not launch geolocation beside the motion prompt.
- Keep cancellation/request IDs for rapid disable/re-enable.

### 4. Replace camera boolean state with lifecycle state

- Preserve original `DOMException.name` and constraint context.
- Retry constraint candidates only for selection/constraint failures.
- Require actual playback/frame readiness before `ready`.
- Make device enumeration non-fatal.
- Observe track `mute`, `unmute`, `ended`, stream activity, visibility, and pageshow.
- Provide “Camera busy/interrupted — tap to resume” separately from denial.

### 5. Correct timeout semantics

- Use `awaiting-sample`, `no-sample`, `interrupted`, `denied`, and `unavailable` distinctly.
- Never infer denial solely from API presence.
- Increase the first-sample window based on physical-device measurement; log elapsed prompt-to-first-sample time.
- Let retry restart the provider even if the prompt is already granted.

### 6. Add observability and production checks

Record, without sensitive sensor values:

- browser/iOS version and standalone/PWA/tab context;
- click timestamp, each permission invocation/result/error name;
- camera constraint candidate and original error name;
- stream acquired, play resolved/rejected, first-frame timestamp;
- motion provider started, first-sample timestamp, timeout reason;
- visibility/page lifecycle and track mute/ended transitions;
- state transition reason and request ID.

Verify the live `Permissions-Policy` header after every deployment.

## Minimum regression matrix

1. Fresh Safari session, no manual observer, all permissions accepted.
2. Motion accepted, camera denied; camera accepted, motion denied; location denied.
3. Motion prompt accepted but first sample delayed beyond 1.5 seconds.
4. Reload/deep link containing all three `granted` values after permissions are reset.
5. Background/foreground, screen lock/unlock, app switch, incoming interruption, and camera contention.
6. `video.play()` rejection and zero-dimension video.
7. `enumerateDevices()` rejection after a stream is acquired.
8. Camera `NotAllowedError`, `NotReadableError`, `AbortError`, `NotFoundError`, and `OverconstrainedError` separately.
9. Track `mute -> unmute` and `ended` transitions.
10. Saved manual observer versus live geolocation observer, proving identical motion startup.
11. Top-level and embedded viewer on the production origin with the actual response header.
12. Current iOS Safari on at least one older supported iPhone and one current device; add desktop WebKit automation as a supplement, not a substitute.

## Acceptance criteria

- Accepting motion on a clean iPhone starts the provider and reaches a first usable sample without requiring a saved manual observer.
- The application never displays “denied” unless the permission API explicitly returns denial or a policy response proves it.
- A URL cannot make camera or motion appear ready.
- “Camera ready” requires a live, unmuted track and visible frame production.
- Background/resume either recovers automatically or gives a truthful, actionable tap-to-resume state.
- Prompt order is deterministic and the existing Motion -> Camera -> Location test passes.
- Original browser error names are retained for UX and telemetry.
- Live production responses include the intended permissions policy.
- The iOS physical-device matrix passes across clean, denied, retry, reload, and interruption cases.

## Bottom line

The strongest explanation for the reported intermittency is the combination of a deterministic fresh-flow motion deadlock and nondeterministic bypasses created by saved observer state and trusted URL permission values. Camera failures are then amplified by false readiness, lost error identity, and absent interruption handling. Fixing those state boundaries should produce a much larger reliability gain than adding more retries or changing instructional copy.
