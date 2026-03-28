import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { SKYLENS_PERMISSIONS_POLICY } from '../../next.config'
import {
  createStaticExportServer,
  resolveRequestPath,
} from '../../scripts/serve-export.mjs'

const TEMP_DIRECTORIES = []

afterEach(async () => {
  while (TEMP_DIRECTORIES.length > 0) {
    const directory = TEMP_DIRECTORIES.pop()

    if (directory) {
      rmSync(directory, { force: true, recursive: true })
    }
  }
})

describe('static export preview server', () => {
  it('serves exported permissions-policy headers for matched routes', async () => {
    const outDir = createTempOutDir()
    const server = createStaticExportServer({ outDir })

    await new Promise((resolvePromise) => {
      server.listen(0, '127.0.0.1', resolvePromise)
    })

    const address = server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Expected a TCP server address.')
    }

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/embed-validation`)

      expect(response.status).toBe(200)
      expect(response.headers.get('permissions-policy')).toBe(SKYLENS_PERMISSIONS_POLICY)
      await expect(response.text()).resolves.toContain('embed validation')
    } finally {
      await new Promise((resolvePromise, rejectPromise) => {
        server.close((error) => {
          if (error) {
            rejectPromise(error)
            return
          }

          resolvePromise(undefined)
        })
      })
    }
  })

  it('does not resolve paths outside the exported output directory', () => {
    const outDir = createTempOutDir()
    const outsideFilePath = resolve(outDir, '..', 'outside.html')

    writeFileSync(outsideFilePath, '<html><body>outside</body></html>')

    expect(resolveRequestPath('/../../outside.html', outDir)).toBeNull()
  })
})

function createTempOutDir() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'skylens-export-preview-'))
  const outDir = resolve(tempRoot, 'out')

  TEMP_DIRECTORIES.push(tempRoot)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'embed-validation.html'), '<html><body>embed validation</body></html>')
  writeFileSync(
    resolve(outDir, '_headers'),
    `/*\n  Permissions-Policy: ${SKYLENS_PERMISSIONS_POLICY}\n`,
  )

  return outDir
}
