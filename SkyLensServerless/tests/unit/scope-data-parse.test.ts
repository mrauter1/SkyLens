import { describe, expect, it } from 'vitest'

import { derivePhotometry, parseTycho2Line } from '../../scripts/scope/build-core.mjs'

function createTychoLine(overrides: Record<string, string>) {
  const characters = Array.from({ length: 206 }, () => ' ')
  const put = (start: number, end: number, value: string) => {
    const padded = value.padStart(end - start + 1, ' ')
    for (let index = 0; index < padded.length; index += 1) {
      characters[start - 1 + index] = padded[index]
    }
  }

  put(1, 4, overrides.TYC1 ?? '1')
  put(6, 10, overrides.TYC2 ?? '13')
  put(12, 12, overrides.TYC3 ?? '1')
  put(14, 14, overrides.pflag ?? ' ')
  put(16, 27, overrides.RAmdeg ?? '101.287200')
  put(29, 40, overrides.DEmdeg ?? '-16.716100')
  put(42, 48, overrides.pmRA ?? ' ')
  put(50, 56, overrides.pmDE ?? ' ')
  put(111, 116, overrides.BTmag ?? '0.000')
  put(124, 129, overrides.VTmag ?? '-1.440')
  put(143, 148, overrides.HIP ?? '32349')

  return characters.join('')
}

describe('scope data parse', () => {
  it('derives photometry from BT and VT and rounds to three decimals', () => {
    expect(derivePhotometry(2.5, 2.0)).toEqual({
      vMag: 1.955,
      bMinusV: 0.425,
    })
  })

  it('parses a fixed-width Tycho-2 line with PM zero fallback', () => {
    const parsed = parseTycho2Line(createTychoLine({}))

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    expect(parsed.value).toMatchObject({
      sourceId: 'TYC:1-13-1',
      hip: 32349,
      pmRaMasPerYear: 0,
      pmDecMasPerYear: 0,
      vMag: -1.57,
      bMinusV: 1.224,
    })
  })

  it('rejects lines that do not match the 206-character contract', () => {
    expect(parseTycho2Line('short')).toEqual({
      ok: false,
      reason: 'invalidLength',
    })
  })

  it('drops pflag X rows', () => {
    expect(parseTycho2Line(createTychoLine({ pflag: 'X' }))).toEqual({
      ok: false,
      reason: 'pflagX',
    })
  })

  it('drops rows with unusable photometry', () => {
    expect(
      parseTycho2Line(
        createTychoLine({
          BTmag: '      ',
          VTmag: '      ',
        }),
      ),
    ).toEqual({
      ok: false,
      reason: 'missingPhotometry',
    })
  })
})
