import { describe, expect, it } from 'vitest'

// @ts-expect-error Runtime-tested script module has no TypeScript declaration file.
import { SCOPE_DATASET_BANDS } from '../../scripts/scope/constants.mjs'
// @ts-expect-error Runtime-tested script module has no TypeScript declaration file.
import { createDatasetBandIndex, wrapRaDeg } from '../../scripts/scope/shared.mjs'

describe('scope data tiling', () => {
  it('wraps RA into [0, 360)', () => {
    expect(wrapRaDeg(-1)).toBe(359)
    expect(wrapRaDeg(361)).toBe(1)
  })

  it('assigns cumulative band tiles using the ADR index math', () => {
    const band = SCOPE_DATASET_BANDS[3]
    expect(createDatasetBandIndex(359.9, -89.9, band)).toEqual({
      raIndex: 31,
      decIndex: 0,
      file: 'r31_d0.bin',
    })
  })
})
