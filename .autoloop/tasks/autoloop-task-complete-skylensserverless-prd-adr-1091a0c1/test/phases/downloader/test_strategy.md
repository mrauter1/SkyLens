# Test Strategy

- Task ID: autoloop-task-complete-skylensserverless-prd-adr-1091a0c1
- Pair: test
- Phase ID: downloader
- Phase Directory Key: downloader
- Phase Title: Production Source Downloader
- Scope: phase-local producer artifact

## Behavior-to-test coverage

- AC-1 required file acquisition and restartability:
  covered in `tests/unit/scope-data-download.test.ts` by ordered acquisition across `ReadMe` plus `tyc2.dat.00.gz` through `tyc2.dat.19.gz`, cache skip-valid behavior, and forced redownload behavior.
- AC-2 base URL override replacement and caller ordering:
  covered by downloader-focused env-versus-CLI precedence assertions in `tests/unit/scope-data-download.test.ts` and supporting root CLI contract assertions in `tests/unit/scope-data-contracts.test.ts`.
- Optional expansion behavior:
  covered by local regeneration of expanded files from valid cached gzip files without network access in `tests/unit/scope-data-download.test.ts`.
- AC-3 incomplete acquisition failure:
  covered by exhausted-candidate failure assertions checking thrown error shape, missing file reporting, and fetch attempt count in `tests/unit/scope-data-download.test.ts`.

## Preserved invariants checked

- Tests remain fully offline and deterministic via in-process `fetch` mocks and temporary directories.
- Teardown removes per-test temp cache trees to avoid cross-test state leakage.
- No live network or `public/` writes are required for downloader validation.

## Edge cases and failure paths

- Missing expanded files with valid raw gzip cache are repaired locally.
- Cached valid files are skipped when not forced.
- Forced runs redownload even valid cache entries.
- Missing required files after all candidate base URLs are tried fail the command.
- CLI-provided base URLs override env-provided base URLs instead of appending to them.

## Known gaps

- No live-network integration coverage by design; the phase contract excludes live-network dependent CI tests.
- The final summary text is checked only for key invariants, not for full-string snapshot stability.
