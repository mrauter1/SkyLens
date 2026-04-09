import { describe, expect, it } from 'vitest'

// @ts-expect-error Runtime-tested script module has no TypeScript declaration file.
import { assignDisplayNames, loadBrightStarNameMap } from '../../scripts/scope/build-core.mjs'
// @ts-expect-error Runtime-tested script module has no TypeScript declaration file.
import { normalizeName } from '../../scripts/scope/shared.mjs'

describe('scope data names', () => {
  it('normalizes whitespace and NFC for emitted names', () => {
    expect(normalizeName('  Rigil   Kentaurus  ')).toBe('Rigil Kentaurus')
    expect(normalizeName('')).toBeNull()
  })

  it('uses manual overrides before the bright-star HIP join', async () => {
    const brightStarNameMap = await loadBrightStarNameMap()
    const [resolved] = assignDisplayNames(
      [
        {
          hip: 32349,
          tycKey: '1-13-1',
          sourceId: 'TYC:1-13-1',
          raDeg: 0,
          decDeg: 0,
          pmRaMasPerYear: 0,
          pmDecMasPerYear: 0,
          vMag: 1,
          bMinusV: 0,
        },
      ],
      {
        hipOverrides: new Map([[32349, 'Manual Sirius']]),
        tycOverrides: new Map(),
        brightStarNameMap,
      },
    )

    expect(resolved.displayName).toBe('Manual Sirius')
  })

  it('falls back to the built-in bright-star HIP join when no override matches', async () => {
    const brightStarNameMap = await loadBrightStarNameMap()
    const [resolved] = assignDisplayNames(
      [
        {
          hip: 32349,
          tycKey: '1-13-1',
          sourceId: 'TYC:1-13-1',
          raDeg: 0,
          decDeg: 0,
          pmRaMasPerYear: 0,
          pmDecMasPerYear: 0,
          vMag: 1,
          bMinusV: 0,
        },
      ],
      {
        hipOverrides: new Map(),
        tycOverrides: new Map(),
        brightStarNameMap,
      },
    )

    expect(resolved.displayName).toBe('Sirius')
  })

  it('fails when both HIP and TYC overrides target the same source row', async () => {
    const brightStarNameMap = await loadBrightStarNameMap()

    expect(() =>
      assignDisplayNames(
        [
          {
            hip: 32349,
            tycKey: '1-13-1',
            sourceId: 'TYC:1-13-1',
            raDeg: 0,
            decDeg: 0,
            pmRaMasPerYear: 0,
            pmDecMasPerYear: 0,
            vMag: 1,
            bMinusV: 0,
          },
        ],
        {
          hipOverrides: new Map([[32349, 'Manual Sirius']]),
          tycOverrides: new Map([['1-13-1', 'Manual TYC Sirius']]),
          brightStarNameMap,
        },
      ),
    ).toThrow('scope-name-override-row-conflict:TYC:1-13-1')
  })

  it('still fails when duplicate HIP and TYC matches normalize to the same display name', async () => {
    const brightStarNameMap = await loadBrightStarNameMap()

    expect(() =>
      assignDisplayNames(
        [
          {
            hip: 32349,
            tycKey: '1-13-1',
            sourceId: 'TYC:1-13-1',
            raDeg: 0,
            decDeg: 0,
            pmRaMasPerYear: 0,
            pmDecMasPerYear: 0,
            vMag: 1,
            bMinusV: 0,
          },
        ],
        {
          hipOverrides: new Map([[32349, '  Sirius  ']]),
          tycOverrides: new Map([['1-13-1', 'Sirius']]),
          brightStarNameMap,
        },
      ),
    ).toThrow('scope-name-override-row-conflict:TYC:1-13-1')
  })
})
