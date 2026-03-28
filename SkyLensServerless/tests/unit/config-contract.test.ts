import { afterEach, describe, expect, it } from 'vitest'

import { getPublicConfig } from '../../lib/config'

describe('getPublicConfig', () => {
  afterEach(() => {
    delete process.env.SKYLENS_BUILD_VERSION
    delete process.env.NEXT_PUBLIC_SKYLENS_BUILD_VERSION
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
    })
  })

  it('prefers the browser-safe public build version when both env paths are set', () => {
    process.env.SKYLENS_BUILD_VERSION = 'server-build'
    process.env.NEXT_PUBLIC_SKYLENS_BUILD_VERSION = 'public-build'

    expect(getPublicConfig().buildVersion).toBe('public-build')
  })

  it('keeps the privacy reassurance copy aligned with the serverless data path', async () => {
    const { PRIVACY_REASSURANCE_COPY } = await import('../../lib/config')

    expect(PRIVACY_REASSURANCE_COPY).toEqual([
      'Camera stays on your device.',
      'Approximate location-based aircraft queries go directly from your browser to OpenSky.',
      'Live satellite catalogs are fetched from CelesTrak through the configured browser-safe relay.',
      'No camera frames are uploaded.',
    ])
  })
})
