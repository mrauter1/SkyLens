# SkyLensServerless follow-up fixes for review comments and required permissions

## Requirements
- Camera and geolocation are required project capabilities.
- Address inline review concerns from the prior PR.

## Work to complete
1) Restore permissions policy contract so it includes camera and geolocation plus accelerometer, gyroscope, and magnetometer.
2) Keep policy values consistent across runtime config, static headers, and generated export headers.
3) Update embedded viewer delegation so required capabilities are delegated where needed.
4) Update related tests so the corrected permissions and delegation contract is enforced.
5) Update parity/docs text to reflect the corrected contract.
6) Preserve prior direct CelesTrak behavior and desktop/mobile viewer UX changes; do not regress mobile.

## Acceptance
- Permissions policy includes camera and geolocation.
- Headers and generated output are consistent.
- Embed delegation aligns with required capabilities.
- Tests updated and passing.
- Docs/parity updated.

Use autoloop with full-auto answers and plan, implement, test pairs until complete.
