import { describe, expect, it } from 'vitest'

import { buildDevSyntheticStars } from '../../scripts/scope/build-core.mjs'
import { DEV_FALLBACK_SEED_COUNT } from '../../scripts/scope/constants.mjs'

describe('scope data dev fallback', () => {
  it('builds the fixed 12-seed fallback with deterministic six-row synthetic clusters', async () => {
    const { stars } = await buildDevSyntheticStars()
    const siriusRows = stars.filter((star) => star.sourceId.startsWith('DEV:hip-32349:'))
    const polarisRows = stars.filter((star) => star.sourceId.startsWith('DEV:hip-11767:'))

    expect(new Set(stars.map((star) => star.sourceId.split(':')[1]))).toHaveLength(DEV_FALLBACK_SEED_COUNT)
    expect(stars).toHaveLength(DEV_FALLBACK_SEED_COUNT * 6)
    expect(siriusRows).toHaveLength(6)
    expect(polarisRows).toHaveLength(6)
    expect(siriusRows.map((star) => star.vMag)).toEqual([6.4, 7.6, 8.4, 9.2, 10, 10.5])
    expect(siriusRows.slice(0, 5).every((star) => !star.displayName)).toBe(true)
    expect(siriusRows[5]?.displayName).toBe('Sirius')
    expect(polarisRows[5]?.displayName).toBe('Polaris')
    expect(siriusRows.every((star) => star.pmRaMasPerYear === 0 && star.pmDecMasPerYear === 0)).toBe(
      true,
    )
    expect(siriusRows.every((star) => star.bMinusV === 0)).toBe(true)
  })
})
