export default function EmbedValidationPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-200/70">
            Embed validation
          </p>
          <h1 className="text-3xl font-semibold">Embedded live viewer contract</h1>
          <p className="max-w-2xl text-sm leading-6 text-sky-100/80">
            This route exists to validate the shipped iframe delegation contract for the
            live AR screen. The embedded viewer below must keep the same-origin
            `Permissions-Policy` header and the explicit `allow` delegation required for
            camera, geolocation, and motion sensors.
          </p>
        </header>

        <section className="rounded-[1.75rem] border border-sky-100/10 bg-white/5 p-4 shadow-2xl shadow-slate-950/35">
          <iframe
            title="Embedded SkyLens viewer"
            data-testid="viewer-embed-frame"
            src="/view?entry=live&location=unknown&camera=unknown&orientation=unknown"
            allow="camera; geolocation; accelerometer; gyroscope; magnetometer"
            className="h-[960px] w-full rounded-[1.25rem] border border-sky-100/10 bg-slate-950"
          />
        </section>
      </div>
    </main>
  )
}
