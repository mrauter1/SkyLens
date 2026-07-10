#!/usr/bin/env node

const siteUrl = process.argv[2] ?? 'https://skylens-serverless-static.onrender.com'
const expectedPermissionsPolicy =
  'camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)'
const routeChecks = [
  { label: 'Live viewer', path: '/view?entry=live' },
  {
    label: 'Legacy live viewer URL',
    path: '/view?entry=live&location=denied&camera=granted&orientation=granted',
  },
  { label: 'Embed validation', path: '/embed-validation', embed: true },
]

try {
  for (const routeCheck of routeChecks) {
    const response = await fetch(new URL(routeCheck.path, siteUrl), {
      redirect: 'follow',
      headers: {
        'User-Agent': 'SkyLens live-contract check',
      },
    })

    if (!response.ok) {
      throw new Error(`${routeCheck.label} returned HTTP ${response.status}.`)
    }

    const permissionsPolicy = response.headers.get('permissions-policy')

    if (permissionsPolicy !== expectedPermissionsPolicy) {
      throw new Error(
        `${routeCheck.label} Permissions-Policy mismatch. Expected "${expectedPermissionsPolicy}", received "${permissionsPolicy ?? 'missing'}".`,
      )
    }

    if (routeCheck.embed) {
      const html = await response.text()
      const expectedDelegation =
        'allow="camera; geolocation; accelerometer; gyroscope; magnetometer"'

      if (!html.includes(expectedDelegation)) {
        throw new Error('Embed validation is missing the five-capability iframe delegation.')
      }
    }

    console.log(`${routeCheck.label}: HTTP ${response.status}; Permissions-Policy verified`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
