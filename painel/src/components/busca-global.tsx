"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/** Campo de busca da barra lateral: submete para /busca?q=termo. */
export function BuscaGlobal({ onNav }: { onNav?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const termo = q.trim();
    if (!termo) return;
    onNav?.();
    router.push(`/busca?q=${encodeURIComponent(termo)}`);
  }

  return (
    <form onSubmit={submit} className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar processo, cliente, prazo"
        aria-label="Buscar"
        className="w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-indigo-brand/50"
      />
    </form>
  );
}
