import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import nextConfig, {
  SKYLENS_PERMISSIONS_POLICY,
  SKYLENS_STATIC_HOST_HEADERS,
} from '../../next.config'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(TEST_DIR, '../..')

describe('next config', () => {
  it('enforces static export mode', () => {
    expect(nextConfig.output).toBe('export')
  })

  it('keeps static export free of unsupported Next response-header routes', () => {
    expect(SKYLENS_PERMISSIONS_POLICY).toBe(
      'camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)',
    )
    expect(nextConfig.headers).toBeUndefined()
  })

  it('declares the live permissions-policy contract in the Render Blueprint', () => {
    const blueprint = readFileSync(resolve(PROJECT_ROOT, 'render.yaml'), 'utf8')

    expect(blueprint).toContain('staticPublishPath: ./out')
    expect(blueprint).toContain('name: Permissions-Policy')
    expect(blueprint).toContain(`value: ${SKYLENS_PERMISSIONS_POLICY}`)
  })

  it('ships a static-host header artifact that preserves permissions-policy parity', () => {
    const artifact = readFileSync(resolve(PROJECT_ROOT, 'public/_headers'), 'utf8')

    expect(artifact).toBe(SKYLENS_STATIC_HOST_HEADERS)
  })

  it('ships generated export headers that preserve permissions-policy parity', () => {
    const artifact = readFileSync(resolve(PROJECT_ROOT, 'out/_headers'), 'utf8')

    expect(artifact).toBe(SKYLENS_STATIC_HOST_HEADERS)
  })

  it('ships generated embed export artifacts with the delegated five-capability contract', () => {
    const artifact = readFileSync(resolve(PROJECT_ROOT, 'out/embed-validation.html'), 'utf8')

    expect(artifact).toContain('camera; geolocation; accelerometer; gyroscope; magnetometer')
    expect(artifact).toContain('camera, geolocation, and motion sensors.')
    expect(artifact).not.toContain('allow=\"accelerometer; gyroscope; magnetometer\"')
    expect(artifact).not.toContain('accelerometer, gyroscope, and magnetometer.')
  })
})
