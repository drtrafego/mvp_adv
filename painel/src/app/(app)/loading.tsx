export default function Loading() {
  return <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" role="status" aria-label="Carregando escritório">
    <div className="mb-6 h-36 animate-pulse rounded-2xl bg-muted" />
    <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map(n => <div key={n} className="h-32 animate-pulse rounded-xl border bg-card" />)}</div>
    <span className="sr-only">Carregando dados do escritório…</span>
  </div>;
}
