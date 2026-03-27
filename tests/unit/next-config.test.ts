import { describe, expect, it } from 'vitest'

import nextConfig, { SKYLENS_PERMISSIONS_POLICY } from '../../next.config'

describe('next config', () => {
  it('emits the live ar permissions-policy header for all routes', async () => {
    await expect(nextConfig.headers?.()).resolves.toEqual([
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: SKYLENS_PERMISSIONS_POLICY,
          },
        ],
      },
    ])
  })
})
