'use client'

import Link from 'next/link'

import {
  LANDING_DESCRIPTION,
  PRIVACY_REASSURANCE_COPY,
  getPublicConfig,
} from '../../lib/config'
import { markViewerOnboardingCompleted } from '../../lib/viewer/settings'
import { createDemoViewerRoute } from '../../lib/permissions/coordinator'

export function LandingScreen() {
  const buildVersion = getPublicConfig().buildVersion
  const demoRoute = createDemoViewerRoute()

  return (
    <main className="relative isolate min-h-screen overflow-hidden px-6 py-8 sm:px-10">
      <div className="sky-grid pointer-events-none" />
      <div className="absolute inset-x-0 top-[-8rem] h-80 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-between gap-8 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <section className="flex max-w-2xl flex-col justify-center gap-6 py-10">
          <p className="w-fit rounded-full border border-sky-200/20 bg-sky-950/35 px-4 py-2 text-xs uppercase tracking-[0.28em] text-sky-100/80">
            Mobile sky guide
          </p>
          <div className="space-y-4">
            <h1
              className="text-5xl font-semibold tracking-tight text-white sm:text-6xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              SkyLens
            </h1>
            <p className="max-w-xl text-lg text-sky-100/88 sm:text-xl">
              {LANDING_DESCRIPTION}
            </p>
          </div>
          <p className="max-w-xl text-sm leading-7 text-sky-50/75 sm:text-base">
            Launch once, grant access, and SkyLens will prepare the live viewer without
            sending camera frames away from your device.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/view"
              onClick={() => {
                markViewerOnboardingCompleted()
              }}
              className="rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:bg-amber-100"
            >
              Open live viewer
            </Link>
            <Link
              href={demoRoute.href}
              onClick={() => {
                markViewerOnboardingCompleted()
              }}
              className="rounded-full border border-sky-200/20 bg-sky-950/35 px-6 py-3 text-sm font-semibold text-sky-50 transition hover:border-sky-100/35 hover:bg-sky-900/45"
            >
              Try demo mode
            </Link>
          </div>
        </section>

        <aside className="shell-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
          <div className="absolute right-4 top-4 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-100/85">
            PWA ready
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-sky-200/65">
                Trust and privacy
              </p>
              <ul className="space-y-3 text-sm leading-6 text-sky-50/85">
                {PRIVACY_REASSURANCE_COPY.map((copy) => (
                  <li
                    key={copy}
                    className="rounded-2xl border border-sky-200/10 bg-white/5 px-4 py-3"
                  >
                    {copy}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-3 rounded-[1.5rem] border border-sky-200/10 bg-slate-950/30 p-4 text-sm text-sky-100/70">
              <div className="flex items-center justify-between">
                <span>Permission order</span>
                <span className="text-sky-50">Motion → Camera → Location</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Fallbacks</span>
                <span className="text-sky-50">Manual observer, non-camera, manual pan</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Build</span>
                <span className="text-sky-50">{buildVersion}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
