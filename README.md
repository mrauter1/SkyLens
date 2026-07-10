# SkyLens

SkyLens is a static Next.js sky viewer with live phone-orientation, camera, and location
support plus a deterministic demo mode. The maintained application lives at this repository
root. The former nested `SkyLensServerless/` app and stale root implementation have been
consolidated; there is one runnable package and one npm lockfile.

## Run and verify

Requirements: a current Node.js release supported by Next.js 16 and npm.

```sh
npm ci
npm run dev
```

The main checks are:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`npm run build` creates the static export in `out/`; `npm start` serves that export and
applies its `_headers` rules locally. Playwright's default matrix covers 360x640, Pixel 7,
768x1024 touch portrait, 1366x768, and 1440x960. To prepare a Linux host for the optional
WebKit project, run `npx playwright install webkit` and (with system-package privileges)
`sudo npx playwright install-deps webkit`, then run `npm run test:e2e:webkit`. Desktop WebKit
is useful regression coverage but is not a substitute for a physical iPhone.

## Scope data

Development uses the local dataset in `public/data/scope/v1` by default. Binary tiles are
generated and intentionally ignored by Git. The `dev` and `build` preflights preserve a
complete existing local dataset or generate the deterministic development fallback when tiles
are absent:

```sh
npm run scope:data:build:dev
npm run scope:data:verify
```

Production uses remote R2 data only when
`NEXT_PUBLIC_SKYLENS_SCOPE_REMOTE_ENABLED=true` and
`NEXT_PUBLIC_SKYLENS_SCOPE_REMOTE_BASE_URL` are explicitly configured. The declarative
Render service enables that production setting.

## Deployment

[`render.yaml`](render.yaml) defines the root build, `out` publish directory, production
scope-data variables, and the required `Permissions-Policy` response header. After deploying,
verify the live contract with:

```sh
npm run check:live-contract -- https://your-site.example
```

For iframe use, delegate `camera`, `geolocation`, `accelerometer`, `gyroscope`, and
`magnetometer`; `/embed-validation` is the shipped same-origin contract fixture.

## Documentation

- Current product and data architecture: [`docs/architecture/`](docs/architecture/)
- UX/UI and iOS permission audits: [`docs/audits/`](docs/audits/)
- Physical Mobile Safari release check: [`docs/testing/MOBILE_SAFARI_VALIDATION.md`](docs/testing/MOBILE_SAFARI_VALIDATION.md)
- Historical plans and stale-root records: [`docs/archive/`](docs/archive/)

The live viewer never treats URL permission values as current browser authorization. Motion,
camera, and location are revalidated at runtime and requested in that order from a user action.
