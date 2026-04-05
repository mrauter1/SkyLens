import { afterEach, describe, expect, it } from 'vitest'

import {
  createScopeRequestTracker,
  loadScopeBandIndex,
  loadScopeManifest,
  loadScopeNamesTable,
  loadScopeTileRows,
  resetScopeCatalogSessionCacheForTests,
} from '../../lib/scope/catalog'
import {
  applyScopeProperMotion,
  convertScopeEquatorialToHorizontal,
  convertScopeHorizontalToEquatorial,
} from '../../lib/scope/coordinates'
import {
  areScopeDeepStarsDaylightSuppressed,
  selectScopeBand,
} from '../../lib/scope/depth'
import {
  getScopeTileSelectionRadiusDeg,
  selectScopeTilesForPointing,
} from '../../lib/scope/position-tiles'

describe('scope runtime modules', () => {
  afterEach(() => {
    resetScopeCatalogSessionCacheForTests()
  })

  it('selects scope depth bands with the ADR threshold and alignment rules', () => {
    expect(
      selectScopeBand({
        scopeVerticalFovDeg: 16,
        cameraMode: 'sensor',
        orientationStatus: 'granted',
        latestOrientationSampleAgeMs: 120,
        alignmentHealth: 'good',
      }).bandDir,
    ).toBe('mag6p5')
    expect(
      selectScopeBand({
        scopeVerticalFovDeg: 12,
        cameraMode: 'sensor',
        orientationStatus: 'granted',
        latestOrientationSampleAgeMs: 120,
        alignmentHealth: 'good',
      }).bandDir,
    ).toBe('mag8p0')
    expect(
      selectScopeBand({
        scopeVerticalFovDeg: 7,
        cameraMode: 'sensor',
        orientationStatus: 'granted',
        latestOrientationSampleAgeMs: 120,
        alignmentHealth: 'good',
      }).bandDir,
    ).toBe('mag9p5')
    expect(
      selectScopeBand({
        scopeVerticalFovDeg: 4,
        cameraMode: 'sensor',
        orientationStatus: 'granted',
        latestOrientationSampleAgeMs: 120,
        alignmentHealth: 'good',
      }).bandDir,
    ).toBe('mag10p5')
    expect(
      selectScopeBand({
        scopeVerticalFovDeg: 4,
        cameraMode: 'manual',
        orientationStatus: 'granted',
        latestOrientationSampleAgeMs: 120,
        alignmentHealth: 'good',
      }).bandDir,
    ).toBe('mag9p5')
  })

  it('applies the shared likely-visible daylight suppression for deep stars', () => {
    expect(
      areScopeDeepStarsDaylightSuppressed({
        likelyVisibleOnly: true,
        sunAltitudeDeg: -2,
      }),
    ).toBe(true)
    expect(
      areScopeDeepStarsDaylightSuppressed({
        likelyVisibleOnly: true,
        sunAltitudeDeg: -12,
      }),
    ).toBe(false)
  })

  it('wrap-selects scope tiles across the 0/360 RA boundary', () => {
    const tiles = selectScopeTilesForPointing({
      index: {
        bandDir: 'mag10p5',
        maxMagnitude: 10.5,
        raStepDeg: 11.25,
        decStepDeg: 11.25,
        tiles: [
          { raIndex: 31, decIndex: 8, file: 'r31_d8.bin', count: 4 },
          { raIndex: 0, decIndex: 8, file: 'r0_d8.bin', count: 4 },
          { raIndex: 1, decIndex: 8, file: 'r1_d8.bin', count: 4 },
        ],
      },
      centerRaDeg: 359.5,
      centerDecDeg: 0,
      selectionRadiusDeg: 8,
    })

    expect(tiles.map((tile) => tile.file)).toEqual(['r31_d8.bin', 'r0_d8.bin'])
  })

  it('widens RA coverage using the worst declination reached by the padded view', () => {
    const tiles = selectScopeTilesForPointing({
      index: {
        bandDir: 'mag10p5',
        maxMagnitude: 10.5,
        raStepDeg: 11.25,
        decStepDeg: 11.25,
        tiles: [
          { raIndex: 24, decIndex: 15, file: 'r24_d15.bin', count: 1 },
          { raIndex: 0, decIndex: 15, file: 'r0_d15.bin', count: 1 },
          { raIndex: 8, decIndex: 15, file: 'r8_d15.bin', count: 1 },
          { raIndex: 16, decIndex: 15, file: 'r16_d15.bin', count: 1 },
        ],
      },
      centerRaDeg: 0,
      centerDecDeg: 75,
      selectionRadiusDeg: 10,
    })

    expect(tiles.map((tile) => tile.file)).toEqual(['r24_d15.bin', 'r0_d15.bin', 'r8_d15.bin'])
  })

  it('selects every RA tile in-band when the padded view reaches the pole', () => {
    const tiles = selectScopeTilesForPointing({
      index: {
        bandDir: 'mag10p5',
        maxMagnitude: 10.5,
        raStepDeg: 11.25,
        decStepDeg: 11.25,
        tiles: [
          { raIndex: 0, decIndex: 15, file: 'r0_d15.bin', count: 1 },
          { raIndex: 8, decIndex: 15, file: 'r8_d15.bin', count: 1 },
          { raIndex: 16, decIndex: 15, file: 'r16_d15.bin', count: 1 },
          { raIndex: 24, decIndex: 15, file: 'r24_d15.bin', count: 1 },
          { raIndex: 0, decIndex: 12, file: 'r0_d12.bin', count: 1 },
        ],
      },
      centerRaDeg: 45,
      centerDecDeg: 86,
      selectionRadiusDeg: 6,
    })

    expect(tiles.map((tile) => tile.file)).toEqual([
      'r0_d15.bin',
      'r8_d15.bin',
      'r16_d15.bin',
      'r24_d15.bin',
    ])
  })

  it('keeps portrait scope selection aligned to the square lens viewport', () => {
    const portraitStageRadiusDeg = getScopeTileSelectionRadiusDeg({
      verticalFovDeg: 10,
      viewportWidth: 390,
      viewportHeight: 844,
    })
    const squareLensRadiusDeg = getScopeTileSelectionRadiusDeg({
      verticalFovDeg: 10,
      viewportWidth: 226.2,
      viewportHeight: 226.2,
    })

    const portraitTiles = selectScopeTilesForPointing({
      index: {
        bandDir: 'mag9p5',
        maxMagnitude: 9.5,
        raStepDeg: 360,
        decStepDeg: 1,
        tiles: [
          { raIndex: 0, decIndex: 90, file: 'center.bin', count: 1 },
          { raIndex: 0, decIndex: 98, file: 'lens-edge.bin', count: 1 },
        ],
      },
      centerRaDeg: 120,
      centerDecDeg: 0.4,
      selectionRadiusDeg: portraitStageRadiusDeg,
    })
    const squareLensTiles = selectScopeTilesForPointing({
      index: {
        bandDir: 'mag9p5',
        maxMagnitude: 9.5,
        raStepDeg: 360,
        decStepDeg: 1,
        tiles: [
          { raIndex: 0, decIndex: 90, file: 'center.bin', count: 1 },
          { raIndex: 0, decIndex: 98, file: 'lens-edge.bin', count: 1 },
        ],
      },
      centerRaDeg: 120,
      centerDecDeg: 0.4,
      selectionRadiusDeg: squareLensRadiusDeg,
    })

    expect(portraitStageRadiusDeg).toBeLessThan(squareLensRadiusDeg)
    expect(portraitTiles.map((tile) => tile.file)).toEqual(['center.bin'])
    expect(squareLensTiles.map((tile) => tile.file)).toEqual(['center.bin', 'lens-edge.bin'])
  })

  it('avoids wide-stage overfetch by ignoring the full-stage aspect ratio', () => {
    const squareLensRadiusDeg = getScopeTileSelectionRadiusDeg({
      verticalFovDeg: 10,
      viewportWidth: 226.2,
      viewportHeight: 226.2,
    })
    const wideStageRadiusDeg = getScopeTileSelectionRadiusDeg({
      verticalFovDeg: 10,
      viewportWidth: 844,
      viewportHeight: 390,
    })

    const squareLensTiles = selectScopeTilesForPointing({
      index: {
        bandDir: 'mag9p5',
        maxMagnitude: 9.5,
        raStepDeg: 360,
        decStepDeg: 1,
        tiles: [
          { raIndex: 0, decIndex: 90, file: 'center.bin', count: 1 },
          { raIndex: 0, decIndex: 101, file: 'wide-only.bin', count: 1 },
        ],
      },
      centerRaDeg: 120,
      centerDecDeg: 0.4,
      selectionRadiusDeg: squareLensRadiusDeg,
    })
    const wideStageTiles = selectScopeTilesForPointing({
      index: {
        bandDir: 'mag9p5',
        maxMagnitude: 9.5,
        raStepDeg: 360,
        decStepDeg: 1,
        tiles: [
          { raIndex: 0, decIndex: 90, file: 'center.bin', count: 1 },
          { raIndex: 0, decIndex: 101, file: 'wide-only.bin', count: 1 },
        ],
      },
      centerRaDeg: 120,
      centerDecDeg: 0.4,
      selectionRadiusDeg: wideStageRadiusDeg,
    })

    expect(wideStageRadiusDeg).toBeGreaterThan(squareLensRadiusDeg)
    expect(squareLensTiles.map((tile) => tile.file)).toEqual(['center.bin'])
    expect(wideStageTiles.map((tile) => tile.file)).toEqual(['center.bin', 'wide-only.bin'])
  })

  it('applies proper motion and round-trips horizontal/equatorial coordinates', () => {
    const moved = applyScopeProperMotion(
      {
        raDeg: 100,
        decDeg: -20,
        pmRaMasPerYear: 200,
        pmDecMasPerYear: -100,
      },
      2025,
    )

    expect(moved.raDeg).toBeCloseTo(100.001389, 6)
    expect(moved.decDeg).toBeCloseTo(-20.000694, 6)

    const observer = {
      lat: 37.7749,
      lon: -122.4194,
      altMeters: 15,
      timestampMs: Date.UTC(2026, 3, 5, 4, 0, 0),
      source: 'demo' as const,
    }
    const equatorial = convertScopeHorizontalToEquatorial(
      {
        azimuthDeg: 180,
        elevationDeg: 42,
      },
      observer,
      observer.timestampMs,
    )
    const horizontal = convertScopeEquatorialToHorizontal(
      equatorial,
      observer,
      observer.timestampMs,
    )

    expect(horizontal.azimuthDeg).toBeCloseTo(180, 3)
    expect(horizontal.elevationDeg).toBeCloseTo(42, 3)
  })

  it('caches manifest, names, band indexes, and decoded tiles for the session', async () => {
    const manifest = {
      version: 1,
      kind: 'dev',
      sourceCatalog: 'dev-synthetic-from-stars-200',
      epoch: 'J2000',
      rowFormat: 'scope-star-v2-le',
      namesPath: 'names.json',
      bands: [
        {
          bandDir: 'mag6p5',
          maxMagnitude: 6.5,
          raStepDeg: 90,
          decStepDeg: 45,
          indexPath: 'mag6p5/index.json',
          totalRows: 1,
          namedRows: 0,
        },
        {
          bandDir: 'mag8p0',
          maxMagnitude: 8.0,
          raStepDeg: 45,
          decStepDeg: 30,
          indexPath: 'mag8p0/index.json',
          totalRows: 1,
          namedRows: 0,
        },
        {
          bandDir: 'mag9p5',
          maxMagnitude: 9.5,
          raStepDeg: 22.5,
          decStepDeg: 22.5,
          indexPath: 'mag9p5/index.json',
          totalRows: 1,
          namedRows: 0,
        },
        {
          bandDir: 'mag10p5',
          maxMagnitude: 10.5,
          raStepDeg: 11.25,
          decStepDeg: 11.25,
          indexPath: 'mag10p5/index.json',
          totalRows: 1,
          namedRows: 1,
        },
      ],
    }
    const index = {
      bandDir: 'mag10p5',
      maxMagnitude: 10.5,
      raStepDeg: 11.25,
      decStepDeg: 11.25,
      tiles: [{ raIndex: 0, decIndex: 8, file: 'r0_d8.bin', count: 1 }],
    }
    const names = { 1: 'Rigel Scope' }
    const rowBytes = encodeScopeRow({
      raMicroDeg: 1_000_000,
      decMicroDeg: 500_000,
      pmRaMasPerYear: 0,
      pmDecMasPerYear: 0,
      vMagMilli: 3500,
      bMinusVMilli: 150,
      nameId: 1,
    })
    const fetcher = async (input: string | URL | Request) => {
      const url = String(input)

      if (url.endsWith('/manifest.json')) {
        return jsonResponse(manifest)
      }

      if (url.endsWith('/names.json')) {
        return jsonResponse(names)
      }

      if (url.endsWith('/mag10p5/index.json')) {
        return jsonResponse(index)
      }

      if (url.endsWith('/mag10p5/r0_d8.bin')) {
        return binaryResponse(rowBytes)
      }

      throw new Error(`unexpected fetch ${url}`)
    }

    const scopeData = createScopeDataConfig()
    const firstManifest = await loadScopeManifest(fetcher as typeof fetch, scopeData)
    const secondManifest = await loadScopeManifest(fetcher as typeof fetch, scopeData)
    const firstNames = await loadScopeNamesTable(firstManifest, fetcher as typeof fetch, scopeData)
    const secondNames = await loadScopeNamesTable(firstManifest, fetcher as typeof fetch, scopeData)
    const firstIndex = await loadScopeBandIndex(
      firstManifest,
      'mag10p5',
      fetcher as typeof fetch,
      scopeData,
    )
    const secondIndex = await loadScopeBandIndex(
      firstManifest,
      'mag10p5',
      fetcher as typeof fetch,
      scopeData,
    )
    const firstRows = await loadScopeTileRows(
      'mag10p5',
      'r0_d8.bin',
      fetcher as typeof fetch,
      scopeData,
    )
    const secondRows = await loadScopeTileRows(
      'mag10p5',
      'r0_d8.bin',
      fetcher as typeof fetch,
      scopeData,
    )

    expect(secondManifest).toBe(firstManifest)
    expect(secondNames).toBe(firstNames)
    expect(secondIndex).toBe(firstIndex)
    expect(secondRows).toBe(firstRows)
    expect(firstRows[0]?.nameId).toBe(1)
  })

  it('prefers remote scope assets when explicitly enabled and configured', async () => {
    const fetchLog: string[] = []
    const remoteScopeData = createScopeDataConfig({
      remoteEnabled: true,
      remoteBaseUrl: 'https://cdn.example/scope/v1',
    })
    const manifest = createScopeManifest()
    const index = createScopeBandIndexFixture()
    const names = { 1: 'Remote Scope Rigel' }
    const rowBytes = encodeScopeRow({
      raMicroDeg: 1_000_000,
      decMicroDeg: 500_000,
      pmRaMasPerYear: 0,
      pmDecMasPerYear: 0,
      vMagMilli: 3500,
      bMinusVMilli: 150,
      nameId: 1,
    })
    const fetcher = async (input: string | URL | Request) => {
      const url = String(input)
      fetchLog.push(url)

      if (url.startsWith('https://cdn.example/scope/v1/')) {
        if (url.endsWith('/manifest.json')) {
          return jsonResponse(manifest)
        }

        if (url.endsWith('/names.json')) {
          return jsonResponse(names)
        }

        if (url.endsWith('/mag10p5/index.json')) {
          return jsonResponse(index)
        }

        if (url.endsWith('/mag10p5/r0_d8.bin')) {
          return binaryResponse(rowBytes)
        }
      }

      throw new Error(`unexpected fetch ${url}`)
    }

    const loadedManifest = await loadScopeManifest(fetcher as typeof fetch, remoteScopeData)
    const loadedNames = await loadScopeNamesTable(
      loadedManifest,
      fetcher as typeof fetch,
      remoteScopeData,
    )
    const loadedIndex = await loadScopeBandIndex(
      loadedManifest,
      'mag10p5',
      fetcher as typeof fetch,
      remoteScopeData,
    )
    const loadedRows = await loadScopeTileRows(
      'mag10p5',
      'r0_d8.bin',
      fetcher as typeof fetch,
      remoteScopeData,
    )

    expect(fetchLog.every((url) => url.startsWith('https://cdn.example/scope/v1/'))).toBe(true)
    expect(loadedManifest).toEqual(manifest)
    expect(loadedNames).toEqual(names)
    expect(loadedIndex).toEqual(index)
    expect(loadedRows[0]?.nameId).toBe(1)
  })

  it('uses the local fallback path when remote mode is disabled', async () => {
    const fetchLog: string[] = []
    const localScopeData = createScopeDataConfig()
    const manifest = createScopeManifest()
    const index = createScopeBandIndexFixture()
    const names = { 1: 'Local Scope Rigel' }
    const rowBytes = encodeScopeRow({
      raMicroDeg: 1_000_000,
      decMicroDeg: 500_000,
      pmRaMasPerYear: 0,
      pmDecMasPerYear: 0,
      vMagMilli: 3500,
      bMinusVMilli: 150,
      nameId: 1,
    })
    const fetcher = async (input: string | URL | Request) => {
      const url = String(input)
      fetchLog.push(url)

      if (!url.startsWith('/data/scope/v1/')) {
        throw new Error(`unexpected fetch ${url}`)
      }

      if (url.endsWith('/manifest.json')) {
        return jsonResponse(manifest)
      }

      if (url.endsWith('/names.json')) {
        return jsonResponse(names)
      }

      if (url.endsWith('/mag10p5/index.json')) {
        return jsonResponse(index)
      }

      if (url.endsWith('/mag10p5/r0_d8.bin')) {
        return binaryResponse(rowBytes)
      }

      throw new Error(`unexpected fetch ${url}`)
    }

    const loadedManifest = await loadScopeManifest(fetcher as typeof fetch, localScopeData)
    const loadedNames = await loadScopeNamesTable(
      loadedManifest,
      fetcher as typeof fetch,
      localScopeData,
    )
    const loadedIndex = await loadScopeBandIndex(
      loadedManifest,
      'mag10p5',
      fetcher as typeof fetch,
      localScopeData,
    )
    const loadedRows = await loadScopeTileRows(
      'mag10p5',
      'r0_d8.bin',
      fetcher as typeof fetch,
      localScopeData,
    )

    expect(fetchLog.every((url) => url.startsWith('/data/scope/v1/'))).toBe(true)
    expect(loadedManifest).toEqual(manifest)
    expect(loadedNames).toEqual(names)
    expect(loadedIndex).toEqual(index)
    expect(loadedRows[0]?.nameId).toBe(1)
  })

  it('falls back to local scope assets when remote fetches fail', async () => {
    const remoteScopeData = createScopeDataConfig({
      remoteEnabled: true,
      remoteBaseUrl: 'https://cdn.example/scope/v1',
    })
    const manifest = createScopeManifest()
    const index = createScopeBandIndexFixture()
    const names = { 1: 'Local Fallback Scope Rigel' }
    const rowBytes = encodeScopeRow({
      raMicroDeg: 1_000_000,
      decMicroDeg: 500_000,
      pmRaMasPerYear: 0,
      pmDecMasPerYear: 0,
      vMagMilli: 3500,
      bMinusVMilli: 150,
      nameId: 1,
    })
    const fetchLog: string[] = []
    const fetcher = async (input: string | URL | Request) => {
      const url = String(input)
      fetchLog.push(url)

      if (url.startsWith('https://cdn.example/scope/v1/')) {
        return errorResponse()
      }

      if (url.endsWith('/manifest.json')) {
        return jsonResponse(manifest)
      }

      if (url.endsWith('/names.json')) {
        return jsonResponse(names)
      }

      if (url.endsWith('/mag10p5/index.json')) {
        return jsonResponse(index)
      }

      if (url.endsWith('/mag10p5/r0_d8.bin')) {
        return binaryResponse(rowBytes)
      }

      throw new Error(`unexpected fetch ${url}`)
    }

    const loadedManifest = await loadScopeManifest(fetcher as typeof fetch, remoteScopeData)
    const loadedNames = await loadScopeNamesTable(
      loadedManifest,
      fetcher as typeof fetch,
      remoteScopeData,
    )
    const loadedIndex = await loadScopeBandIndex(
      loadedManifest,
      'mag10p5',
      fetcher as typeof fetch,
      remoteScopeData,
    )
    const loadedRows = await loadScopeTileRows(
      'mag10p5',
      'r0_d8.bin',
      fetcher as typeof fetch,
      remoteScopeData,
    )

    expect(fetchLog).toEqual([
      'https://cdn.example/scope/v1/manifest.json',
      '/data/scope/v1/manifest.json',
      'https://cdn.example/scope/v1/names.json',
      '/data/scope/v1/names.json',
      'https://cdn.example/scope/v1/mag10p5/index.json',
      '/data/scope/v1/mag10p5/index.json',
      'https://cdn.example/scope/v1/mag10p5/r0_d8.bin',
      '/data/scope/v1/mag10p5/r0_d8.bin',
    ])
    expect(loadedManifest).toEqual(manifest)
    expect(loadedNames).toEqual(names)
    expect(loadedIndex).toEqual(index)
    expect(loadedRows[0]?.nameId).toBe(1)
  })

  it('keeps local and remote cache entries partitioned when mode changes', async () => {
    const fetchLog: string[] = []
    const localScopeData = createScopeDataConfig()
    const remoteScopeData = createScopeDataConfig({
      remoteEnabled: true,
      remoteBaseUrl: 'https://cdn.example/scope/v1',
    })
    const localManifest = createScopeManifest()
    const remoteManifest = createScopeManifest()
    const localNames = { 1: 'Local Scope Rigel' }
    const remoteNames = { 1: 'Remote Scope Rigel' }
    const localIndex = createScopeBandIndexFixture('local-r0_d8.bin')
    const remoteIndex = createScopeBandIndexFixture('remote-r0_d8.bin')
    const localRowBytes = encodeScopeRow({
      raMicroDeg: 1_000_000,
      decMicroDeg: 500_000,
      pmRaMasPerYear: 0,
      pmDecMasPerYear: 0,
      vMagMilli: 3500,
      bMinusVMilli: 150,
      nameId: 1,
    })
    const remoteRowBytes = encodeScopeRow({
      raMicroDeg: 2_000_000,
      decMicroDeg: 700_000,
      pmRaMasPerYear: 0,
      pmDecMasPerYear: 0,
      vMagMilli: 4200,
      bMinusVMilli: 200,
      nameId: 1,
    })
    const fetcher = async (input: string | URL | Request) => {
      const url = String(input)
      fetchLog.push(url)

      if (url === '/data/scope/v1/manifest.json') {
        return jsonResponse(localManifest)
      }

      if (url === '/data/scope/v1/names.json') {
        return jsonResponse(localNames)
      }

      if (url === '/data/scope/v1/mag10p5/index.json') {
        return jsonResponse(localIndex)
      }

      if (url === '/data/scope/v1/mag10p5/local-r0_d8.bin') {
        return binaryResponse(localRowBytes)
      }

      if (url === 'https://cdn.example/scope/v1/manifest.json') {
        return jsonResponse(remoteManifest)
      }

      if (url === 'https://cdn.example/scope/v1/names.json') {
        return jsonResponse(remoteNames)
      }

      if (url === 'https://cdn.example/scope/v1/mag10p5/index.json') {
        return jsonResponse(remoteIndex)
      }

      if (url === 'https://cdn.example/scope/v1/mag10p5/remote-r0_d8.bin') {
        return binaryResponse(remoteRowBytes)
      }

      throw new Error(`unexpected fetch ${url}`)
    }

    const cachedLocalManifest = await loadScopeManifest(fetcher as typeof fetch, localScopeData)
    const cachedLocalNames = await loadScopeNamesTable(
      cachedLocalManifest,
      fetcher as typeof fetch,
      localScopeData,
    )
    const cachedLocalIndex = await loadScopeBandIndex(
      cachedLocalManifest,
      'mag10p5',
      fetcher as typeof fetch,
      localScopeData,
    )
    const cachedLocalRows = await loadScopeTileRows(
      'mag10p5',
      'local-r0_d8.bin',
      fetcher as typeof fetch,
      localScopeData,
    )

    const cachedRemoteManifest = await loadScopeManifest(fetcher as typeof fetch, remoteScopeData)
    const cachedRemoteNames = await loadScopeNamesTable(
      cachedRemoteManifest,
      fetcher as typeof fetch,
      remoteScopeData,
    )
    const cachedRemoteIndex = await loadScopeBandIndex(
      cachedRemoteManifest,
      'mag10p5',
      fetcher as typeof fetch,
      remoteScopeData,
    )
    const cachedRemoteRows = await loadScopeTileRows(
      'mag10p5',
      'remote-r0_d8.bin',
      fetcher as typeof fetch,
      remoteScopeData,
    )

    expect(cachedLocalManifest).toEqual(localManifest)
    expect(cachedRemoteManifest).toEqual(remoteManifest)
    expect(cachedLocalNames).toEqual(localNames)
    expect(cachedRemoteNames).toEqual(remoteNames)
    expect(cachedLocalIndex.tiles[0]?.file).toBe('local-r0_d8.bin')
    expect(cachedRemoteIndex.tiles[0]?.file).toBe('remote-r0_d8.bin')
    expect(cachedLocalRows[0]?.raDeg).not.toBe(cachedRemoteRows[0]?.raDeg)
    expect(fetchLog).toContain('/data/scope/v1/manifest.json')
    expect(fetchLog).toContain('https://cdn.example/scope/v1/manifest.json')
  })

  it('tracks stale request generations explicitly', () => {
    const tracker = createScopeRequestTracker()
    const first = tracker.begin()
    const second = tracker.begin()

    expect(tracker.isCurrent(first)).toBe(false)
    expect(tracker.isCurrent(second)).toBe(true)

    tracker.invalidate()
    expect(tracker.isCurrent(second)).toBe(false)
  })
})

function encodeScopeRow({
  raMicroDeg,
  decMicroDeg,
  pmRaMasPerYear,
  pmDecMasPerYear,
  vMagMilli,
  bMinusVMilli,
  nameId,
}: {
  raMicroDeg: number
  decMicroDeg: number
  pmRaMasPerYear: number
  pmDecMasPerYear: number
  vMagMilli: number
  bMinusVMilli: number
  nameId: number
}) {
  const bytes = new Uint8Array(20)
  const view = new DataView(bytes.buffer)

  view.setUint32(0, raMicroDeg, true)
  view.setInt32(4, decMicroDeg, true)
  view.setInt16(8, pmRaMasPerYear, true)
  view.setInt16(10, pmDecMasPerYear, true)
  view.setInt16(12, vMagMilli, true)
  view.setInt16(14, bMinusVMilli, true)
  view.setUint32(16, nameId, true)

  return bytes
}

function createScopeDataConfig(overrides?: Partial<{ remoteEnabled: boolean; remoteBaseUrl: string | null }>) {
  return {
    remoteEnabled: overrides?.remoteEnabled ?? false,
    remoteBaseUrl: overrides?.remoteBaseUrl ?? null,
    localBasePath: '/data/scope/v1' as const,
  }
}

function createScopeManifest() {
  return {
    version: 1,
    kind: 'dev',
    sourceCatalog: 'dev-synthetic-from-stars-200',
    epoch: 'J2000',
    rowFormat: 'scope-star-v2-le',
    namesPath: 'names.json',
    bands: [
      {
        bandDir: 'mag6p5',
        maxMagnitude: 6.5,
        raStepDeg: 90,
        decStepDeg: 45,
        indexPath: 'mag6p5/index.json',
        totalRows: 1,
        namedRows: 0,
      },
      {
        bandDir: 'mag8p0',
        maxMagnitude: 8.0,
        raStepDeg: 45,
        decStepDeg: 30,
        indexPath: 'mag8p0/index.json',
        totalRows: 1,
        namedRows: 0,
      },
      {
        bandDir: 'mag9p5',
        maxMagnitude: 9.5,
        raStepDeg: 22.5,
        decStepDeg: 22.5,
        indexPath: 'mag9p5/index.json',
        totalRows: 1,
        namedRows: 0,
      },
      {
        bandDir: 'mag10p5',
        maxMagnitude: 10.5,
        raStepDeg: 11.25,
        decStepDeg: 11.25,
        indexPath: 'mag10p5/index.json',
        totalRows: 1,
        namedRows: 1,
      },
    ],
  }
}

function createScopeBandIndexFixture(file = 'r0_d8.bin') {
  return {
    bandDir: 'mag10p5',
    maxMagnitude: 10.5,
    raStepDeg: 11.25,
    decStepDeg: 11.25,
    tiles: [{ raIndex: 0, decIndex: 8, file, count: 1 }],
  }
}

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  } satisfies Partial<Response> as Response
}

function binaryResponse(payload: Uint8Array) {
  return {
    ok: true,
    arrayBuffer: async () => payload.buffer.slice(0),
  } satisfies Partial<Response> as Response
}

function errorResponse(status = 503) {
  return {
    ok: false,
    status,
  } satisfies Partial<Response> as Response
}
