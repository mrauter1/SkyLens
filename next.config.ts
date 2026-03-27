import type { NextConfig } from 'next'

export const SKYLENS_PERMISSIONS_POLICY =
  'camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: SKYLENS_PERMISSIONS_POLICY,
          },
        ],
      },
    ]
  },
}

export default nextConfig
