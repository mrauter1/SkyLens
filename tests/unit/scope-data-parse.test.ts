import { describe, expect, it } from 'vitest'

import {
  deriveTycho2Photometry,
  extractTycho2MainFields,
  normalizeTycho2MainRecord,
} from '../../lib/scope-data/tycho2.mjs'

function createTycho2Line(overrides: Record<string, string | number | null> = {}) {
  const buffer = Array.from({ length: 206 }, () => ' ')
  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(overrides, key)

  function writeField(startInclusive: number, endInclusive: number, value: string | number | null) {
    const width = endInclusive - startInclusive + 1
    const rendered =
      value === null || value === undefined
        ? ''.padStart(width, ' ')
        : String(value).padStart(width, ' ')

    for (let index = 0; index < width; index += 1) {
      buffer[startInclusive - 1 + index] = rendered[index] ?? ' '
    }
  }

  writeField(1, 4, hasOwn('tyc1') ? overrides.tyc1 : 1)
  writeField(6, 10, hasOwn('tyc2') ? overrides.tyc2 : 13)
  writeField(12, 12, hasOwn('tyc3') ? overrides.tyc3 : 1)
  writeField(14, 14, hasOwn('pflag') ? overrides.pflag : '')
  writeField(16, 27, hasOwn('raDeg') ? overrides.raDeg : '101.287200')
  writeField(29, 40, hasOwn('decDeg') ? overrides.decDeg : '-16.716100')
  writeField(42, 48, hasOwn('pmRaMasPerYear') ? overrides.pmRaMasPerYear : '')
  writeField(50, 56, hasOwn('pmDecMasPerYear') ? overrides.pmDecMasPerYear : '')
  writeField(111, 116, hasOwn('btMag') ? overrides.btMag : '1.000')
  writeField(124, 129, hasOwn('vtMag') ? overrides.vtMag : '0.500')
  writeField(143, 148, hasOwn('hipId') ? overrides.hipId : 32349)

  return buffer.join('')
}

describe('scope-data tycho2 parser', () => {
  it('extracts the exact required fixed-width fields', () => {
    const line = createTycho2Line({
      tyc1: 1234,
      tyc2: 5678,
      tyc3: 1,
      pflag: ' ',
      raDeg: '279.234700',
      decDeg: ' 38.783700',
      pmRaMasPerYear: '-12.3',
      pmDecMasPerYear: '45.6',
      btMag: '0.030',
      vtMag: '0.000',
      hipId: 91262,
    })

    expect(extractTycho2MainFields(line)).toEqual({
      tyc1: 1234,
      tyc2: 5678,
      tyc3: 1,
      pflag: '',
      raDeg: 279.2347,
      decDeg: 38.7837,
      pmRaMasPerYear: -12.3,
      pmDecMasPerYear: 45.6,
      btMag: 0.03,
      vtMag: 0,
      hipId: 91262,
    })
  })

  it('enforces the exact 206-character line contract', () => {
    expect(() =>
      normalizeTycho2MainRecord(createTycho2Line().slice(0, 205), {
        fileName: 'tyc2.dat.00',
        lineNumber: 1,
      })
    ).toThrow(/206 characters/)
  })

  it('derives V and B-V exactly for BT/VT combinations', () => {
    expect(deriveTycho2Photometry({ btMag: 1.0, vtMag: 0.5 })).toEqual({
      vMag: 0.455,
      bMinusV: 0.425,
    })
    expect(deriveTycho2Photometry({ btMag: null, vtMag: 7.654 })).toEqual({
      vMag: 7.654,
      bMinusV: 0,
    })
    expect(deriveTycho2Photometry({ btMag: 8.123, vtMag: null })).toEqual({
      vMag: 8.123,
      bMinusV: 0,
    })
  })

  it('normalizes valid rows and applies PM zero fallback', () => {
    const result = normalizeTycho2MainRecord(createTycho2Line(), {
      fileName: 'tyc2.dat.00',
      lineNumber: 12,
    })

    expect(result).toEqual({
      row: {
        sourceId: 'TYC:1-13-1',
        hipId: 32349,
        raDeg: 101.2872,
        decDeg: -16.7161,
        pmRaMasPerYear: 0,
        pmDecMasPerYear: 0,
        vMag: 0.455,
        bMinusV: 0.425,
      },
    })
  })

  it('drops rows for pflag X, missing photometry, and too-faint magnitudes', () => {
    expect(
      normalizeTycho2MainRecord(createTycho2Line({ pflag: 'X' }))
    ).toEqual({ dropReason: 'pflagX' })
    expect(
      normalizeTycho2MainRecord(createTycho2Line({ btMag: null, vtMag: null }))
    ).toEqual({ dropReason: 'missingPhotometry' })
    expect(
      normalizeTycho2MainRecord(createTycho2Line({ vtMag: '10.800', btMag: null }))
    ).toEqual({ dropReason: 'tooFaint' })
  })

  it('drops rows with missing or non-finite coordinates', () => {
    expect(
      normalizeTycho2MainRecord(createTycho2Line({ raDeg: null }))
    ).toEqual({ dropReason: 'missingRa' })
    expect(
      normalizeTycho2MainRecord(createTycho2Line({ raDeg: 'not-a-number' }))
    ).toEqual({ dropReason: 'missingRa' })
    expect(
      normalizeTycho2MainRecord(createTycho2Line({ decDeg: null }))
    ).toEqual({ dropReason: 'missingDec' })
    expect(
      normalizeTycho2MainRecord(createTycho2Line({ decDeg: 'not-a-number' }))
    ).toEqual({ dropReason: 'missingDec' })
  })
})
