import type { NextConfig } from 'next'

export const SKYLENS_PERMISSIONS_POLICY =
  'camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)'

export const SKYLENS_RESPONSE_HEADERS = [
  {
    key: 'Permissions-Policy',
    value: SKYLENS_PERMISSIONS_POLICY,
  },
] as const

export const SKYLENS_NEXT_HEADERS = [
  {
    source: '/:path*',
    headers: [...SKYLENS_RESPONSE_HEADERS],
  },
] as const

export const SKYLENS_STATIC_HOST_HEADERS = `/*\n${SKYLENS_RESPONSE_HEADERS.map(
  ({ key, value }) => `  ${key}: ${value}`,
).join('\n')}\n`

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return SKYLENS_NEXT_HEADERS.map((rule) => ({
      ...rule,
      headers: [...rule.headers],
    }))
  },
}

export default nextConfig
