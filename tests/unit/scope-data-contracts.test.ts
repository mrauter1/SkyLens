import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import {
  SCOPE_BAND_DEFINITIONS,
  SCOPE_BUILD_REPORT_RELATIVE_PATH,
  SCOPE_BUILD_STAGING_RELATIVE_ROOT,
  SCOPE_DATASET_RELATIVE_ROOT,
  SCOPE_DEFAULT_SOURCE_BASE_URLS,
  SCOPE_REQUIRED_TYCHO2_FILES,
  SCOPE_ROW_SIZE_BYTES,
  ScopeBandIndexSchema,
  ScopeBuildReportSchema,
  ScopeCatalogManifestSchema,
} from '../../lib/scope-data/contracts.mjs'
import {
  formatBuildUsage,
  formatDownloadUsage,
  formatVerifyUsage,
  parseBuildCommandArgs,
  parseDownloadCommandArgs,
  parseVerifyCommandArgs,
  resolveScopeSourceBaseUrls,
} from '../../lib/scope-data/cli.mjs'
import {
  createScopeBandIndex,
  createScopeBuildReport,
  createScopeCatalogManifest,
  createScopeManifestBand,
  serializeDeterministicJson,
} from '../../lib/scope-data/json.mjs'
import {
  buildBrightStarHipNameMap,
  buildScopeNameTable,
  normalizeScopeDisplayName,
  parseHipIdFromSeedStarId,
} from '../../lib/scope-data/names.mjs'
import {
  REPO_ROOT,
  getBrightStarsCatalogPath,
  getScopeBuildReportPath,
  getScopeBuildStagingRoot,
  getScopeDatasetRoot,
  getTycho2Root,
} from '../../lib/scope-data/paths.mjs'
import {
  compareNormalizedScopeStars,
  decodeScopeStarRow,
  decodeScopeStarTile,
  encodeScopeStarRow,
  getBandsForMagnitude,
  getTileFileName,
  getTileIndices,
} from '../../lib/scope-data/tiles.mjs'

describe('scope-data contracts', () => {
  it('wires the required root npm scripts and ignore rules', async () => {
    const packageJson = JSON.parse(
      await readFile(`${REPO_ROOT}/package.json`, 'utf8')
    ) as {
      scripts: Record<string, string>
    }
    const gitignore = await readFile(`${REPO_ROOT}/.gitignore`, 'utf8')

    expect(packageJson.scripts['scope:data:download']).toBe(
      'node scripts/download-scope-source.mjs'
    )
    expect(packageJson.scripts['scope:data:build']).toBe(
      'node scripts/build-scope-dataset.mjs --mode prod'
    )
    expect(packageJson.scripts['scope:data:build:dev']).toBe(
      'node scripts/build-scope-dataset.mjs --mode dev'
    )
    expect(packageJson.scripts['scope:data:verify']).toBe(
      'node scripts/verify-scope-dataset.mjs --dataset-root public/data/scope/v1'
    )

    const gitignoreLines = gitignore
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    expect(gitignoreLines).toContain('.cache/scope-source/')
    expect(gitignoreLines).toContain('.cache/scope-build/')
    expect(gitignoreLines).not.toContain('public/data/scope/v1/')
  })

  it('locks the exact downloader and band constants from the ADR', () => {
    expect(SCOPE_DEFAULT_SOURCE_BASE_URLS).toEqual([
      'https://cdsarc.cds.unistra.fr/ftp/cats/I/259/',
      'https://vizier.cfa.harvard.edu/vizier/ftp/cats/I/259/',
    ])
    expect(SCOPE_REQUIRED_TYCHO2_FILES).toHaveLength(21)
    expect(SCOPE_REQUIRED_TYCHO2_FILES[0]).toBe('ReadMe')
    expect(SCOPE_REQUIRED_TYCHO2_FILES.at(-1)).toBe('tyc2.dat.19.gz')
    expect(SCOPE_BAND_DEFINITIONS).toEqual([
      { bandDir: 'mag6p5', maxMagnitude: 6.5, raStepDeg: 90, decStepDeg: 45 },
      { bandDir: 'mag8p0', maxMagnitude: 8, raStepDeg: 45, decStepDeg: 30 },
      { bandDir: 'mag9p5', maxMagnitude: 9.5, raStepDeg: 22.5, decStepDeg: 22.5 },
      { bandDir: 'mag10p5', maxMagnitude: 10.5, raStepDeg: 11.25, decStepDeg: 11.25 },
    ])
  })

  it('resolves repository-rooted scope-data paths', () => {
    expect(REPO_ROOT).toBe('/workspace/SkyLens')
    expect(getTycho2Root()).toBe('/workspace/SkyLens/.cache/scope-source/tycho2')
    expect(getScopeDatasetRoot()).toBe('/workspace/SkyLens/public/data/scope/v1')
    expect(getScopeBuildStagingRoot()).toBe(
      `/workspace/SkyLens/${SCOPE_BUILD_STAGING_RELATIVE_ROOT}`
    )
    expect(getScopeBuildReportPath()).toBe(
      `/workspace/SkyLens/${SCOPE_BUILD_REPORT_RELATIVE_PATH}`
    )
    expect(getBrightStarsCatalogPath()).toBe('/workspace/SkyLens/public/data/stars_200.json')
    expect(SCOPE_DATASET_RELATIVE_ROOT).toBe('public/data/scope/v1')
  })

  it('normalizes and deduplicates names deterministically', () => {
    expect(normalizeScopeDisplayName('  Alpha\t Centauri  ')).toBe('Alpha Centauri')
    expect(normalizeScopeDisplayName('   ')).toBeUndefined()
    expect(parseHipIdFromSeedStarId('hip-32349')).toBe(32349)
    expect(parseHipIdFromSeedStarId('tyc-1-2-3')).toBeUndefined()

    const { uniqueNames, nameTable, nameIdByValue } = buildScopeNameTable([
      ' Sirius ',
      'Canopus',
      'Sirius',
      '',
    ])

    expect(uniqueNames).toEqual(['Canopus', 'Sirius'])
    expect(nameTable).toEqual({ '1': 'Canopus', '2': 'Sirius' })
    expect(nameIdByValue.get('Canopus')).toBe(1)
    expect(nameIdByValue.get('Sirius')).toBe(2)
  })

  it('builds the bright-star HIP map and rejects conflicting names', () => {
    expect(
      buildBrightStarHipNameMap([
        { id: 'hip-32349', name: 'Sirius' },
        { id: 'hip-32349', name: ' Sirius ' },
        { id: 'not-hip', name: 'Ignored' },
      ])
    ).toEqual(new Map([[32349, 'Sirius']]))

    expect(() =>
      buildBrightStarHipNameMap([
        { id: 'hip-32349', name: 'Sirius' },
        { id: 'hip-32349', name: 'Dog Star' },
      ])
    ).toThrow(/Conflicting normalized bright-star names/)
  })

  it('creates manifest, index, and report objects with deterministic key order', () => {
    const manifest = createScopeCatalogManifest({
      kind: 'dev',
      sourceCatalog: 'dev-synthetic-from-stars-200',
      bands: SCOPE_BAND_DEFINITIONS.map((band, index) =>
        createScopeManifestBand({
          ...band,
          totalRows: index + 1,
          namedRows: index,
        })
      ),
    })
    const bandIndex = createScopeBandIndex({
      ...SCOPE_BAND_DEFINITIONS[0],
      tiles: [
        { raIndex: 1, decIndex: 2, file: 'r1_d2.bin', count: 4 },
        { raIndex: 0, decIndex: 1, file: 'r0_d1.bin', count: 2 },
      ],
    })
    const report = createScopeBuildReport({
      mode: 'dev',
      sourceCatalog: 'dev-synthetic-from-stars-200',
      rawFiles: { required: 21, present: 0 },
      parsedRows: 12,
      droppedRows: {
        invalidLength: 0,
        missingRa: 0,
        missingDec: 0,
        missingPhotometry: 0,
        invalidDerivedPhotometry: 0,
        pflagX: 0,
        tooFaint: 0,
      },
      names: { unique: 2, emittedRows: 8 },
      bands: SCOPE_BAND_DEFINITIONS.map((band, index) => ({
        bandDir: band.bandDir,
        totalRows: index + 1,
        namedRows: index,
        tiles: index + 2,
      })),
    })

    expect(Object.keys(manifest)).toEqual([
      'version',
      'kind',
      'sourceCatalog',
      'epoch',
      'rowFormat',
      'namesPath',
      'bands',
    ])
    expect(Object.keys(manifest.bands[0])).toEqual([
      'bandDir',
      'maxMagnitude',
      'raStepDeg',
      'decStepDeg',
      'indexPath',
      'totalRows',
      'namedRows',
    ])
    expect(Object.keys(bandIndex)).toEqual([
      'bandDir',
      'maxMagnitude',
      'raStepDeg',
      'decStepDeg',
      'tiles',
    ])
    expect(bandIndex.tiles).toEqual([
      { raIndex: 0, decIndex: 1, file: 'r0_d1.bin', count: 2 },
      { raIndex: 1, decIndex: 2, file: 'r1_d2.bin', count: 4 },
    ])
    expect(Object.keys(report)).toEqual([
      'version',
      'mode',
      'sourceCatalog',
      'rawFiles',
      'parsedRows',
      'droppedRows',
      'names',
      'bands',
    ])
    expect(serializeDeterministicJson({ a: 1 })).toBe('{\n  "a": 1\n}\n')
  })

  it('rejects non-canonical band contracts and unknown schema keys', () => {
    const manifestBands = SCOPE_BAND_DEFINITIONS.map((band, index) =>
      createScopeManifestBand({
        ...band,
        totalRows: index + 1,
        namedRows: index,
      })
    )
    const reportBands = SCOPE_BAND_DEFINITIONS.map((band, index) => ({
      bandDir: band.bandDir,
      totalRows: index + 1,
      namedRows: index,
      tiles: index + 2,
    }))

    expect(() =>
      createScopeManifestBand({
        bandDir: 'mag6p5',
        maxMagnitude: 8,
        raStepDeg: 90,
        decStepDeg: 45,
        totalRows: 1,
        namedRows: 0,
      })
    ).toThrow()
    expect(() =>
      createScopeCatalogManifest({
        kind: 'dev',
        sourceCatalog: 'dev-synthetic-from-stars-200',
        bands: [...manifestBands].reverse(),
      })
    ).toThrow()
    expect(() =>
      createScopeBuildReport({
        mode: 'dev',
        sourceCatalog: 'dev-synthetic-from-stars-200',
        rawFiles: { required: 21, present: 0 },
        parsedRows: 12,
        droppedRows: {
          invalidLength: 0,
          missingRa: 0,
          missingDec: 0,
          missingPhotometry: 0,
          invalidDerivedPhotometry: 0,
          pflagX: 0,
          tooFaint: 0,
        },
        names: { unique: 2, emittedRows: 8 },
        bands: [...reportBands].reverse(),
      })
    ).toThrow()
    expect(() =>
      createScopeBandIndex({
        bandDir: 'mag6p5',
        maxMagnitude: 8,
        raStepDeg: 90,
        decStepDeg: 45,
        tiles: [],
      })
    ).toThrow()
    expect(() =>
      ScopeCatalogManifestSchema.parse({
        version: 1,
        kind: 'dev',
        sourceCatalog: 'dev-synthetic-from-stars-200',
        epoch: 'J2000',
        rowFormat: 'scope-star-v2-le',
        namesPath: 'names.json',
        bands: manifestBands,
        extra: true,
      })
    ).toThrow(/unrecognized_keys/)
    expect(() =>
      ScopeBandIndexSchema.parse({
        ...SCOPE_BAND_DEFINITIONS[0],
        tiles: [],
        extra: true,
      })
    ).toThrow(/unrecognized_keys/)
    expect(() =>
      ScopeBuildReportSchema.parse({
        version: 1,
        mode: 'dev',
        sourceCatalog: 'dev-synthetic-from-stars-200',
        rawFiles: { required: 21, present: 0 },
        parsedRows: 12,
        droppedRows: {
          invalidLength: 0,
          missingRa: 0,
          missingDec: 0,
          missingPhotometry: 0,
          invalidDerivedPhotometry: 0,
          pflagX: 0,
          tooFaint: 0,
        },
        names: { unique: 2, emittedRows: 8 },
        bands: reportBands,
        extra: true,
      })
    ).toThrow(/unrecognized_keys/)
  })

  it('encodes, decodes, and sorts tile rows against the fixed runtime format', () => {
    const encoded = encodeScopeStarRow({
      raDeg: 101.2872,
      decDeg: -16.7161,
      pmRaMasPerYear: -546,
      pmDecMasPerYear: -1223,
      vMag: 1.234,
      bMinusV: 0.456,
      nameId: 7,
    })

    expect(encoded).toHaveLength(SCOPE_ROW_SIZE_BYTES)
    expect(decodeScopeStarRow(encoded)).toEqual({
      raDeg: 101.2872,
      decDeg: -16.7161,
      pmRaMasPerYear: -546,
      pmDecMasPerYear: -1223,
      vMag: 1.234,
      bMinusV: 0.456,
      nameId: 7,
    })
    expect(decodeScopeStarTile(Buffer.concat([encoded, encoded]))).toHaveLength(2)
    expect(getBandsForMagnitude(6.4).map((band) => band.bandDir)).toEqual([
      'mag6p5',
      'mag8p0',
      'mag9p5',
      'mag10p5',
    ])
    expect(getTileIndices({ raDeg: -1, decDeg: 12 }, SCOPE_BAND_DEFINITIONS[1])).toEqual({
      raIndex: 7,
      decIndex: 3,
    })
    expect(getTileFileName(7, 3)).toBe('r7_d3.bin')
    expect(
      [
        { sourceId: 'b', vMag: 1.2, decDeg: 5, raDeg: 6 },
        { sourceId: 'a', vMag: 1.2, decDeg: 5, raDeg: 4 },
      ].sort(compareNormalizedScopeStars)
    ).toEqual([
      { sourceId: 'a', vMag: 1.2, decDeg: 5, raDeg: 4 },
      { sourceId: 'b', vMag: 1.2, decDeg: 5, raDeg: 6 },
    ])
  })

  it('parses CLI arguments and usage text for the root script surface', () => {
    expect(
      resolveScopeSourceBaseUrls({
        envValue: 'https://example-a.test, https://example-b.test',
      })
    ).toEqual(['https://example-a.test', 'https://example-b.test'])
    expect(resolveScopeSourceBaseUrls({ cliBaseUrls: ['https://override.test'] })).toEqual([
      'https://override.test',
    ])
    expect(parseDownloadCommandArgs([])).toEqual({
      baseUrls: [...SCOPE_DEFAULT_SOURCE_BASE_URLS],
      dest: '/workspace/SkyLens/.cache/scope-source/tycho2',
      force: false,
      expand: true,
      timeoutMs: 30000,
      help: false,
    })
    expect(parseBuildCommandArgs(['--mode', 'dev'])).toEqual({
      mode: 'dev',
      help: false,
    })
    expect(parseVerifyCommandArgs([])).toEqual({
      datasetRoot: '/workspace/SkyLens/public/data/scope/v1',
      kind: 'auto',
      help: false,
    })
    expect(formatDownloadUsage()).toContain('download-scope-source.mjs')
    expect(formatBuildUsage()).toContain('--mode <prod|dev>')
    expect(formatVerifyUsage()).toContain('--kind <auto|dev|prod>')
  })
})
