export default function Loading() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-100 via-slate-50 to-violet-100 px-4">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] bg-[url('/og-image.png')] bg-cover bg-center" />
      <div className="pointer-events-none absolute inset-0 bg-white/35" />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-black/10 bg-white/80 px-6 py-8 shadow-xl backdrop-blur-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-black/10 bg-blue-600 text-3xl font-bold text-white shadow-lg shadow-blue-200">
          AId
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
            AIdCast
          </h1>
          <p className="text-sm text-zinc-600">
            Loading your mutual aid network...
          </p>
        </div>

        <div className="h-2 w-40 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-600" />
        </div>
      </div>
    </main>
  );
}