import { afterEach, describe, expect, it } from 'vitest'

import { getPublicConfig } from '../../lib/config'

describe('getPublicConfig', () => {
  afterEach(() => {
    delete process.env.SKYLENS_BUILD_VERSION
    delete process.env.NEXT_PUBLIC_SKYLENS_BUILD_VERSION
    delete process.env.NEXT_PUBLIC_SKYLENS_SCOPE_REMOTE_ENABLED
    delete process.env.NEXT_PUBLIC_SKYLENS_SCOPE_REMOTE_BASE_URL
  })

  it('returns the locked bootstrap contract in-process', () => {
    process.env.SKYLENS_BUILD_VERSION = 'test-build'

    expect(getPublicConfig()).toEqual({
      buildVersion: 'test-build',
      defaults: {
        maxLabels: 18,
        radiusKm: 180,
        verticalFovDeg: 50,
        likelyVisibleOnly: false,
        enabledLayers: [
          'aircraft',
          'satellites',
          'planets',
          'stars',
          'constellations',
        ],
      },
      satelliteGroups: [
        { id: 'iss', label: 'ISS' },
        { id: 'stations', label: 'Space Stations' },
        { id: 'brightest', label: '100 Brightest' },
      ],
      scopeData: {
        remoteEnabled: true,
        remoteBaseUrl: 'https://pub-566fb74233f3432ba4d47900577e552e.r2.dev/scope/v1',
        localBasePath: '/data/scope/v1',
      },
    })
  })

  it('prefers the browser-safe public build version when both env paths are set', () => {
    process.env.SKYLENS_BUILD_VERSION = 'server-build'
    process.env.NEXT_PUBLIC_SKYLENS_BUILD_VERSION = 'public-build'

    expect(getPublicConfig().buildVersion).toBe('public-build')
  })

  it('accepts explicit remote scope env overrides when both values are valid', () => {
    process.env.NEXT_PUBLIC_SKYLENS_SCOPE_REMOTE_ENABLED = 'true'
    process.env.NEXT_PUBLIC_SKYLENS_SCOPE_REMOTE_BASE_URL =
      'https://pub-566fb74233f3432ba4d47900577e552e.r2.dev/scope/v1/'

    expect(getPublicConfig().scopeData).toEqual({
      remoteEnabled: true,
      remoteBaseUrl: 'https://pub-566fb74233f3432ba4d47900577e552e.r2.dev/scope/v1',
      localBasePath: '/data/scope/v1',
    })
  })

  it('allows explicitly disabling remote scope data', () => {
    process.env.NEXT_PUBLIC_SKYLENS_SCOPE_REMOTE_ENABLED = ' , '

    expect(getPublicConfig().scopeData).toEqual({
      remoteEnabled: false,
      remoteBaseUrl: 'https://pub-566fb74233f3432ba4d47900577e552e.r2.dev/scope/v1',
      localBasePath: '/data/scope/v1',
    })
  })

  it('falls back to the baked-in R2 URL when the configured base URL is invalid', () => {
    process.env.NEXT_PUBLIC_SKYLENS_SCOPE_REMOTE_BASE_URL = 'not-a-url'

    expect(getPublicConfig().scopeData).toEqual({
      remoteEnabled: true,
      remoteBaseUrl: 'https://pub-566fb74233f3432ba4d47900577e552e.r2.dev/scope/v1',
      localBasePath: '/data/scope/v1',
    })
  })

  it('keeps the privacy reassurance copy aligned with the serverless data path', async () => {
    const { PRIVACY_REASSURANCE_COPY } = await import('../../lib/config')

    expect(PRIVACY_REASSURANCE_COPY).toEqual([
      'Camera stays on your device.',
      'Approximate location-based aircraft queries go directly from your browser to OpenSky.',
      'Live satellite catalogs are fetched directly from CelesTrak.',
      'No camera frames are uploaded.',
    ])
  })
})
