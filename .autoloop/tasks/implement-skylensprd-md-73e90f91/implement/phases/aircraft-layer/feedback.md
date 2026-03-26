# Implement ↔ Code Reviewer Feedback

- Task ID: implement-skylensprd-md-73e90f91
- Pair: implement
- Phase ID: aircraft-layer
- Phase Directory Key: aircraft-layer
- Phase Title: Aircraft layer
- Scope: phase-local authoritative verifier artifact

- IMP-001 | blocking | [lib/aircraft/opensky.ts](/workspace/SkyLens/lib/aircraft/opensky.ts#L79) / `createLocationBucket` + `buildOpenSkyStatesUrl`: the cache is keyed by rounded 0.1° bucket center and the upstream `/states/all` bounding box is also centered on that rounded bucket, so valid requests near the edge of a bucket can silently miss aircraft that are still within `radiusKm` of the actual observer. Example: an observer ~0.049° north of the bucket center loses roughly 5.4 km of fetch coverage on the north edge, so an aircraft 249 km north of the observer can be excluded before the post-fetch range filter ever runs. This violates AC-1 correctness for valid requests and makes AC-2 cache reuse materially lossy. Minimal fix: keep the bucketed cache key, but expand the fetched bounding box to cover the full 0.1° bucket footprint (or cache by exact-query bbox) before applying exact-observer range filtering.
- IMP-002 | non-blocking | [tests/unit/aircraft-layer.test.ts](/workspace/SkyLens/tests/unit/aircraft-layer.test.ts#L1): the new tests lock anonymous fetch, degraded fallback, and cache reuse, but they do not exercise the authenticated token path or the `401` token-refresh retry branch in `getAircraftApiResponse`. That leaves the newly required OAuth client-credentials contract unverified. Minimal fix: add a unit test that stubs token issuance plus an authenticated `/states/all` request, and a second test that forces one `401` before a refreshed-token success.

Re-review cycle 2: `IMP-001` is resolved by expanding the fetched OpenSky bounding box to cover the full rounded bucket footprint while keeping the cache key unchanged, and `IMP-002` is resolved by direct tests for authenticated token success and one-time `401` token refresh. No additional findings in scope.
