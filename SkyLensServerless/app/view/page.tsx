import { Suspense } from 'react'

import { ViewPageClient } from './view-page-client'

export default function ViewPage() {
  return (
    <Suspense fallback={null}>
      <ViewPageClient />
    </Suspense>
  )
}
