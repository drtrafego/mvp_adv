"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-xl px-6 py-16" role="alert">
    <h1 className="font-serif text-2xl font-semibold">Não foi possível carregar esta página</h1>
    <p className="mt-3 text-sm text-muted-foreground">Não há confirmação de que os dados foram carregados. Tente novamente antes de tomar uma decisão com base nesta tela.</p>
    <button onClick={reset} className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Tentar novamente</button>
  </main>;
}
