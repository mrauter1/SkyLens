# Render Deployment Log

## 2026-04-06 (latest redeploy attempt)

- Target service: `skylens-serverless-static`
- Service URL: https://skylens-serverless-static.onrender.com
- Deploy ID: `dep-d79q2cogjchc73fpccl0`
- Trigger: API
- Status: `build_failed`
- Started (UTC): 2026-04-06T12:04:03.441209Z
- Finished (UTC): 2026-04-06T12:05:11.087076Z
- Commit Render attempted: `e8a52cd3a8267020717830c61c7f248ab3f7bf1a`

### Root cause

- The new `main` commit currently fails production type-check during `next build`.
- Reproduced locally by checking out commit `e8a52cd3a8267020717830c61c7f248ab3f7bf1a` and running `npm --prefix SkyLensServerless run build`.
- Failing file/location from the build output:
  - `SkyLensServerless/lib/viewer/settings.ts:168`
  - Error: `Type 'unknown' is not assignable to type 'number'.`

### Live site status

- Render kept the previous successful deployment live.
- Live deployment remains reachable at: https://skylens-serverless-static.onrender.com
