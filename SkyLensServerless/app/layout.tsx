import type { Metadata, Viewport } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'SkyLens',
  description: "Point your phone at the sky and see what's above you.",
  applicationName: 'SkyLens',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SkyLens',
  },
}

export const viewport: Viewport = {
  themeColor: '#07131f',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
