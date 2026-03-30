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
  const primaryPrivacyCopy = PRIVACY_REASSURANCE_COPY.slice(0, 2)
  const secondaryPrivacyCopy = PRIVACY_REASSURANCE_COPY.slice(2)

  return (
    <main className="relative isolate min-h-screen overflow-hidden px-6 py-8 sm:px-10">
      <div className="sky-grid pointer-events-none" />
      <div className="absolute inset-x-0 top-[-8rem] h-80 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-between gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(21rem,0.78fr)] lg:items-center">
        <section className="flex max-w-2xl flex-col justify-center gap-5 py-8 sm:py-10">
          <p className="w-fit rounded-full border border-sky-200/20 bg-sky-950/35 px-4 py-2 text-xs uppercase tracking-[0.28em] text-sky-100/80">
            Mobile sky guide
          </p>
          <div className="space-y-3">
            <h1
              className="text-4xl font-semibold tracking-tight text-white sm:text-5xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              SkyLens
            </h1>
            <p className="max-w-xl text-base text-sky-100/84 sm:text-lg">
              {LANDING_DESCRIPTION}
            </p>
          </div>
          <p className="max-w-xl text-sm leading-7 text-sky-50/75">
            Launch once, grant access, and SkyLens will prepare the live viewer without
            sending camera frames away from your device.
          </p>
          <section className="shell-panel max-w-xl rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-100/70">
                  Start here
                </p>
                <p className="text-lg font-semibold text-white">Use the live viewer on your phone.</p>
                <p className="text-sm leading-6 text-sky-100/78">
                  The live route is the primary path. Demo mode stays available as a quick fallback
                  if you want to inspect the UI or work without device permissions.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/view"
                  onClick={() => {
                    markViewerOnboardingCompleted()
                  }}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:bg-amber-100"
                >
                  Open live viewer
                </Link>
                <Link
                  href={demoRoute.href}
                  onClick={() => {
                    markViewerOnboardingCompleted()
                  }}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-sky-200/20 bg-sky-950/35 px-6 py-3 text-sm font-semibold text-sky-50 transition hover:border-sky-100/35 hover:bg-sky-900/45"
                >
                  Try demo mode
                </Link>
              </div>
            </div>
          </section>
        </section>

        <aside className="shell-panel relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6">
          <div className="absolute right-4 top-4 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100/80">
            PWA ready
          </div>
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-sky-200/60">
                Privacy and fallback notes
              </p>
              <ul className="space-y-2 text-sm leading-6 text-sky-50/82">
                {primaryPrivacyCopy.map((copy) => (
                  <li key={copy} className="rounded-2xl border border-sky-200/10 bg-white/5 px-4 py-3">
                    {copy}
                  </li>
                ))}
              </ul>
              <div className="grid gap-2 text-xs leading-5 text-sky-100/62">
                {secondaryPrivacyCopy.map((copy) => (
                  <p key={copy}>{copy}</p>
                ))}
              </div>
            </div>
            <div className="grid gap-3 rounded-[1.35rem] border border-sky-200/10 bg-slate-950/25 p-4 text-sm text-sky-100/68">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-sky-200/55">
                  Permission order
                </p>
                <p className="mt-1 text-sky-50">Motion → Camera → Location</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-sky-200/55">
                  Fallbacks
                </p>
                <p className="mt-1 text-sky-50">Manual observer, non-camera, manual pan</p>
              </div>
              <div className="flex items-center justify-between border-t border-sky-100/10 pt-3 text-xs uppercase tracking-[0.18em] text-sky-200/55">
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
