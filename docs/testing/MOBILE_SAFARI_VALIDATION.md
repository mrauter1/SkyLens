# Physical Mobile Safari release validation

Automated Chromium and desktop-WebKit tests cannot reproduce iOS transient activation,
sensor delivery, camera interruption, or Safari's per-site permission UI. Complete this check
on a supported physical iPhone over production HTTPS after deploying the candidate commit.

## Clean permission flow

1. In iOS Settings, clear Safari website data/permissions for the deployment origin.
2. Open the origin directly in Safari (not an in-app browser), select **Open live viewer**,
   and keep the tab in the foreground.
3. From the in-app explanation, start live access once. Confirm motion is requested first,
   followed by camera and then location; accept each prompt.
4. Confirm the stage responds to movement without a previously saved manual location and
   camera status becomes ready only after visible live frames appear.
5. Confirm the address bar remains canonical and contains no permission result values.

## Truthful recovery states

Repeat after resetting the origin between cases:

- Deny motion: the UI must say motion was denied and offer manual viewing/retry; it must not
  mislabel delayed samples as denial.
- Allow motion but wait without moving: a no-sample/stalled message and recovery action must
  appear rather than denial.
- Deny camera: the UI must identify camera denial and retain a usable manual sky view.
- Make the camera busy in another app, then retry: the UI must distinguish busy/not-readable
  from denial.
- Background and restore Safari while camera is active: no black preview may remain labeled
  ready; the stream must recover or present a user-activated resume action.
- Revoke camera or motion in Safari/iOS settings, then revisit a legacy URL containing
  `camera=granted&orientation=granted`: SkyLens must revalidate and must not claim readiness.
- Reject `video.play()` by interrupting activation if the OS permits: playback failure must be
  distinct from permission denial and retryable.

## Layout and accessibility

In portrait and landscape, open Settings from every available opener. Confirm the sheet stays
inside the dynamic viewport/safe areas, its last action is reachable, focus remains in the
dialog, Escape works with a hardware keyboard, and closing restores focus. Also verify the
first-use tutorial can be dismissed, remains dismissed after reload, and can be replayed from
Settings.

Record iOS version, iPhone model, Safari context, deployed commit, outcomes, and screenshots or
screen recordings for any failure. Do not capture raw location coordinates, sensor values, or
camera frames in support diagnostics.
