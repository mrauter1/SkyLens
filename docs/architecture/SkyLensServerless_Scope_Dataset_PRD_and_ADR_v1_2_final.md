# SkyLensServerless Telescope Scope Dataset — Product Requirements Document (PRD)

Version: 1.2  
Status: Implementation-ready  
Audience: Autonomous coding agent with access to the current SkyLensServerless codebase  
Normative language: **MUST**, **MUST NOT**, **SHOULD**, **MAY** are binding.

---

## 1. Purpose

This document defines the product requirements for the **dataset download and dataset build pipeline** used by the SkyLensServerless virtual telescope scope feature.

This PRD is intentionally limited to:
- acquiring the source catalog data
- generating the distilled static scope dataset
- validating and packaging the output artifacts

This PRD does **not** define runtime rendering, scope overlay UI, or scene interaction. Those concerns belong to the scope runtime documents.

If the repository state and this document disagree for dataset download/build behavior, this document wins.

---

## 2. Scope

The implementation target is the current SkyLensServerless repository and deployment model:
- Next.js static export
- static assets served from `public/`
- dataset artifacts consumed at runtime from `/data/scope/v1/...`
- Render static-site hosting for the final built site
- no server runtime for dataset serving

The dataset pipeline MUST support two modes:

1. **Production mode**
   - download the Tycho-2 main catalog files
   - build the full static dataset from the downloaded production source

2. **Development mode**
   - build a deterministic, committed, smaller dataset with the exact same runtime schema
   - require no network access
   - guarantee deeper-than-wide scope behavior during development and testing

---

## 3. Product summary

The repository MUST gain a fully specified, deterministic pipeline that can:

1. Download the production source catalog used for scope stars.
2. Cache raw source files locally outside committed static assets.
3. Parse and normalize the source into a compact canonical star representation.
4. Attach names when a name source is available.
5. Partition the stars by magnitude band and sky position.
6. Emit versioned static artifacts under `public/data/scope/v1/`.
7. Validate that the emitted artifacts are internally consistent and usable by the runtime.
8. Produce a deterministic development dataset even when no production source catalog is present.

The pipeline MUST be runnable by an autonomous coding agent without needing additional architectural decisions.

---

## 4. Locked product decisions

The following decisions are already made and MUST NOT be reopened:

1. The dataset output path is **`public/data/scope/v1/`**.
2. The output format is **manifest + names table + per-band positional binary tiles**.
3. The runtime schema is shared by production and development datasets.
4. The source of record for the **production v1 dataset** is **Tycho-2 main catalog only**.
5. Tycho-2 supplements are **out of scope** for production v1.
6. The production source download is separated from the dataset build.
7. Raw downloaded catalog files MUST NOT be committed to the repository.
8. The deterministic development dataset under `public/data/scope/v1/` MUST be committed to the repository.
9. A production-built dataset MAY be committed, but the pipeline MUST NOT require committed production output.
10. The build MUST be deterministic: identical input MUST produce identical output bytes.
11. Runtime artifacts MUST NOT embed wall-clock timestamps.
12. The build MUST support named deep stars **when name data is available**.
13. Name augmentation is optional and layered; unnamed stars remain valid.
14. The development fallback dataset MUST deterministically include at least one named deep-star path when the seed bright-star catalog provides names.
15. The pipeline MUST NOT depend on a server or database.
16. The pipeline MUST be implemented with scripts that can run in the repository’s existing Node/npm environment.
17. The default production downloader endpoints are fixed in this document.
18. The Tycho-2 parser contract is fixed in this document.
19. Name normalization and deterministic JSON key ordering are fixed in this document.
20. Orphan names are not allowed. `names.json` MUST contain only names referenced by emitted tile rows.

---

## 5. Goals

### 5.1 Primary goals

1. Create a reliable way to acquire production source data for scope stars.
2. Build a compact, static dataset optimized for the existing static-host deployment model.
3. Guarantee deterministic outputs for development, CI, and autonomous implementation.
4. Preserve a clear separation between raw source data and shipped runtime assets.
5. Provide enough structure that the scope runtime can load only the needed tiles.

### 5.2 Secondary goals

1. Make the source acquisition layer swappable without changing the emitted runtime schema.
2. Support optional name augmentation without making names mandatory.
3. Make production and development builds verifiable through automated tests and build reports.

---

## 6. Non-goals

The following are explicitly out of scope for this document:

1. Runtime scope overlay rendering.
2. Viewer interaction behavior.
3. Camera integration.
4. Runtime tile loader implementation details beyond the emitted artifact contract.
5. Deep-sky object catalogs other than stars.
6. HEALPix runtime integration.
7. Server-side preprocessing or hosted ETL infrastructure.
8. Tycho-2 supplement ingestion.

---

## 7. User stories

### 7.1 Maintainer
As a maintainer, I want a documented, repeatable pipeline so the scope dataset can be rebuilt without reverse-engineering prior artifacts.

### 7.2 Coding agent
As an autonomous coding agent, I want exact download/build rules, file paths, schemas, default URLs, parser ranges, and validation steps so I can implement the dataset pipeline without asking follow-up questions.

### 7.3 Product developer
As a product developer, I want the generated dataset to be small enough and structured enough to work with static hosting and tile-based runtime loading.

### 7.4 Tester
As a tester, I want an offline deterministic development dataset that exercises the same codepath as production so tests do not depend on external downloads.

---

## 8. Functional requirements

### FR-1 — Standalone dataset pipeline

The repository MUST gain a standalone dataset pipeline comprising:
- source download
- source expansion/decompression
- source parse and normalize
- optional name augmentation
- banding and tiling
- artifact write
- artifact verification

The pipeline MUST be runnable independently from the app runtime.

### FR-2 — Production source catalog

The production v1 dataset MUST use the **Tycho-2 main catalog** as its source of record.

Required source characteristics:
- mean J2000/ICRS positions
- proper motions
- BT and VT photometry where available
- approximately 2.54 million entries
- 20 split main-catalog parts
- no Tycho-2 supplement ingestion in v1

### FR-3 — Source acquisition mode split

The implementation MUST support these acquisition/build modes:

#### Production mode
- network-enabled download of Tycho-2 main catalog files
- build full dataset from downloaded source files

#### Development mode
- no network required
- build deterministic development dataset from `public/data/stars_200.json`
- emit the exact same runtime schema as production

### FR-4 — Download command

A dedicated download command MUST exist.

Required behavior:
- fetch the production source files into a local cache directory
- skip already valid files unless forced
- be restartable without re-downloading all files
- support configurable source base URLs
- avoid writing into `public/`
- exit non-zero on incomplete acquisition

The download command MUST NOT build the final dataset artifacts.

### FR-5 — Build command

A dedicated build command MUST exist.

Required behavior:
- read either downloaded production source files or development fallback input
- normalize rows into canonical star records
- assign optional names where available
- emit the dataset artifacts under `public/data/scope/v1/`
- overwrite prior artifacts atomically for the target version
- exit non-zero on validation failure

The build command MUST be able to run without network access after production files have already been downloaded.

### FR-6 — Verify command

A dedicated verify command MUST exist.

It MUST validate:
- manifest schema
- names-table schema
- band index schema
- tile filename/path consistency
- row byte length consistency
- row numeric range sanity
- all referenced `nameId` values resolve in the names table
- no names table entry is orphaned
- development dataset invariants when in development mode

### FR-7 — Required repository scripts

The repository MUST define npm scripts for:

- `scope:data:download`
- `scope:data:build`
- `scope:data:build:dev`
- `scope:data:verify`

The public repository interface MUST be npm scripts.

### FR-8 — Local cache location

Raw downloaded source data MUST live under a non-public, non-committed cache path.

Required cache root:

```text
.cache/scope-source/
```

Required production subpath:

```text
.cache/scope-source/tycho2/
```

The implementation MUST ensure this cache root is ignored by git.

### FR-9 — Output dataset location

The emitted runtime dataset MUST be written under:

```text
public/data/scope/v1/
```

This directory MUST contain only runtime-consumable artifacts and MUST NOT contain raw source files.

### FR-10 — Required production file set

The production downloader MUST acquire, at minimum:

- `ReadMe`
- `tyc2.dat.00.gz`
- `tyc2.dat.01.gz`
- `tyc2.dat.02.gz`
- `tyc2.dat.03.gz`
- `tyc2.dat.04.gz`
- `tyc2.dat.05.gz`
- `tyc2.dat.06.gz`
- `tyc2.dat.07.gz`
- `tyc2.dat.08.gz`
- `tyc2.dat.09.gz`
- `tyc2.dat.10.gz`
- `tyc2.dat.11.gz`
- `tyc2.dat.12.gz`
- `tyc2.dat.13.gz`
- `tyc2.dat.14.gz`
- `tyc2.dat.15.gz`
- `tyc2.dat.16.gz`
- `tyc2.dat.17.gz`
- `tyc2.dat.18.gz`
- `tyc2.dat.19.gz`

Tycho-2 supplement files and index files are optional in v1 and MUST NOT be required for a successful production build.

### FR-11 — Exact default downloader base URLs

If no CLI or environment override is provided, the downloader MUST try this exact ordered list of candidate base URLs:

1. `https://cdsarc.cds.unistra.fr/ftp/cats/I/259/`
2. `https://vizier.cfa.harvard.edu/vizier/ftp/cats/I/259/`

The downloader MUST form each required file URL by simple path concatenation.

### FR-12 — Configurable source endpoints

The downloader MUST support configurable source endpoints.

The implementation MUST support:
- `--base-url <url>` CLI override, repeatable
- `SKYLENS_SCOPE_SOURCE_BASE_URLS` environment override as a comma-separated list

If any override is provided, the override list MUST replace the built-in list.

### FR-13 — Canonical normalized star record

Before tiling, the build MUST normalize each usable source row to this canonical logical shape:

```ts
interface NormalizedScopeStar {
  sourceCatalog: 'tycho2-main' | 'dev-synthetic-from-stars-200'
  sourceId: string
  raDeg: number
  decDeg: number
  pmRaMasPerYear: number
  pmDecMasPerYear: number
  vMag: number
  bMinusV: number
  displayName?: string
}
```

This normalized form is an internal build form and MUST NOT be written directly to runtime tiles.

### FR-14 — Exact production parser contract

The production build MUST parse Tycho-2 main catalog rows from expanded text lines using this exact contract:

- input files are the expanded contents of `tyc2.dat.00` through `tyc2.dat.19`
- each logical record is one line
- after stripping a trailing `\n` or `\r\n`, the line length MUST equal `206` characters
- if a line does not satisfy the length rule, the build MUST fail
- fields MUST be extracted by fixed 1-based inclusive byte ranges
- blank numeric fields MUST parse as `null`
- non-blank numeric fields MUST parse as finite numbers or the row MUST be dropped if the field is required by the inclusion rules

The required byte ranges are:

| Field | Bytes | Meaning |
|---|---:|---|
| `TYC1` | `1-4` | region number |
| `TYC2` | `6-10` | running number |
| `TYC3` | `12-12` | component |
| `pflag` | `14-14` | mean position flag |
| `RAmdeg` | `16-27` | mean RA at J2000, deg |
| `DEmdeg` | `29-40` | mean Dec at J2000, deg |
| `pmRA` | `42-48` | proper motion in RA*cos(dec), mas/yr |
| `pmDE` | `50-56` | proper motion in Dec, mas/yr |
| `BTmag` | `111-116` | Tycho-2 BT magnitude |
| `VTmag` | `124-129` | Tycho-2 VT magnitude |
| `HIP` | `143-148` | Hipparcos identifier |

The parser MUST ignore every other field in v1.

### FR-15 — Production parser inclusion rules

The build MUST drop any Tycho-2 main-catalog row that has:
- non-finite or missing `RAmdeg`
- non-finite or missing `DEmdeg`
- both `BTmag` and `VTmag` unusable
- non-finite derived `V`
- non-finite derived `B-V` after fallback and clamp
- `pflag = 'X'`

For PM:
- if `pmRA` is missing, set `pmRaMasPerYear = 0`
- if `pmDE` is missing, set `pmDecMasPerYear = 0`

For `HIP`:
- blank `HIP` parses as `null`

### FR-16 — Stable source id

Every normalized production row MUST carry a deterministic `sourceId` with exact format:

```text
TYC:{TYC1}-{TYC2}-{TYC3}
```

Examples:
- `TYC:1-13-1`
- `TYC:1234-5678-1`

This `sourceId` is internal to the build and verify pipeline and is not emitted directly to runtime tiles.

### FR-17 — Photometry derivation

The production build MUST derive a display magnitude and color term from Tycho-2 photometry using these exact rules:

#### If both `BT` and `VT` are present
- `V = VT - 0.090 * (BT - VT)`
- `B-V = 0.850 * (BT - VT)`

#### If only `VT` is present
- `V = VT`
- `B-V = 0`

#### If only `BT` is present
- `V = BT`
- `B-V = 0`

#### If neither is usable
- drop the row

The build MUST clamp `B-V` into `[-1.0, 4.0]`.

The build MUST round both `V` and `B-V` to exactly three decimal places before canonical normalized record construction.

### FR-18 — Name augmentation

The build MUST support optional names through layered augmentation.

Required precedence order:

1. **Manual override table** if present:
   - `data/scope-source/name-overrides.csv`
2. **Built-in bright-star name join** against:
   - `public/data/stars_200.json`
3. Otherwise unnamed

A row without a resolved name remains valid and MUST still be emitted.

### FR-19 — Manual override table

If `data/scope-source/name-overrides.csv` exists, the build MUST read it.

Exact CSV header:

```text
matchType,matchKey,displayName
```

Allowed `matchType` values:
- `HIP`
- `TYC`

`matchKey` examples:
- `32349` for `HIP`
- `1-13-1` for `TYC`

Rows with invalid schema MUST fail the build.

### FR-20 — Name normalization and deduplication

Every candidate display name from every source MUST be normalized using this exact function:

1. convert input to string
2. apply Unicode NFC normalization
3. replace all internal whitespace runs matching `\s+` with a single ASCII space
4. trim leading and trailing whitespace
5. if the result is empty, treat as unnamed

The normalized name string is the only form used for:
- deduplication
- sorting
- `names.json` values
- emitted `displayName`

Deduplication MUST be exact and case-sensitive on the normalized string.

### FR-21 — Built-in bright-star naming join

The build MUST use `public/data/stars_200.json` as a built-in naming source.

Required join behavior:
- if a bright-star entry `id` matches pattern `hip-<integer>`
- and the Tycho-2 source row has the same numeric HIP value
- assign the bright-star `name` as `displayName` after normalization

If multiple bright-star seed entries resolve to the same HIP:
- if all normalized names are identical, treat them as one mapping
- if normalized names differ, fail the build

If a bright-star entry has no parseable HIP id, it MUST NOT participate in this join.

### FR-22 — Deterministic name-id assignment

Runtime tiles MUST not embed raw names directly. The build MUST emit a separate names table and assign stable integer `nameId` values.

Required rules:
- unnamed stars use `nameId = 0`
- unique non-empty normalized names are collected globally from **emitted rows only**
- names are sorted in strict ascending UTF-16 code-unit order using plain binary string comparison, not locale-aware collation
- `nameId` assignment starts at `1`
- the same input name set MUST produce the same `nameId` mapping every build
- `names.json` MUST contain no orphan entries

### FR-23 — Magnitude bands

The build MUST emit these exact cumulative bands:

- `6.5`
- `8.0`
- `9.5`
- `10.5`

Band semantics are cumulative:
- a star with `vMag <= 6.5` appears in every band
- a star with `vMag <= 8.0` appears in bands `8.0`, `9.5`, `10.5`
- a star with `vMag <= 9.5` appears in bands `9.5`, `10.5`
- a star with `vMag <= 10.5` appears in band `10.5`

### FR-24 — Positional tiling grids

The build MUST partition each band using these exact RA/Dec grids:

| Band | RA step (deg) | Dec step (deg) |
|---|---:|---:|
| 6.5 | 90.0 | 45.0 |
| 8.0 | 45.0 | 30.0 |
| 9.5 | 22.5 | 22.5 |
| 10.5 | 11.25 | 11.25 |

The build MUST use normalized RA in `[0, 360)` and clamped Dec in `[-90, 90]`.

### FR-25 — Runtime artifact set

The emitted runtime dataset MUST contain:

```text
public/data/scope/v1/
  manifest.json
  names.json
  mag6p5/
    index.json
    r{raIndex}_d{decIndex}.bin
  mag8p0/
    index.json
    r{raIndex}_d{decIndex}.bin
  mag9p5/
    index.json
    r{raIndex}_d{decIndex}.bin
  mag10p5/
    index.json
    r{raIndex}_d{decIndex}.bin
```

Only non-empty tile binaries MUST be emitted. Every band directory MUST still emit `index.json`.

### FR-26 — Manifest requirements

The dataset manifest MUST be deterministic and MUST NOT contain wall-clock timestamps.

The manifest MUST include:
- schema version
- dataset kind (`dev` or `prod`)
- source catalog label
- epoch
- row format identifier
- names table path
- band metadata
- total emitted row counts by band
- total named row counts by band

### FR-27 — Band index requirements

Every band directory MUST contain an `index.json` file.

The band index MUST list all non-empty tiles for that band and their record counts.

This index is required so runtime loaders do not have to probe for tile existence by 404.

### FR-28 — Tile row format

Each emitted tile MUST use fixed-width little-endian binary rows.

The exact row layout is defined in the ADR and MUST be the same for dev and prod builds.

### FR-29 — Development fallback build

If no production source is present or if the build is invoked in development mode, the build MUST synthesize the runtime dataset from `public/data/stars_200.json` using the deterministic fallback recipe defined in the ADR.

This development dataset MUST:
- be deeper than the wide 200-star layer
- contain named deep-star examples when source names exist
- exercise all runtime artifact types
- be suitable for automated tests
- produce at least one non-empty tile in every configured band

### FR-30 — Deterministic sort order

The build MUST use a deterministic row ordering.

Required tile-local sort key:
1. `vMag` ascending
2. `decDeg` ascending
3. `raDeg` ascending
4. `sourceId` ascending

This is required for identical output bytes across identical builds.

### FR-31 — Deterministic JSON serialization

All shipped JSON files MUST be serialized with:
- UTF-8 encoding
- two-space indentation
- a single trailing newline `\n`
- exact key ordering defined in the ADR

### FR-32 — Atomic output behavior

The build MUST write into a temporary directory first and replace the final output directory only after a successful full build and verification pass.

Partial output trees MUST NOT remain as the active dataset on failure.

### FR-33 — Build report

The build MUST emit a non-runtime report under:

```text
.cache/scope-build/report.json
```

This report MAY contain timestamps and diagnostics because it is not part of the shipped static dataset.

The report schema is fixed in the ADR.

### FR-34 — CI and offline behavior

The development dataset build MUST be runnable offline in CI.

The verify command MUST be runnable offline in CI.

The production build MAY require network only for the explicit download command.

### FR-35 — Acceptance invariants for development dataset

The deterministic development dataset MUST satisfy all of the following:

1. `mag6p5` contains at least one row.
2. At least one band deeper than `mag6p5` contains more emitted rows than `mag6p5`.
3. At least one emitted deep tile contains at least one named row when the seed input contains at least one non-empty name.
4. Every emitted `nameId > 0` resolves in `names.json`.
5. `names.json` contains no orphan names.
6. Every emitted row has finite RA, Dec, V, and color term.
7. All development fallback PM values are zero.
8. All development fallback `bMinusV` values are zero.
9. The development dataset uses the exact same manifest, names, band-index, and tile row schema as production.

---

## 9. Acceptance criteria

The dataset pipeline is complete only when all of the following are true:

1. `npm run scope:data:download` can acquire the production source files into `.cache/scope-source/`.
2. `npm run scope:data:build` can build a production dataset from already-downloaded source files without network.
3. `npm run scope:data:build:dev` can build a valid development dataset offline from `public/data/stars_200.json`.
4. `npm run scope:data:verify` validates both development and production outputs.
5. The emitted dataset exists under `public/data/scope/v1/`.
6. The emitted dataset contains `manifest.json`, `names.json`, per-band `index.json`, and non-empty tile binaries.
7. The production build uses Tycho-2 main catalog only.
8. The development build is deterministic and includes at least one named deep-star path when source names exist.
9. No raw source catalog files are written into `public/`.
10. The output is deterministic: identical input produces identical shipped runtime artifact bytes.
11. The built-in default downloader URL list is implemented exactly.
12. The Tycho-2 parser follows the exact line-length and byte-range contract.
13. `names.json` contains only emitted names.

---

## 10. Informative source notes

The production source choice and field derivation rules in this PRD are aligned with the published Tycho-2 catalog documentation:
- Tycho-2 main catalog has 2,539,913 entries.
- It is split into 20 files.
- It provides mean J2000 positions, proper motions, and BT/VT magnitudes.
- Approximate Johnson photometry may be derived with:
  - `V = VT - 0.090*(BT - VT)`
  - `B-V = 0.850*(BT - VT)`

These are informative references; the normative behavior is the text above.


---

# SkyLensServerless Telescope Scope Dataset — Architecture and Design Record (ADR)

Version: 1.2  
Status: Implementation-ready  
Audience: Autonomous coding agent with access to the current SkyLensServerless codebase  
Normative language: **MUST**, **MUST NOT**, **SHOULD**, **MAY** are binding.

---

## 1. Purpose

This document defines the exact implementation architecture for **downloading and building the static telescope scope dataset** used by SkyLensServerless.

It is intentionally limited to:
- source acquisition
- source normalization
- optional name augmentation
- banding and tiling
- artifact emission
- artifact verification

Runtime loading and rendering are out of scope except where the emitted artifact contract must be specified.

---

## 2. Current codebase assumptions

The current repository already establishes the following constraints:

1. Static assets are served from `public/` at root-relative URLs.
2. The app uses Next static export.
3. The existing wide bright-star layer is bundled and deterministic.
4. The repository already persists viewer-facing artifacts directly in the repo tree.
5. There is currently no server-side data pipeline.

Therefore the dataset pipeline MUST:
- keep raw source inputs outside `public/`
- emit final runtime assets into `public/data/scope/v1/`
- avoid introducing server or database dependencies
- be runnable locally and in CI with only Node/npm

---

## 3. Chosen architecture

### 3.1 High-level architecture

The chosen architecture is a **two-stage local pipeline**.

#### Stage A — Source acquisition
Download and cache production raw source files into `.cache/scope-source/`.

#### Stage B — Dataset build
Read raw source or development fallback inputs and emit runtime artifacts into `public/data/scope/v1/`.

This separation is required so:
- production downloads are explicit and restartable
- builds can run offline after download
- development builds never require network
- runtime artifacts remain small and static-host friendly

### 3.2 Chosen production source

Production v1 source catalog: **Tycho-2 main catalog only**.

Reason:
- provides J2000 mean positions
- provides proper motions
- provides BT/VT photometry
- complete enough for the v1 target depth ceiling
- available as split downloadable parts
- does not require adding a new astronomy source dependency

Supplements are intentionally excluded in v1 to keep the pipeline simpler and deterministic.

---

## 4. Required repository changes

### 4.1 New scripts

The coding agent MUST create:

#### `scripts/download-scope-source.mjs`
Responsibilities:
- resolve base URL list
- fetch Tycho-2 production source files
- store them in cache
- skip valid existing files unless forced
- optionally decompress into an expanded cache directory

#### `scripts/build-scope-dataset.mjs`
Responsibilities:
- production parse/build path from downloaded Tycho-2 files
- development deterministic fallback path from `public/data/stars_200.json`
- name augmentation
- banding, tiling, and artifact writing
- manifest, index, names, and report emission
- atomic output replacement

#### `scripts/verify-scope-dataset.mjs`
Responsibilities:
- validate emitted runtime dataset contract
- validate development fallback invariants
- fail non-zero on contract violations

### 4.2 Package scripts

The coding agent MUST update `package.json` to include:

```json
{
  "scripts": {
    "scope:data:download": "node scripts/download-scope-source.mjs",
    "scope:data:build": "node scripts/build-scope-dataset.mjs --mode prod",
    "scope:data:build:dev": "node scripts/build-scope-dataset.mjs --mode dev",
    "scope:data:verify": "node scripts/verify-scope-dataset.mjs --dataset-root public/data/scope/v1"
  }
}
```

Exact script names are normative. Additional convenience scripts MAY be added.

### 4.3 Git ignore changes

The coding agent MUST ensure the following are ignored:

```text
.cache/scope-source/
.cache/scope-build/
```

The following MUST NOT be ignored:

```text
public/data/scope/v1/
```

---

## 5. Required directory layout

### 5.1 Source cache layout

Required cache root:

```text
.cache/scope-source/
```

Required Tycho-2 layout:

```text
.cache/scope-source/tycho2/
  raw/
    ReadMe
    tyc2.dat.00.gz
    ...
    tyc2.dat.19.gz
  expanded/
    tyc2.dat.00
    ...
    tyc2.dat.19
```

The downloader MAY skip the `expanded/` layer and stream-decompress during parse, but the implementation MUST support deterministic offline builds once raw files are already present.

### 5.2 Runtime artifact layout

Required runtime artifact layout:

```text
public/data/scope/v1/
  manifest.json
  names.json
  mag6p5/
    index.json
    r{raIndex}_d{decIndex}.bin
  mag8p0/
    index.json
    r{raIndex}_d{decIndex}.bin
  mag9p5/
    index.json
    r{raIndex}_d{decIndex}.bin
  mag10p5/
    index.json
    r{raIndex}_d{decIndex}.bin
```

Only non-empty tile binaries are emitted. Every band directory MUST still emit `index.json`.

---

## 6. Downloader design

### 6.1 Downloader CLI contract

`download-scope-source.mjs` MUST support:

- `--base-url <url>` (repeatable)
- `--dest <path>`
- `--force`
- `--expand`
- `--timeout-ms <int>`

Required defaults:
- destination root: `.cache/scope-source/tycho2/`
- timeout: `30000`
- force: `false`
- expand: `true`

### 6.2 Base URL resolution

The downloader MUST resolve candidate base URLs in this order:

1. all `--base-url` arguments, in order
2. `SKYLENS_SCOPE_SOURCE_BASE_URLS`, comma-separated
3. built-in fallback list

Built-in fallback list MUST be exactly:

1. `https://cdsarc.cds.unistra.fr/ftp/cats/I/259/`
2. `https://vizier.cfa.harvard.edu/vizier/ftp/cats/I/259/`

### 6.3 Required production file list

The downloader MUST attempt to acquire exactly these required files:

```text
ReadMe
tyc2.dat.00.gz
tyc2.dat.01.gz
tyc2.dat.02.gz
tyc2.dat.03.gz
tyc2.dat.04.gz
tyc2.dat.05.gz
tyc2.dat.06.gz
tyc2.dat.07.gz
tyc2.dat.08.gz
tyc2.dat.09.gz
tyc2.dat.10.gz
tyc2.dat.11.gz
tyc2.dat.12.gz
tyc2.dat.13.gz
tyc2.dat.14.gz
tyc2.dat.15.gz
tyc2.dat.16.gz
tyc2.dat.17.gz
tyc2.dat.18.gz
tyc2.dat.19.gz
```

### 6.4 Download validity rules

A cached file is considered valid when:
- it exists
- it is non-empty
- if `.gz`, it can be successfully decompressed
- if expanded, the expanded file is non-empty text

The downloader MUST skip valid files unless `--force` is set.

### 6.5 Failure behavior

The downloader MUST:
- continue attempting other files when one file fails within the same candidate base URL
- move to the next base URL candidate if any required file is still missing
- fail the whole command if any required file remains missing after all candidates are exhausted
- print a summary of success/failure per file and final candidate used

---

## 7. Production parse/build pipeline

### 7.1 Production source parser

The build script MUST parse Tycho-2 main catalog files only.

The parser MUST treat each expanded line as one 206-character record after stripping one trailing line ending. The line MUST be parsed by exact fixed byte positions.

Use this exact extraction table:

| Field | 1-based inclusive bytes | Parse type |
|---|---:|---|
| `TYC1` | `1-4` | integer |
| `TYC2` | `6-10` | integer |
| `TYC3` | `12-12` | integer |
| `pflag` | `14-14` | string |
| `RAmdeg` | `16-27` | float |
| `DEmdeg` | `29-40` | float |
| `pmRA` | `42-48` | float nullable |
| `pmDE` | `50-56` | float nullable |
| `BTmag` | `111-116` | float nullable |
| `VTmag` | `124-129` | float nullable |
| `HIP` | `143-148` | integer nullable |

Parser rules:
- substring extraction uses inclusive byte ranges converted to 0-based JS slice bounds
- blank numeric fields become `null`
- non-blank numeric fields that do not parse to finite numbers cause the row to be dropped if required by the inclusion rules
- `pflag` is trimmed to one character, default `''`

### 7.2 Production parser inclusion rules

The build MUST drop any Tycho-2 main-catalog row that has:
- non-finite or missing mean RA
- non-finite or missing mean Dec
- both BT and VT unusable
- non-finite derived `V`
- non-finite derived `B-V` after fallback and clamp
- `pflag = 'X'`

For PM:
- if `pmRA` is missing, set `pmRaMasPerYear = 0`
- if `pmDE` is missing, set `pmDecMasPerYear = 0`

### 7.3 Stable source id

Every normalized production row MUST carry a deterministic `sourceId` with exact format:

```text
TYC:{TYC1}-{TYC2}-{TYC3}
```

Examples:
- `TYC:1-13-1`
- `TYC:1234-5678-1`

This `sourceId` is internal to the build and verify pipeline and is not emitted directly to runtime tiles.

### 7.4 Name augmentation design

The build MUST resolve names in this precedence order:

#### Layer 1 — manual override CSV
If `data/scope-source/name-overrides.csv` exists:
- parse it strictly
- for `HIP`, match on numeric HIP
- for `TYC`, match on exact `TYC1-TYC2-TYC3`
- if multiple override rows target the same source row, fail the build

#### Layer 2 — built-in bright-star catalog join
Use `public/data/stars_200.json`:
- parse entries whose `id` matches `hip-<int>`
- build a `HIP -> normalizedName` map
- if the Tycho source row has that HIP, assign the bright-star name
- if duplicate HIP seed rows map to different normalized names, fail the build

#### Layer 3 — unnamed
If neither layer supplies a name, the row remains unnamed.

### 7.5 Photometry derivation

The build MUST derive `V` and `B-V` using the exact PRD rules.

Normalization steps:
1. parse BT and VT as nullable floats
2. derive `V` and `B-V`
3. clamp `B-V` into `[-1.0, 4.0]`
4. round both to 3 decimal places before canonical normalized record construction

### 7.6 Magnitude filter

The production build MUST keep only rows where:

```text
vMag <= 10.5
```

Rows with `vMag > 10.5` are dropped before tiling.

---

## 8. Development fallback pipeline

### 8.1 Development input

The development fallback source is:

```text
public/data/stars_200.json
```

This file is already present in the repository and MUST be treated as the seed set.

### 8.2 Deterministic fallback recipe

For each source entry, emit exactly 6 synthetic stars.

#### Constants

```ts
const DEV_SYNTHETIC_OFFSETS_DEG: ReadonlyArray<readonly [number, number]> = [
  [ 0.08,  0.03],
  [-0.09,  0.05],
  [ 0.04, -0.11],
  [-0.05, -0.08],
  [ 0.12, -0.02],
  [-0.13,  0.01],
]

const DEV_SYNTHETIC_MAGS: ReadonlyArray<number> = [
  6.4, 7.6, 8.4, 9.2, 10.0, 10.5,
]
```

#### Per-synthetic-row rules

For source star `s` and synthetic index `i`:
- `raDeg = wrap360(s.raDeg + DEV_SYNTHETIC_OFFSETS_DEG[i][0])`
- `decDeg = clamp(s.decDeg + DEV_SYNTHETIC_OFFSETS_DEG[i][1], -89.9, 89.9)`
- `pmRaMasPerYear = 0`
- `pmDecMasPerYear = 0`
- `vMag = DEV_SYNTHETIC_MAGS[i]`
- `bMinusV = 0`
- `sourceId = "DEV:" + s.id + ":" + i`

#### Naming rule
- for synthetic indices `0..4`, `displayName` MUST be absent
- for synthetic index `5`, if `s.name` normalizes to a non-empty string, set `displayName = normalized(s.name)`

This is required so the dev dataset always exercises:
- a non-empty `mag6p5` band
- deeper cumulative bands
- the named deep-star path deterministically

### 8.3 Development build invariants

The development build MUST:
- emit all four magnitude bands
- emit at least one non-empty tile for each band
- emit at least one named deep-star row when input source names exist
- use the exact same runtime file schema and row format as production

---

## 9. Banding and tiling

### 9.1 Band definitions

The build MUST emit cumulative bands:

- `6.5`
- `8.0`
- `9.5`
- `10.5`

Band directory names MUST be:

- `mag6p5`
- `mag8p0`
- `mag9p5`
- `mag10p5`

### 9.2 Grid definitions

Use these exact per-band grids:

| Band dir | Max mag | RA step | Dec step |
|---|---:|---:|---:|
| `mag6p5` | 6.5 | 90.0 | 45.0 |
| `mag8p0` | 8.0 | 45.0 | 30.0 |
| `mag9p5` | 9.5 | 22.5 | 22.5 |
| `mag10p5` | 10.5 | 11.25 | 11.25 |

### 9.3 Tile index calculation

For every emitted row:

```ts
const normalizedRaDeg = ((raDeg % 360) + 360) % 360
const raIndex = Math.floor(normalizedRaDeg / raStepDeg)

const shiftedDec = Math.min(179.999999, Math.max(0, decDeg + 90))
const decIndex = Math.floor(shiftedDec / decStepDeg)
```

Tile filename:

```ts
`r${raIndex}_d${decIndex}.bin`
```

### 9.4 Per-band tile index file

Each `index.json` MUST use this exact schema:

```ts
export interface ScopeBandIndex {
  bandDir: 'mag6p5' | 'mag8p0' | 'mag9p5' | 'mag10p5'
  maxMagnitude: 6.5 | 8.0 | 9.5 | 10.5
  raStepDeg: number
  decStepDeg: number
  tiles: Array<{
    raIndex: number
    decIndex: number
    file: string
    count: number
  }>
}
```

Tile entries MUST be sorted by:
1. `decIndex` ascending
2. `raIndex` ascending

---

## 10. Runtime artifact schemas

### 10.1 Manifest schema

The emitted `manifest.json` MUST use this exact shape:

```ts
export interface ScopeCatalogManifest {
  version: 1
  kind: 'dev' | 'prod'
  sourceCatalog: 'tycho2-main' | 'dev-synthetic-from-stars-200'
  epoch: 'J2000'
  rowFormat: 'scope-star-v2-le'
  namesPath: 'names.json'
  bands: Array<{
    bandDir: 'mag6p5' | 'mag8p0' | 'mag9p5' | 'mag10p5'
    maxMagnitude: 6.5 | 8.0 | 9.5 | 10.5
    raStepDeg: number
    decStepDeg: number
    indexPath: string
    totalRows: number
    namedRows: number
  }>
}
```

Rules:
- no timestamps
- deterministic band ordering: 6.5, 8.0, 9.5, 10.5

### 10.2 Names schema

`names.json` MUST be UTF-8 JSON of exact shape:

```ts
export type ScopeNameTable = Record<string, string>
```

Rules:
- keys are positive integer ids serialized as strings
- value is the final normalized display name
- `0` MUST NOT exist
- keys MUST be emitted in ascending numeric order

### 10.3 Binary tile row format

Each tile MUST use **20-byte fixed-width little-endian rows** in this exact order:

1. `uint32 raMicroDeg`
2. `int32 decMicroDeg`
3. `int16 pmRaMasPerYear`
4. `int16 pmDecMasPerYear`
5. `int16 vMagMilli`
6. `int16 bMinusVMilli`
7. `uint32 nameId`

Decode rules:
- `raDeg = raMicroDeg / 1_000_000`
- `decDeg = decMicroDeg / 1_000_000`
- `pmRaMasPerYear` raw integer
- `pmDecMasPerYear` raw integer
- `vMag = vMagMilli / 1000`
- `bMinusV = bMinusVMilli / 1000`
- `nameId = 0` means unnamed

### 10.4 Runtime record bounds

The builder and verifier MUST enforce:

- `0 <= raMicroDeg < 360_000_000`
- `-90_000_000 <= decMicroDeg <= 90_000_000`
- `-32768 <= pm* <= 32767`
- `-1000 <= bMinusVMilli <= 4000`
- `0 <= vMagMilli <= 10500`
- `nameId >= 0`

---

## 11. Determinism rules

The build MUST be byte-deterministic.

Required rules:

1. Manifest contains no timestamps.
2. Names are assigned by sorted unique normalized name set.
3. Tile rows use deterministic sort.
4. JSON is serialized with:
   - UTF-8
   - two-space indentation
   - trailing newline `\n`
   - exact key order specified below
5. Output directory replacement is atomic.

### 11.1 Exact JSON key order

#### `manifest.json` top-level key order
1. `version`
2. `kind`
3. `sourceCatalog`
4. `epoch`
5. `rowFormat`
6. `namesPath`
7. `bands`

#### `manifest.json` band object key order
1. `bandDir`
2. `maxMagnitude`
3. `raStepDeg`
4. `decStepDeg`
5. `indexPath`
6. `totalRows`
7. `namedRows`

#### `index.json` top-level key order
1. `bandDir`
2. `maxMagnitude`
3. `raStepDeg`
4. `decStepDeg`
5. `tiles`

#### `index.json` tile object key order
1. `raIndex`
2. `decIndex`
3. `file`
4. `count`

#### `report.json` top-level key order
1. `version`
2. `mode`
3. `sourceCatalog`
4. `rawFiles`
5. `parsedRows`
6. `droppedRows`
7. `names`
8. `bands`

If two builds use identical inputs and identical overrides, the emitted runtime artifact bytes MUST be identical.

---

## 12. Atomic output strategy

The builder MUST write to:

```text
.cache/scope-build/staging-v1/
```

Then, only after a full successful verify pass:
- remove any previous `public/data/scope/v1/`
- move the staged output into `public/data/scope/v1/`

If build or verify fails:
- the current active dataset MUST remain unchanged
- staged output MAY be retained for debugging under cache paths only

---

## 13. Verification rules

### 13.1 Verifier CLI contract

`verify-scope-dataset.mjs` MUST support:
- `--dataset-root <path>`
- `--kind <auto|dev|prod>`

Required defaults:
- `dataset-root = public/data/scope/v1`
- `kind = auto`

### 13.2 Manifest verification

The verifier MUST confirm:
- manifest file exists
- version is `1`
- kind is `dev` or `prod`
- source catalog value is valid
- row format is `scope-star-v2-le`
- names path exists
- each band directory exists
- each band index exists

### 13.3 Names verification

The verifier MUST confirm:
- `names.json` parses
- every key is a positive integer string
- no key equals `"0"`
- keys are strictly ascending numeric order
- every value is a non-empty normalized string after trim and NFC normalization

### 13.4 Tile verification

For every listed tile:
- file exists
- byte length is divisible by 20
- decoded row count equals listed `count`
- all numeric fields satisfy bounds
- every non-zero `nameId` exists in `names.json`

### 13.5 Aggregate verification

The verifier MUST confirm:
- manifest `totalRows` equals actual total rows for each band
- manifest `namedRows` equals actual named row count for each band
- every tile listed in band index exists
- no extra `.bin` files exist that are absent from the band index
- every `nameId` in `names.json` is referenced by at least one emitted row

### 13.6 Development-specific verification

When `kind === 'dev'` or when auto-detected manifest kind is `dev`, the verifier MUST additionally confirm:
- all PM values are zero
- all `bMinusV` values are zero
- at least one `nameId > 0` exists if input `stars_200.json` contains at least one non-empty `name`
- total rows in `mag10p5` > total rows in `mag6p5`
- total rows in `mag6p5` > 0

---

## 14. Build report schema

The builder MUST emit `.cache/scope-build/report.json` with this exact shape:

```ts
export interface ScopeDatasetBuildReport {
  version: 1
  mode: 'dev' | 'prod'
  sourceCatalog: 'tycho2-main' | 'dev-synthetic-from-stars-200'
  rawFiles: {
    required: number
    present: number
  }
  parsedRows: number
  droppedRows: {
    invalidLength: number
    missingRa: number
    missingDec: number
    missingPhotometry: number
    invalidDerivedPhotometry: number
    pflagX: number
    tooFaint: number
  }
  names: {
    unique: number
    emittedRows: number
  }
  bands: Array<{
    bandDir: 'mag6p5' | 'mag8p0' | 'mag9p5' | 'mag10p5'
    totalRows: number
    namedRows: number
    tiles: number
  }>
}
```

This report is non-runtime and MAY contain timestamps only if the implementation adds extra diagnostic fields outside this exact schema under a separate cache-only file. The exact report above MUST remain timestamp-free if emitted under the required path.

---

## 15. Testing plan

### 15.1 Unit tests to add

#### `tests/unit/scope-data-download.test.ts`
Cover:
- URL candidate ordering
- skip-valid-file behavior
- force-redownload behavior
- failure after all candidates exhausted
- expansion behavior

#### `tests/unit/scope-data-parse.test.ts`
Cover:
- Tycho-2 row extraction for required fields
- exact 206-char line validation
- drop rules for invalid rows
- photometry derivation rules
- `pflag = X` exclusion
- PM zero fallback

#### `tests/unit/scope-data-names.test.ts`
Cover:
- override CSV parsing
- name normalization
- HIP join from `stars_200.json`
- precedence rules
- duplicate HIP conflict failure
- deterministic `nameId` assignment
- orphan-name prevention

#### `tests/unit/scope-data-tiling.test.ts`
Cover:
- RA normalization
- Dec clamping
- band inclusion
- tile indexing
- deterministic tile row sorting

#### `tests/unit/scope-data-dev-fallback.test.ts`
Cover:
- exact synthetic offsets
- exact synthetic magnitudes including `6.4`
- deterministic naming on index 5 only
- zero PM and zero color
- non-empty `mag6p5`

#### `tests/unit/scope-data-verify.test.ts`
Cover:
- manifest validation
- names validation
- tile length divisibility
- count reconciliation
- unresolved `nameId` failure
- orphan `names.json` key failure

### 15.2 Integration test to add

#### `tests/unit/scope-data-build.integration.test.ts`
Run the dev build end-to-end and confirm:
- output tree exists
- manifest and band indexes are valid
- at least one named deep row exists
- every band has at least one row
- byte-for-byte identical output on repeated build

---

## 16. Implementation sequence

The coding agent MUST implement in this order:

### Phase 1 — downloader
1. add cache directories and ignore rules
2. implement `download-scope-source.mjs`
3. add download unit tests

### Phase 2 — builder core
1. implement Tycho-2 parse path
2. implement normalized internal record shape
3. implement photometry derivation
4. implement banding and tiling
5. implement names table and manifest emission

### Phase 3 — dev fallback
1. implement deterministic synthetic build from `stars_200.json`
2. add dev fallback tests
3. ensure exact same output schema as production

### Phase 4 — verifier
1. implement `verify-scope-dataset.mjs`
2. add schema and aggregate validation tests

### Phase 5 — package/public integration
1. add npm scripts
2. ensure final artifacts land in `public/data/scope/v1/`
3. ensure build is atomic and deterministic
4. commit deterministic dev output

---

## 17. Completion checklist

Implementation is complete only when all items below are true.

- [ ] Downloader script exists and is wired to npm
- [ ] Build script exists and is wired to npm
- [ ] Verify script exists and is wired to npm
- [ ] Raw source cache is outside `public/`
- [ ] Runtime output is under `public/data/scope/v1/`
- [ ] Production build uses Tycho-2 main catalog only
- [ ] Default downloader URL list is implemented exactly
- [ ] Parser uses the exact 206-byte line contract and byte ranges
- [ ] Development build uses deterministic fallback from `public/data/stars_200.json`
- [ ] Development fallback emits a non-empty `mag6p5`
- [ ] Names are augmented in precedence order and emitted through `names.json`
- [ ] Name normalization, dedup, and `nameId` assignment are deterministic
- [ ] `names.json` contains only emitted names
- [ ] Every tile uses the exact 20-byte row format
- [ ] Every band emits `index.json`
- [ ] Manifest is deterministic and timestamp-free
- [ ] Dev build is offline-capable
- [ ] Repeated identical builds produce identical bytes
- [ ] Verify command catches schema, count, and orphan-name errors
