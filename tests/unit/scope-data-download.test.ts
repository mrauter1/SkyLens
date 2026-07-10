import { describe, expect, it } from 'vitest'

// @ts-expect-error Runtime-tested script module has no TypeScript declaration file.
import { parseBaseUrlOverrides } from '../../scripts/scope/download-core.mjs'

describe('scope data download', () => {
  it('keeps CLI overrides ahead of env and default URLs', () => {
    expect(parseBaseUrlOverrides(['https://example.test/a/'], 'https://ignored.test/')).toEqual([
      'https://example.test/a/',
    ])
  })

  it('parses comma-separated env overrides when no CLI override is present', () => {
    expect(parseBaseUrlOverrides([], 'https://one.test/, https://two.test/')).toEqual([
      'https://one.test/',
      'https://two.test/',
    ])
  })
})
