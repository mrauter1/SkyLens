import { describe, expect, it } from 'vitest'

import {
  buildBrightStarHipNameMap,
  buildHygProperNameMap,
  buildScopeNameTable,
  parseHygProperNamesCsv,
  parseScopeNameOverridesCsv,
  resolveScopeDisplayName,
} from '../../lib/scope-data/names.mjs'

describe('scope-data names', () => {
  it('parses override CSV rows and normalizes display names', () => {
    const overrides = parseScopeNameOverridesCsv(`matchType,matchKey,displayName
HIP,32349," Sirius  "
TYC,1-13-1,"Alpha, Beta"
`)

    expect(overrides).toEqual([
      {
        matchType: 'HIP',
        matchKey: '32349',
        targetKey: 'HIP:32349',
        displayName: 'Sirius',
        lineNumber: 2,
      },
      {
        matchType: 'TYC',
        matchKey: '1-13-1',
        targetKey: 'TYC:1-13-1',
        displayName: 'Alpha, Beta',
        lineNumber: 3,
      },
    ])
  })

  it('applies override precedence before the bright-star HIP join', () => {
    const brightStarHipNameMap = buildBrightStarHipNameMap([
      { id: 'hip-32349', name: 'Sirius' },
    ])
    const row = {
      sourceId: 'TYC:1-13-1',
      hipId: 32349,
    }

    expect(
      resolveScopeDisplayName({
        row,
        brightStarHipNameMap,
        nameOverrides: parseScopeNameOverridesCsv(`matchType,matchKey,displayName
HIP,32349,Dog Star
`),
      })
    ).toBe('Dog Star')
  })

  it('applies HYG proper-name precedence before bright-star HIP names', () => {
    const brightStarHipNameMap = buildBrightStarHipNameMap([
      { id: 'hip-32349', name: 'Sirius' },
    ])
    const hygProperNameMap = buildHygProperNameMap(
      parseHygProperNamesCsv(`hip,name
32349,Alpha Canis Majoris
`)
    )

    expect(
      resolveScopeDisplayName({
        row: {
          sourceId: 'TYC:1-13-1',
          hipId: 32349,
        },
        brightStarHipNameMap,
        hygProperNameMap,
      })
    ).toBe('Alpha Canis Majoris')
  })

  it('lets a blank override suppress a bright-star joined name', () => {
    const brightStarHipNameMap = buildBrightStarHipNameMap([
      { id: 'hip-32349', name: 'Sirius' },
    ])

    expect(
      resolveScopeDisplayName({
        row: {
          sourceId: 'TYC:1-13-1',
          hipId: 32349,
        },
        brightStarHipNameMap,
        nameOverrides: parseScopeNameOverridesCsv(`matchType,matchKey,displayName
HIP,32349,
`),
      })
    ).toBeUndefined()
  })

  it('fails when multiple override rows target the same source row', () => {
    const overrides = parseScopeNameOverridesCsv(`matchType,matchKey,displayName
HIP,32349,Dog Star
TYC,1-13-1,Sirius
`)

    expect(() =>
      resolveScopeDisplayName({
        row: {
          sourceId: 'TYC:1-13-1',
          hipId: 32349,
        },
        nameOverrides: overrides,
      })
    ).toThrow(/Multiple manual override rows target source TYC:1-13-1/)
  })

  it('assigns deterministic name ids from emitted rows only', () => {
    const { uniqueNames, nameTable } = buildScopeNameTable([
      ' Sirius ',
      'Canopus',
      undefined,
      'Sirius',
    ])

    expect(uniqueNames).toEqual(['Canopus', 'Sirius'])
    expect(nameTable).toEqual({
      '1': 'Canopus',
      '2': 'Sirius',
    })
  })

  it('parses HYG proper-name CSV deterministically', () => {
    const rows = parseHygProperNamesCsv(`hip,name
32349,Sirius
30438,Canopus
`)
    const map = buildHygProperNameMap(rows)

    expect(rows).toEqual([
      { hipId: 32349, name: 'Sirius', lineNumber: 2 },
      { hipId: 30438, name: 'Canopus', lineNumber: 3 },
    ])
    expect(map.get(32349)).toBe('Sirius')
    expect(map.get(30438)).toBe('Canopus')
  })
})
