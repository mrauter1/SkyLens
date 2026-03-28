import { describe, expect, it } from 'vitest'

import { GET } from '../../app/api/config/route'

describe('GET /api/config', () => {
  it('returns the locked bootstrap contract', async () => {
    process.env.SKYLENS_BUILD_VERSION = 'test-build'

    const response = await GET()

    await expect(response.json()).resolves.toEqual({
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
})
